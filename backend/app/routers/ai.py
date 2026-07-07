from datetime import date
import datetime
import threading
import time
import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.gemini import check_gemini_health, parse_intent, generate_financial_summary
from app.database import get_db
from app.schemas import (
    ChatRequest, ChatResponse, ParseOnlyResponse, SummaryResponse, OllamaHealthResponse,
    PreviewRequest, PreviewResponse, ConfirmRequest, ConfirmResponse, UndoRequest, UndoResponse
)
from app.models import Transaction, EmiSchedule, Account, Person, Category, TransactionType, AccountType, User
from app.logic.balance import compute_net_worth, compute_person_ledger, compute_account_balance
from app.logic.milestones import check_and_record_milestones
from app.core.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["AI"])


def _get_or_create_category(db: Session, name: str, parent_type: str) -> int:
    # Exact case-insensitive match
    cat = db.query(Category).filter(Category.category_name.ilike(name)).first()
    if cat:
        return cat.id
        
    # Substring match
    cats = db.query(Category).filter(Category.parent_type == parent_type).all()
    for c in cats:
        if name.lower() in c.category_name.lower() or c.category_name.lower() in name.lower():
            return c.id
            
    # Fallback to create new category
    new_cat = Category(category_name=name.title(), parent_type=parent_type)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat.id


def _find_account(db: Session, hint: str, user_id: int) -> int:
    # Match by hint
    if hint:
        acc = (
            db.query(Account)
            .filter(Account.user_id == user_id, Account.account_name.ilike(f"%{hint}%"))
            .first()
        )
        if acc:
            return acc.id
            
    # Match by Cash fallback
    cash = (
        db.query(Account)
        .filter(Account.user_id == user_id, Account.account_name.ilike("%Cash%"))
        .first()
    )
    if cash:
        return cash.id
        
    # Match by first account
    first_acc = db.query(Account).filter(Account.user_id == user_id).first()
    if first_acc:
        return first_acc.id
        
    raise ValueError("No accounts found for your user. Please create an account first.")


def _get_or_create_person(db: Session, name: str, user_id: int) -> int:
    person = (
        db.query(Person)
        .filter(Person.user_id == user_id, Person.full_name.ilike(name))
        .first()
    )
    if person:
        return person.id
    new_person = Person(
        user_id=user_id,
        full_name=name.title(),
        relationship_type="Friend",
        active=True,
        notes="Created via AI Copilot"
    )
    db.add(new_person)
    db.commit()
    db.refresh(new_person)
    return new_person.id


def execute_intent(
    db: Session, intent: str, data: dict[str, Any], user_id: int
) -> dict[str, Any] | None:
    today = date.today()
    
    if intent == "CREATE_EXPENSE":
        category_id = data.get("category_id")
        category_name = data.get("category", "Other")
        if not category_id:
            category_id = _get_or_create_category(db, category_name, "Expense")
        else:
            cat = db.get(Category, category_id)
            if cat:
                category_name = cat.category_name
        
        from_acc_id = data.get("from_account_id")
        desc = data.get("description", "")
        if not from_acc_id:
            from_acc_id = _find_account(db, desc, user_id=user_id)
        
        amount = float(data.get("amount", 0))
        txn_date_str = data.get("date")
        try:
            txn_date = date.fromisoformat(txn_date_str) if txn_date_str else today
        except ValueError:
            txn_date = today
            
        txn = Transaction(
            user_id=user_id,
            date=txn_date,
            transaction_type="Expense",
            from_account_id=from_acc_id,
            category_id=category_id,
            amount=amount,
            description=desc
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return {"type": "Expense", "id": txn.id, "amount": txn.amount, "category": category_name, "date": str(txn.date)}

    elif intent == "CREATE_INCOME":
        category_id = data.get("category_id")
        category_name = data.get("category", "Other")
        if not category_id:
            category_id = _get_or_create_category(db, category_name, "Income")
        else:
            cat = db.get(Category, category_id)
            if cat:
                category_name = cat.category_name
        
        to_acc_id = data.get("to_account_id") or data.get("from_account_id")
        desc = data.get("description", "")
        if not to_acc_id:
            to_acc_id = _find_account(db, desc, user_id=user_id)
        
        amount = float(data.get("amount", 0))
        txn_date_str = data.get("date")
        try:
            txn_date = date.fromisoformat(txn_date_str) if txn_date_str else today
        except ValueError:
            txn_date = today
            
        txn = Transaction(
            user_id=user_id,
            date=txn_date,
            transaction_type="Income",
            to_account_id=to_acc_id,
            category_id=category_id,
            amount=amount,
            description=desc
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return {"type": "Income", "id": txn.id, "amount": txn.amount, "category": category_name, "date": str(txn.date)}

    elif intent == "CREATE_LOAN":
        person_id = data.get("person_id")
        person_name = data.get("person_name", "Unknown")
        if not person_id:
            person_id = _get_or_create_person(db, person_name, user_id=user_id)
        else:
            p = db.get(Person, person_id)
            if p:
                person_name = p.full_name
        
        amount = float(data.get("amount", 0))
        interest_rate = float(data.get("interest_rate", 0))
        due_date = data.get("due_date")
        loan_type = data.get("loan_type", "given")
        
        if loan_type == "received":
            ttype = "Loan Received"
            to_acc_id = data.get("to_account_id") or _find_account(db, "", user_id=user_id)
            from_acc_id = None
        else:
            ttype = "Loan Given"
            from_acc_id = data.get("from_account_id") or _find_account(db, "", user_id=user_id)
            to_acc_id = None
            
        category_id = data.get("category_id") or _get_or_create_category(db, "Friend Loan", "Loan")
        desc = data.get("description")
        if not desc:
            if loan_type == "received":
                desc = f"Loan received from {person_name}"
            else:
                desc = f"Loan given to {person_name}"
            if interest_rate > 0:
                desc += f" (Interest: {interest_rate}%)"
            if due_date:
                desc += f" due by {due_date}"
        
        txn = Transaction(
            user_id=user_id,
            date=today,
            transaction_type=ttype,
            from_account_id=from_acc_id,
            to_account_id=to_acc_id,
            person_id=person_id,
            category_id=category_id,
            amount=amount,
            description=desc
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return {"type": ttype, "id": txn.id, "amount": txn.amount, "person": person_name, "date": str(txn.date)}

    elif intent == "CREATE_PAYMENT":
        person_id = data.get("person_id")
        person_name = data.get("person_name", "Unknown")
        if not person_id and not data.get("payment_type") == "paid":
            person_id = _get_or_create_person(db, person_name, user_id=user_id)
        elif person_id:
            p = db.get(Person, person_id)
            if p:
                person_name = p.full_name
        
        amount = float(data.get("amount", 0))
        payment_date_str = data.get("payment_date")
        try:
            payment_date = date.fromisoformat(payment_date_str) if payment_date_str else today
        except ValueError:
            payment_date = today
            
        notes = data.get("notes") or data.get("description")
        payment_type = data.get("payment_type", "received")
        
        if not notes:
            if payment_type == "paid":
                notes = f"Loan repayment paid to {person_name}"
            else:
                notes = f"Loan repayment received from {person_name}"
        else:
            if person_name and person_name != "Unknown" and person_name.lower() not in notes.lower():
                if payment_type == "paid":
                    notes = f"{notes} to {person_name}"
                else:
                    notes = f"{notes} from {person_name}"
        
        if payment_type == "paid":
            ttype = "Loan Repayment Paid"
            from_acc_id = data.get("from_account_id") or _find_account(db, "", user_id=user_id)
            to_acc_id = data.get("to_account_id")
        else:
            ttype = "Loan Repayment Received"
            to_acc_id = data.get("to_account_id") or _find_account(db, "", user_id=user_id)
            from_acc_id = data.get("from_account_id")
            
        category_id = data.get("category_id") or _get_or_create_category(db, "Friend Loan", "Loan")
        
        txn = Transaction(
            user_id=user_id,
            date=payment_date,
            transaction_type=ttype,
            from_account_id=from_acc_id,
            to_account_id=to_acc_id,
            person_id=person_id,
            category_id=category_id,
            amount=amount,
            description=notes
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return {"type": ttype, "id": txn.id, "amount": txn.amount, "person": person_name if person_id else "Transfer", "date": str(txn.date)}

    elif intent == "CREATE_EMI":
        emi_name = data.get("name", "EMI")
        amount = float(data.get("amount", 0))
        due_date_str = data.get("due_date")
        try:
            due_date_parsed = date.fromisoformat(due_date_str) if due_date_str else today
        except ValueError:
            due_date_parsed = today
        due_day = due_date_parsed.day
        
        linked_person_id = data.get("person_id") or data.get("linked_person_id")
        end_date_parsed = None
        if data.get("end_date"):
            try:
                end_date_parsed = date.fromisoformat(data["end_date"])
            except ValueError:
                pass

        emi = EmiSchedule(
            user_id=user_id,
            emi_name=emi_name,
            amount=amount,
            due_date=due_day,
            frequency=data.get("frequency", "Monthly"),
            start_date=due_date_parsed,
            end_date=end_date_parsed,
            status=data.get("status", "Active"),
            linked_person_id=linked_person_id
        )
        db.add(emi)
        db.commit()
        db.refresh(emi)
        return {"type": "EMI Schedule", "id": emi.id, "name": emi.emi_name, "amount": emi.amount, "due_day": emi.due_date}

    elif intent == "CREATE_CREDIT_CARD":
        card_name = data.get("card_name", "Credit Card")
        credit_limit = float(data.get("credit_limit", 0))
        outstanding = float(data.get("outstanding_amount", 0))
        due_date_str = data.get("due_date")
        try:
            due_date = date.fromisoformat(due_date_str) if due_date_str else None
        except ValueError:
            due_date = None
            
        acc = Account(
            user_id=user_id,
            account_name=card_name,
            account_type="Credit Card",
            credit_limit=credit_limit,
            current_balance=outstanding,
            due_date=due_date
        )
        db.add(acc)
        db.commit()
        db.refresh(acc)
        return {"type": "Account (Credit Card)", "id": acc.id, "name": acc.account_name, "limit": acc.credit_limit, "outstanding": acc.current_balance}

    elif intent == "CREATE_GOLD_LOAN":
        lender = data.get("lender", "Gold Loan Lender")
        amount = float(data.get("amount", 0))
        due_date_str = data.get("due_date")
        try:
            due_date = date.fromisoformat(due_date_str) if due_date_str else None
        except ValueError:
            due_date = None
            
        acc = Account(
            user_id=user_id,
            account_name=f"{lender} Gold Loan",
            account_type="Gold Loan Account",
            current_balance=amount,
            due_date=due_date
        )
        db.add(acc)
        db.commit()
        db.refresh(acc)
        return {"type": "Account (Gold Loan)", "id": acc.id, "name": acc.account_name, "amount": acc.current_balance}

    return None


def compile_financial_data_prompt(db: Session, user_id: int) -> str:
    nw = compute_net_worth(db, user_id=user_id)
    
    # Compile Accounts
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    acc_details = []
    for acc in accounts:
        bal = compute_account_balance(db, acc.id)
        acc_details.append(f"- {acc.account_name} ({acc.account_type}): Balance {bal}" + (f", Limit {acc.credit_limit}" if acc.credit_limit else ""))
    accounts_list = "\n".join(acc_details)
    
    # Compile Outstanding Loans with Friends
    people = db.query(Person).filter(Person.user_id == user_id, Person.active.is_(True)).all()
    people_details = []
    for p in people:
        ledger = compute_person_ledger(db, p.id)
        if ledger["outstanding_lent"] > 0 or ledger["outstanding_borrowed"] > 0:
            people_details.append(f"- {p.full_name}: Lent {ledger['outstanding_lent']}, Borrowed {ledger['outstanding_borrowed']}")
    people_list = "\n".join(people_details) if people_details else "No outstanding loans with friends."
    
    # Compile EMIs
    emis = db.query(EmiSchedule).filter(EmiSchedule.user_id == user_id, EmiSchedule.status == "Active").all()
    emi_details = []
    for emi in emis:
        emi_details.append(f"- {emi.emi_name}: Amount {emi.amount}, Due on day {emi.due_date} of the month")
    emi_list = "\n".join(emi_details) if emi_details else "No active EMIs."
    
    # Compile Recent Transactions
    recent = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(5)
        .all()
    )
    recent_txns = []
    for t in recent:
        desc = f" ({t.description})" if t.description else ""
        recent_txns.append(f"- {t.date}: {t.transaction_type} of {t.amount}{desc}")
    recent_txns_list = "\n".join(recent_txns)
    
    prompt = f"""Here is the current state of my personal finances:
- Net Worth: {nw['net_worth']} (Total Assets: {nw['total_assets']}, Total Liabilities: {nw['total_liabilities']})
- Bank Balance: {nw['bank_balance']}
- Cash Balance: {nw['cash_balance']}
- Credit Card Outstanding: {nw['credit_outstanding']}
- Money Lent: {nw['money_lent']}
- Money Borrowed: {nw['money_borrowed']}

Accounts status:
{accounts_list}

Outstanding Friend Transactions:
{people_list}

Active EMIs:
{emi_list}

Recent 5 Transactions:
{recent_txns_list}

Please write a friendly, concise, and professional financial summary. Highlight any notable points (e.g. high credit card outstanding, large loans given, cash reserves, net worth status). Avoid repeating exact numbers excessively; instead, provide analytical insights and next steps in a paragraph or two.
"""
    return prompt


async def process_chat_message_logic(message: str, db: Session, user_id: int) -> dict[str, Any]:
    msg_lower = message.strip().lower()
    
    # 1. Decision: Check if it's a summary request
    summary_keywords = ["summarize", "summary", "report", "narrative", "portfolio", "overview", "finances", "status"]
    has_number = any(c.isdigit() for c in message)
    transaction_verbs = ["spent", "paid", "lent", "borrowed", "create", "add", "record", "buy", "bought", "spend"]
    has_txn_verb = any(verb in msg_lower for verb in transaction_verbs)
    
    is_summary_req = any(kw in msg_lower for kw in summary_keywords) and not (has_number or has_txn_verb)
    
    if is_summary_req:
        try:
            prompt = compile_financial_data_prompt(db, user_id=user_id)
            summary_text = await generate_financial_summary(prompt)
            return {
                "intent": "SUMMARY",
                "confidence": 1.0,
                "data": {},
                "reply": summary_text,
                "created": None,
                "executed": False
            }
        except Exception as e:
            return {
                "intent": "SUMMARY",
                "confidence": 1.0,
                "data": {},
                "reply": f"Sorry, I had trouble generating your financial summary: {str(e)}",
                "created": None,
                "executed": False
            }

    # 2. Decision: Check if it's a simple greeting or help request
    greetings = {"hi", "hello", "hey", "help", "who are you", "what can you do", "hola", "greetings", "good morning", "good afternoon", "good evening"}
    clean_msg = "".join(c for c in msg_lower if c.isalnum() or c.isspace()).strip()
    is_greeting = clean_msg in greetings or any(clean_msg == g or clean_msg.startswith(g + " ") for g in greetings)
    
    if is_greeting:
        greeting_reply = (
            "Hello! I am your PFMS AI Copilot. 🚀\n\n"
            "I can help you record your transactions and manage your accounts using natural language. Try saying:\n"
            "• 'I spent 500 on dinner today'\n"
            "• 'Lent Sunny 5000'\n"
            "• 'Sunny paid back 1500'\n"
            "• 'Create a Credit Card called Chase with 80000 limit'\n\n"
            "Or ask me to 'summarize my finances' or click the refresh icon on the left panel to get a full financial summary!"
        )
        return {
            "intent": "GREETING",
            "confidence": 1.0,
            "data": {},
            "reply": greeting_reply,
            "created": None,
            "executed": False
        }

    # 3. Decision: Default to parsing transaction (primary use case)
    parsed = await parse_intent(message)
    intent = parsed.get("intent", "UNKNOWN")
    data = parsed.get("data", {})
    reply = parsed.get("reply", "Done!")
    confidence = float(parsed.get("confidence", 0.0))

    created = None
    executed = False
    try:
        created = execute_intent(db, intent, data, user_id=user_id)
        if created is not None:
            executed = True
    except Exception as e:
        reply = f"{reply} ⚠️ (Could not save: {str(e)})"

    return {
        "intent": intent,
        "confidence": confidence,
        "data": data,
        "reply": reply,
        "created": created,
        "executed": executed
    }


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        result = await process_chat_message_logic(request.message, db, user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return ChatResponse(
        message=request.message,
        intent=result["intent"],
        confidence=result["confidence"],
        reply=result["reply"],
        created=result["created"],
        executed=result["executed"]
    )


@router.post("/parse", response_model=ParseOnlyResponse)
async def ai_parse(request: ChatRequest, current_user: User = Depends(get_current_user)):
    try:
        parsed = await parse_intent(request.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return ParseOnlyResponse(
        message=request.message,
        intent=parsed.get("intent", "UNKNOWN"),
        confidence=float(parsed.get("confidence", 0.0)),
        data=parsed.get("data", {}),
        reply=parsed.get("reply", "Parsed successfully.")
    )


@router.get("/summary", response_model=SummaryResponse)
async def ai_summary(
    generate_narrative: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    nw = compute_net_worth(db, user_id=current_user.id)
    summary_text = ""
    if generate_narrative:
        prompt = compile_financial_data_prompt(db, user_id=current_user.id)
        summary_text = await generate_financial_summary(prompt)
    
    return SummaryResponse(
        summary=summary_text,
        stats={
            "net_worth": nw["net_worth"],
            "total_assets": nw["total_assets"],
            "total_liabilities": nw["total_liabilities"],
            "bank_balance": nw["bank_balance"],
            "cash_balance": nw["cash_balance"],
            "credit_outstanding": nw["credit_outstanding"],
            "money_lent": nw["money_lent"],
            "money_borrowed": nw["money_borrowed"]
        }
    )


@router.get("/health", response_model=OllamaHealthResponse)
async def ai_health():
    is_healthy = await check_gemini_health()
    return OllamaHealthResponse(
        ollama_running=is_healthy,
        model="gemini-2.5-flash",
        status="Gemini API is operational" if is_healthy else "Gemini API key is not configured or is invalid"
    )


# In-memory consumed previews tracking with lock
consumed_previews: dict[str, float] = {}
preview_lock = threading.Lock()


def _cleanup_expired_previews():
    now = time.time()
    expired = [pid for pid, ts in consumed_previews.items() if now - ts > 60.0]
    for pid in expired:
        consumed_previews.pop(pid, None)


@router.post("/chat/preview", response_model=PreviewResponse)
async def ai_preview(request: PreviewRequest, current_user: User = Depends(get_current_user)):
    # Perform lazy TTL cleanup
    with preview_lock:
        _cleanup_expired_previews()
        
    try:
        parsed = await parse_intent(request.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    intent = parsed.get("intent", "UNKNOWN")
    data = parsed.get("data", {})
    
    if intent == "UNKNOWN":
        raise HTTPException(
            status_code=400,
            detail="Sorry, I could not understand this transaction. Please try phrasing it differently."
        )
        
    preview_uuid = str(uuid.uuid4())
    return PreviewResponse(
        preview_id=preview_uuid,
        intent=intent,
        intent_data=data,
        original_text=request.message
    )


@router.post("/chat/confirm", response_model=ConfirmResponse)
async def ai_confirm(
    request: ConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Perform lazy TTL cleanup
    with preview_lock:
        _cleanup_expired_previews()
        
    if not request.execute:
        return ConfirmResponse(status="cancelled")
        
    # Idempotency Protection
    with preview_lock:
        if request.preview_id in consumed_previews:
            raise HTTPException(
                status_code=400,
                detail="This transaction has already been executed/confirmed."
            )
        consumed_previews[request.preview_id] = time.time()

    # Schema Validation on User Edits
    valid_intents = {
        "CREATE_EXPENSE", "CREATE_INCOME", "CREATE_LOAN", "CREATE_PAYMENT",
        "CREATE_EMI", "CREATE_CREDIT_CARD", "CREATE_GOLD_LOAN"
    }
    if request.intent not in valid_intents:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported intent category '{request.intent}'."
        )
        
    data = request.intent_data
    
    # 1. Validate amount
    if request.intent in ["CREATE_EXPENSE", "CREATE_INCOME", "CREATE_LOAN", "CREATE_PAYMENT", "CREATE_EMI", "CREATE_GOLD_LOAN"]:
        amount_val = data.get("amount")
        if amount_val is None:
            raise HTTPException(status_code=400, detail="Amount field is required.")
        try:
            amount_f = float(amount_val)
            if amount_f <= 0:
                raise ValueError()
            data["amount"] = amount_f
        except ValueError:
            raise HTTPException(status_code=400, detail="Amount must be a positive number.")

    # 2. Validate dates
    date_keys = ["date", "payment_date", "due_date", "start_date", "end_date"]
    for key in date_keys:
        if key in data and data[key]:
            try:
                date.fromisoformat(str(data[key]))
            except ValueError:
                # If due_date is an integer (for EMI day of month), let it pass
                if key == "due_date" and request.intent == "CREATE_EMI":
                    try:
                        int(data[key])
                    except ValueError:
                        raise HTTPException(status_code=400, detail="EMI due day must be an integer day between 1 and 31.")
                else:
                    raise HTTPException(status_code=400, detail=f"Invalid date format for '{key}'. Expected YYYY-MM-DD.")

    # 3. Verify Foreign Keys exist in DB and belong to current user
    if "from_account_id" in data and data["from_account_id"]:
        acc = db.get(Account, data["from_account_id"])
        if not acc or acc.user_id != current_user.id:
            raise HTTPException(status_code=400, detail="Selected source account does not exist.")
            
    if "to_account_id" in data and data["to_account_id"]:
        acc = db.get(Account, data["to_account_id"])
        if not acc or acc.user_id != current_user.id:
            raise HTTPException(status_code=400, detail="Selected target account does not exist.")
            
    if "category_id" in data and data["category_id"]:
        if not db.get(Category, data["category_id"]):
            raise HTTPException(status_code=400, detail="Selected category does not exist.")
            
    if "person_id" in data and data["person_id"]:
        p = db.get(Person, data["person_id"])
        if not p or p.user_id != current_user.id:
            raise HTTPException(status_code=400, detail="Selected contact person does not exist.")

    try:
        created = execute_intent(db, request.intent, data, user_id=current_user.id)
        if created is None:
            raise HTTPException(status_code=500, detail="Database write execution failed.")

        # Milestone detection after successful transaction
        milestones = []
        txn_id = created.get("id")
        if txn_id:
            milestones = check_and_record_milestones(db, current_user.id, txn_id)

        return ConfirmResponse(
            status="success",
            transaction_id=txn_id,
            timestamp=int(time.time()),
            milestones=milestones,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")


@router.post("/chat/undo", response_model=UndoResponse)
async def ai_undo(
    request: UndoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    txn = db.get(Transaction, request.transaction_id)
    if not txn or txn.user_id != current_user.id:
        return UndoResponse(success=False, reason="Transaction not found or already undone.")
        
    # Check 10-second undo window
    now = datetime.datetime.utcnow()
    diff = now - txn.created_at
    if diff.total_seconds() > 10.0:
        return UndoResponse(
            success=False,
            reason="Undo window expired. This transaction can no longer be undone automatically."
        )
        
    try:
        # Atomic delete parent & child rows (processing fees)
        db.query(Transaction).filter(Transaction.user_id == current_user.id, Transaction.parent_transaction_id == request.transaction_id).delete()
        db.delete(txn)
        db.commit()
        return UndoResponse(success=True)
    except Exception as e:
        db.rollback()
        return UndoResponse(success=False, reason=f"Database deletion error: {str(e)}")
