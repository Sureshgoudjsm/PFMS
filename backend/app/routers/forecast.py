"""
Forecast router

This router exposes the 30‑day cash‑flow forecast.
It is JWT‑protected and simply forwards the request to the core
`compute_forecast` helper.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.logic.forecast import compute_forecast
from app.models import User
from app.schemas import ForecastResponse
from app.core.auth import get_current_user

router = APIRouter(tags=["Forecast"] )

@router.get("/forecast", response_model=ForecastResponse)
def get_forecast(
    what_if: float = Query(0.0, ge=0.0, le=0.5, description="What‑If reduction factor (0‑0.5, 0 = no change)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a 30‑day projection for the authenticated user.

    The `what_if` parameter is a fraction representing how much discretionary
    spend should be reduced (e.g. 0.5 = 50 % reduction). The core forecast logic
    always returns the raw projection; the frontend applies the cumulative
    savings adjustment, so we simply forward the value here.
    """
    projection = compute_forecast(db, current_user.id, what_if=what_if)
    return ForecastResponse(projection=projection)
