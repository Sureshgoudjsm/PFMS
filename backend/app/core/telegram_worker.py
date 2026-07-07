import asyncio
import logging
import os
import time
import httpx
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.core.gemini import parse_intent
from app.routers.ai import execute_intent, process_chat_message_logic
from app.models import TelegramLink, User, Transaction

logger = logging.getLogger(__name__)

# References to background tasks to coordinate startup/shutdown
polling_task = None

async def telegram_polling_loop():
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN not configured in .env file. Telegram integration is disabled.")
        return

    logger.info("Initializing Telegram Bot background polling...")
    url = f"https://api.telegram.org/bot{token}"
    offset = 0
    timeout = 30

    async with httpx.AsyncClient(timeout=timeout + 5) as client:
        # Skip pending updates on startup to avoid rate-limiting/429 loops
        try:
            r = await client.get(f"{url}/getUpdates", params={"offset": -1, "limit": 1})
            if r.status_code == 200:
                res = r.json()
                if res.get("ok") and res.get("result"):
                    offset = res["result"][0]["update_id"] + 1
                    logger.info(f"Skipped pending Telegram updates. Initialized offset to {offset}")
        except Exception as e:
            logger.warning(f"Failed to clear pending Telegram updates on startup: {e}")

        while True:
            try:
                # Poll getUpdates
                response = await client.get(
                    f"{url}/getUpdates",
                    params={"offset": offset, "timeout": timeout}
                )
                
                # Check for unauthorized (wrong token) or other errors
                if response.status_code == 401:
                    logger.error("Telegram API Token is invalid or unauthorized. Please verify TELEGRAM_BOT_TOKEN in .env.")
                    await asyncio.sleep(60) # Backoff to avoid flooding
                    continue
                elif response.status_code != 200:
                    logger.error(f"Telegram polling error: {response.status_code} - {response.text}")
                    await asyncio.sleep(10)
                    continue

                res = response.json()
                if not res.get("ok"):
                    logger.error(f"Telegram Bot API returned ok=False: {res}")
                    await asyncio.sleep(10)
                    continue

                updates = res.get("result", [])
                for update in updates:
                    # Mark update as processed by incrementing offset
                    offset = max(offset, update["update_id"] + 1)
                    
                    message = update.get("message", {})
                    chat = message.get("chat", {})
                    chat_id = chat.get("id")
                    text = message.get("text", "").strip()

                    if not text or not chat_id:
                        continue

                    logger.info(f"Received Telegram message from chat_id={chat_id}: '{text}'")
                    
                    # Send typing state indicator
                    try:
                        await client.post(f"{url}/sendChatAction", json={"chat_id": chat_id, "action": "typing"})
                    except Exception:
                        pass

                    db = SessionLocal()
                    reply = ""
                    try:
                        # 1. Check if this chat_id is linked to a user
                        link = db.query(TelegramLink).filter(TelegramLink.chat_id == chat_id).first()
                        
                        if link:
                            # Linked user exists - process text scoped to user_id
                            result = await process_chat_message_logic(text, db, user_id=link.user_id)
                            intent = result["intent"]
                            reply = result["reply"]
                            created = result["created"]
                            executed = result["executed"]
                            
                            if executed and created:
                                reply = f"✅ Got it — {reply}\n\n[Record Committed]\n"
                                for k, v in created.items():
                                    if k != "id":
                                        reply += f"• {k.capitalize()}: {v}\n"
                        else:
                            # Unlinked chat - check if they are linking via code
                            parts = text.split()
                            if len(parts) == 2 and parts[0].lower() == "/link":
                                code = parts[1].upper()
                                from app.core.telegram_shared import active_linking_codes
                                
                                if code in active_linking_codes:
                                    user_id, expiry = active_linking_codes[code]
                                    if time.time() < expiry:
                                        # Code is valid and not expired - save mapping
                                        new_link = TelegramLink(chat_id=chat_id, user_id=user_id)
                                        db.add(new_link)
                                        db.commit()
                                        
                                        # Remove consumed code
                                        active_linking_codes.pop(code, None)
                                        
                                        user = db.get(User, user_id)
                                        reply = f"🎉 Success! This Telegram chat is now securely linked to your PFMS user profile: {user.username}."
                                    else:
                                        reply = "⚠️ This linking code has expired. Please generate a new code from the PFMS web application and try again."
                                else:
                                    reply = "❌ Invalid linking code. Please check the code and try again."
                            else:
                                # Normal message from unlinked chat -> prompt linking instruction
                                reply = (
                                    "Welcome to PFMS! 🚀\n\n"
                                    "This Telegram chat is not connected to any PFMS user profile.\n\n"
                                    "To link this chat:\n"
                                    "1. Log in to the PFMS web application.\n"
                                    "2. Get your unique linking code from the web UI.\n"
                                    "3. Send it here using the command:\n"
                                    "/link <YOUR_CODE>"
                                )
                    except Exception as err:
                        logger.error(f"Error processing Telegram message: {err}")
                        reply = f"Sorry, I had trouble processing that request: {err}"
                    finally:
                        db.close()

                    # Send reply to Telegram Chat
                    await client.post(
                        f"{url}/sendMessage",
                        json={"chat_id": chat_id, "text": reply}
                    )

            except asyncio.CancelledError:
                logger.info("Telegram background polling task received cancellation signal. Stopping loop.")
                break
            except Exception as e:
                logger.error(f"Telegram polling thread exception: {e}")
                await asyncio.sleep(5)
