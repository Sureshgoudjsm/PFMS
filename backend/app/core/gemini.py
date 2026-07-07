import json
import logging
import os
from datetime import date
from typing import Any
import httpx

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-3.5-flash"
GEMINI_TIMEOUT = 30.0

SYSTEM_PROMPT = """You are a financial assistant for a personal finance app.
Your job is to parse the user's natural language input and return ONLY a valid JSON object — no markdown, no explanation, just raw JSON.

Today's date is {today}.

The JSON must follow this exact schema:
{{
  "intent": "<one of the intents listed below>",
  "confidence": <float 0.0 to 1.0>,
  "data": {{ <fields relevant to the intent> }},
  "reply": "<short friendly confirmation message in English>"
}}

SUPPORTED INTENTS:
1. CREATE_EXPENSE: data: {{ "amount": float, "category": string, "description": string or null, "date": "YYYY-MM-DD" }} (Food, Fuel, Shopping, Rent, Bills, Travel, Entertainment, Health, Education, Other)
2. CREATE_INCOME: data: {{ "amount": float, "category": string, "description": string or null, "date": "YYYY-MM-DD" }} (Salary, Interest, Dividend, Refund, Other)
3. CREATE_LOAN: data: {{ "person_name": string, "amount": float, "interest_rate": float (default 0), "due_date": "YYYY-MM-DD" or null, "status": "pending", "loan_type": "given" | "received" }}
4. CREATE_PAYMENT: data: {{ "person_name": string, "amount": float, "payment_date": "YYYY-MM-DD", "notes": string or null, "payment_type": "received" | "paid" }}
5. CREATE_EMI: data: {{ "name": string, "amount": float, "due_date": "YYYY-MM-DD", "status": "pending" }}
6. CREATE_CREDIT_CARD: data: {{ "card_name": string, "credit_limit": float, "outstanding_amount": float (default 0), "due_date": "YYYY-MM-DD" or null }}
7. CREATE_GOLD_LOAN: data: {{ "lender": string, "amount": float, "gold_weight": float, "interest_rate": float (default 0), "due_date": "YYYY-MM-DD" or null }}
8. UNKNOWN: data: {{}}

RULES:
- Return ONLY the JSON object, do not wrap in ```json ... ``` blocks.
- amounts are floats.
- Use today's date if none is mentioned.

"""

def _build_system_prompt() -> str:
    return SYSTEM_PROMPT.format(today=date.today().isoformat())

async def parse_intent(user_message: str) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")

    payload = {
        "systemInstruction": {"parts": [{"text": _build_system_prompt()}]},
        "contents": [{"parts": [{"text": user_message.strip()}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
    }
    
    models_to_try = [GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"]
    last_error = None
    errors = {}

    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        try:
            async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT) as client:
                response = await client.post(url, json=payload)
                if response.status_code != 200:
                    errors[model] = response.status_code
                    response.raise_for_status()
            
            res_json = response.json()
            raw_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw_text)
            
            parsed.setdefault("intent", "UNKNOWN")
            parsed.setdefault("confidence", 0.0)
            parsed.setdefault("data", {})
            parsed.setdefault("reply", "Done!")
            return parsed
        except Exception as e:
            logger.warning(f"Failed using model {model}: {e}")
            last_error = e
            continue

    logger.error(f"All models failed. Last error: {last_error}")
    if 429 in errors.values():
        return {
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "data": {},
            "reply": "Sorry, your Gemini API Free Tier quota or rate limit is exceeded (429 Quota Error). Please wait a minute and try again."
        }
    if 503 in errors.values():
        return {
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "data": {},
            "reply": "Sorry, the Gemini API is currently overloaded (503 Service Unavailable). Please try again in a few seconds."
        }
    return {"intent": "UNKNOWN", "confidence": 0.0, "data": {}, "reply": f"Sorry, I had trouble parsing that (API Error: {last_error})."}

async def check_gemini_health() -> bool:
    if not GEMINI_API_KEY:
        return False
        
    models_to_try = [GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"]
    
    for model in models_to_try:
        try:
            payload = {"contents": [{"parts": [{"text": "Health check"}]}], "generationConfig": {"maxOutputTokens": 5}}
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.post(url, json=payload)
                if r.status_code == 200:
                    return True
        except Exception:
            continue
    return False

async def generate_financial_summary(prompt: str) -> str:
    if not GEMINI_API_KEY:
        return "Summary unavailable (Gemini key not configured)."
        
    models_to_try = [GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"]
    last_error = None
    errors = {}
    
    for model in models_to_try:
        payload = {"contents": [{"parts": [{"text": prompt.strip()}]}], "generationConfig": {"temperature": 0.7}}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        try:
            async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT) as client:
                response = await client.post(url, json=payload)
                if response.status_code != 200:
                    errors[model] = response.status_code
                    response.raise_for_status()
            return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            logger.warning(f"Failed summary using model {model}: {e}")
            last_error = e
            continue
            
    if 429 in errors.values():
        return "Summary unavailable (Gemini API Free Tier quota is exceeded — 429 Quota Error)."
    if 503 in errors.values():
        return "Summary unavailable (Gemini API is currently overloaded — 503 Service Unavailable)."
    return f"Summary unavailable (All models failed. Last error: {last_error})."


_QUERY_SYSTEM_PROMPT = """You are a query-intent classifier for a personal finance app.
The user will ask a natural-language question about their finances.
You must identify which ONE of these 6 named templates best matches the question,
and extract the required parameters.

Today's date is {today}.

AVAILABLE TEMPLATES:
1. spend_by_category
   params: category_name (str), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
   example: "What did I spend on Food this month?"

2. total_in_range
   params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
   example: "How much did I earn and spend in June?"

3. transactions_with_person
   params: person_name (str), limit (int, default 10)
   example: "Show me my last 5 transactions with Ravi"

4. avg_monthly_spend_category
   params: category_name (str), n_months (int, default 3)
   example: "What's my average monthly spend on Transport?"

5. net_position_with_person
   params: person_name (str)
   example: "What's my net position with Suresh?" or "Does Ravi owe me money?"

6. upcoming_emis
   params: (none)
   example: "When is my next EMI due?" or "Show my upcoming EMIs"

RULES:
- Return ONLY valid JSON. No markdown, no explanation.
- If confidence >= 0.6, return:
  {"function": "<template_name>", "confidence": <float>, "params": {<extracted params>}}
- If no template matches with confidence >= 0.6, return:
  {"function": null, "confidence": 0.0, "params": {}}
- For date ranges: if the user says "this month", use the first and last day of the current month.
  If "last month", use first and last day of the previous month.
- Default start_date to the first day of the current month if not specified.
- Default end_date to today if not specified.
"""


async def parse_query_intent(user_message: str) -> dict:
    """
    Map a natural-language finance question to one of 6 named query templates.
    Returns {"function": str|None, "confidence": float, "params": dict}.
    Gemini never constructs SQL — it only names the template and extracts params.
    """
    if not GEMINI_API_KEY:
        return {"function": None, "confidence": 0.0, "params": {}}

    prompt = _QUERY_SYSTEM_PROMPT.format(today=date.today().isoformat())
    payload = {
        "systemInstruction": {"parts": [{"text": prompt}]},
        "contents": [{"parts": [{"text": user_message.strip()}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
        },
    }

    models_to_try = [GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"]
    for model in models_to_try:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/"
            f"models/{model}:generateContent?key={GEMINI_API_KEY}"
        )
        try:
            async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code != 200:
                    resp.raise_for_status()
            raw    = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw)
            parsed.setdefault("function",   None)
            parsed.setdefault("confidence", 0.0)
            parsed.setdefault("params",     {})
            return parsed
        except Exception as exc:
            logger.warning("parse_query_intent failed (%s): %s", model, exc)
            continue

    return {"function": None, "confidence": 0.0, "params": {}}
