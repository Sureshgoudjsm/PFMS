"""query.py — Scoped conversational query endpoint (6 SELECT-only templates)."""

from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.gemini import parse_query_intent
from app.database import get_db
from app.logic import query_templates
from app.models import User
from app.schemas import QueryRequest, QueryResponse

router = APIRouter(tags=["Conversational Query"])

CONFIDENCE_THRESHOLD = 0.6

_FALLBACK_ANSWER = (
    "I can't answer that precisely yet. Try asking me:\n"
    "• \"What did I spend on Food this month?\"\n"
    "• \"What's my net position with Ravi?\"\n"
    "• \"When is my next EMI due?\""
)
_EXAMPLE_QUESTIONS = [
    "What did I spend on Food this month?",
    "What's my net position with Ravi?",
    "When is my next EMI due?",
]

_VALID_FUNCTIONS = {
    "spend_by_category",
    "total_in_range",
    "transactions_with_person",
    "avg_monthly_spend_category",
    "net_position_with_person",
    "upcoming_emis",
}


def _parse_date(value: object, fallback: date) -> date:
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    return fallback


def _this_month_start() -> date:
    return date.today().replace(day=1)


@router.post("/query", response_model=QueryResponse)
async def conversational_query(
    request: QueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dispatch a natural-language finance question to one of 6 pre-written
    SELECT-only query templates. Gemini classifies the intent and extracts
    parameters — it never constructs or executes SQL.
    """
    parsed     = await parse_query_intent(request.question)
    fn_name    = parsed.get("function")
    confidence = float(parsed.get("confidence", 0.0))
    params     = parsed.get("params") or {}

    if fn_name not in _VALID_FUNCTIONS or confidence < CONFIDENCE_THRESHOLD:
        return QueryResponse(
            answer=_FALLBACK_ANSWER,
            data={},
            template_used=None,
            is_fallback=True,
            example_questions=_EXAMPLE_QUESTIONS,
        )

    today = date.today()
    try:
        data: dict = {}
        answer: str = ""

        if fn_name == "spend_by_category":
            start = _parse_date(params.get("start_date"), _this_month_start())
            end   = _parse_date(params.get("end_date"),   today)
            data  = query_templates.spend_by_category(
                db, current_user.id,
                category_name=str(params.get("category_name", "")),
                start_date=start,
                end_date=end,
            )
            if data["found"]:
                answer = (
                    f"You spent \u20b9{data['total']:,.0f} on {data['category']} "
                    f"between {data['start_date']} and {data['end_date']} "
                    f"({data['count']} transaction{'s' if data['count'] != 1 else ''})."
                )
            else:
                answer = f"No transactions found for category '{params.get('category_name', '')}'."

        elif fn_name == "total_in_range":
            start = _parse_date(params.get("start_date"), _this_month_start())
            end   = _parse_date(params.get("end_date"),   today)
            data  = query_templates.total_in_range(db, current_user.id, start, end)
            net   = data["net"]
            answer = (
                f"From {data['start_date']} to {data['end_date']}: "
                f"Income \u20b9{data['income']:,.0f}, Expenses \u20b9{data['expenses']:,.0f}. "
                f"Net {'saved' if net >= 0 else 'deficit'}: \u20b9{abs(net):,.0f}."
            )

        elif fn_name == "transactions_with_person":
            limit = int(params.get("limit", 10))
            data  = query_templates.transactions_with_person(
                db, current_user.id,
                person_name=str(params.get("person_name", "")),
                limit=limit,
            )
            if data["found"]:
                count  = len(data["transactions"])
                answer = f"Last {count} transaction{'s' if count != 1 else ''} with {data['person']}."
            else:
                answer = f"No contact named '{params.get('person_name', '')}' found."

        elif fn_name == "avg_monthly_spend_category":
            n    = int(params.get("n_months", 3))
            data = query_templates.avg_monthly_spend_category(
                db, current_user.id,
                category_name=str(params.get("category_name", "")),
                n_months=n,
            )
            if data["found"]:
                answer = (
                    f"Average monthly spend on {data['category']} "
                    f"over the last {n} month{'s' if n != 1 else ''}: "
                    f"\u20b9{data['avg_monthly']:,.0f}."
                )
            else:
                answer = f"No transactions found for category '{params.get('category_name', '')}'."

        elif fn_name == "net_position_with_person":
            data = query_templates.net_position_with_person(
                db, current_user.id,
                person_name=str(params.get("person_name", "")),
            )
            if data["found"]:
                net = data.get("net_position", 0)
                if net > 0:
                    answer = f"{data['person']} owes you \u20b9{net:,.0f}."
                elif net < 0:
                    answer = f"You owe {data['person']} \u20b9{abs(net):,.0f}."
                else:
                    answer = f"You and {data['person']} are settled up."
            else:
                answer = f"No contact named '{params.get('person_name', '')}' found."

        elif fn_name == "upcoming_emis":
            emis = query_templates.upcoming_emis(db, current_user.id)
            data = {"emis": emis}
            if emis:
                lines  = [
                    f"  \u2022 {e['name']}: \u20b9{e['amount']:,.0f} due {e['next_due']} "
                    f"({e['days_until']} day{'s' if e['days_until'] != 1 else ''})"
                    for e in emis[:5]
                ]
                answer = "Upcoming EMIs:\n" + "\n".join(lines)
                if len(emis) > 5:
                    answer += f"\n  …and {len(emis) - 5} more."
            else:
                answer = "No active EMIs scheduled."

        else:
            # Unreachable given _VALID_FUNCTIONS guard, but be safe
            return QueryResponse(
                answer=_FALLBACK_ANSWER,
                data={},
                template_used=None,
                is_fallback=True,
                example_questions=_EXAMPLE_QUESTIONS,
            )

        return QueryResponse(
            answer=answer,
            data=data,
            template_used=fn_name,
            is_fallback=False,
            example_questions=[],
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Query execution failed: {exc}",
        )
