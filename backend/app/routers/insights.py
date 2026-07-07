"""insights.py — Financial health score + on-demand AI narrative."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.gemini import generate_financial_summary
from app.database import get_db
from app.logic.health_score import compute_health_score
from app.models import User
from app.schemas import HealthNarrativeResponse, HealthScoreResponse

router = APIRouter(tags=["Insights"])


@router.get("/insights/health-score", response_model=HealthScoreResponse)
def get_health_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compute the 5-factor financial health score for the current user."""
    result = compute_health_score(db, user_id=current_user.id)
    return HealthScoreResponse(**result)


@router.post("/insights/health-narrative", response_model=HealthNarrativeResponse)
async def get_health_narrative(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    On-demand only — triggers one Gemini call to produce a 2-3 sentence
    neutral, factual observation. NOT called on every Dashboard load.
    """
    score_data = compute_health_score(db, user_id=current_user.id)

    if not score_data["is_sufficient_data"]:
        return HealthNarrativeResponse(
            narrative="Not enough transaction history to generate a narrative yet. "
                      "Keep logging transactions for at least 30 days."
        )

    computed_factors = [f for f in score_data["factors"] if f["sub_score"] != -1]
    factors_text = "\n".join(
        f"- {f['name']} ({int(f['weight']*100)}%): {f['raw_value']} → sub-score {f['sub_score']}/100"
        for f in computed_factors
    )
    skipped = [f for f in score_data["factors"] if f["sub_score"] == -1]
    skipped_text = (
        "\nSkipped (insufficient data): " + ", ".join(f["name"] for f in skipped)
        if skipped else ""
    )
    prompt = (
        f"The user's financial health score is {score_data['score']}/100.\n\n"
        f"Factor breakdown:\n{factors_text}{skipped_text}\n\n"
        "Write exactly 2-3 sentences. Style: neutral and observational, not prescriptive. "
        "Do not use alarming language. Focus on what the numbers show factually. "
        "Do not start with 'I' or 'Your financial health'. "
        "Example style: 'Savings rate stood at X% over the past quarter, while EMI obligations "
        "represent Y% of income.'"
    )
    narrative = await generate_financial_summary(prompt)
    return HealthNarrativeResponse(narrative=narrative)
