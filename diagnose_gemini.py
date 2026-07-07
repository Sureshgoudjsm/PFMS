import os
import asyncio
import httpx
import json

async def diagnose():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        print("[-] ERROR: GEMINI_API_KEY environment variable is not set!")
        print("    Please set it using: $env:GEMINI_API_KEY=\"your_key\" (PowerShell) or set GEMINI_API_KEY=your_key (CMD)")
        return
        
    masked = key[:4] + "..." + key[-4:] if len(key) > 8 else "too short"
    print(f"[+] Found GEMINI_API_KEY: {masked} (length: {len(key)})")
    
    models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    payload = {
        "contents": [{"parts": [{"text": "Hello, this is a health diagnostic check."}]}],
        "generationConfig": {"maxOutputTokens": 10}
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            print(f"\n[+] Testing model '{model}'...")
            try:
                r = await client.post(url, json=payload)
                print(f"    - Status Code: {r.status_code}")
                if r.status_code == 200:
                    print("    - SUCCESS! Response:")
                    res_json = r.json()
                    text = res_json["candidates"][0]["content"]["parts"][0]["text"]
                    print(f"      {text.strip()}")
                else:
                    print(f"    - FAILED! Status: {r.status_code}")
                    print(f"      Body: {r.text[:500]}")
            except Exception as e:
                print(f"    - EXCEPTION: {e}")

if __name__ == "__main__":
    asyncio.run(diagnose())
