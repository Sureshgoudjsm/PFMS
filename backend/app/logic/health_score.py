"""
health_score.py
---------------
5-Factor Financial Health Score (0–100).

Confirmed factor weights and scoring curves (user-approved 2026-06-28):

  Factor               Weight   sub-score 0 when          sub-score 100 when    Curve
  ──────────────────────────────────────────────────────────────────────────────────────
  savings_rate          30 %    rate ≤ 0 %                rate ≥ 50 %           linear
  emi_to_income         25 %    ratio ≥ 50 %              ratio = 0 %           linear, inverted
  credit_utilization    20 %    utilization ≥ 50 %        utilization = 0 %     linear, inverted
  emergency_fund        15 %    coverage = 0×             coverage ≥ 3×         linear
  spend_stability       10 %    CV ≥ 1.0                  CV = 0                linear, inverted

Weight redistribution (when a factor is skipped):
    effective_weight_i = original_weight_i / (1 - Σ skipped_weights)
    Skipped factors appear in the breakdown with sub_score = -1 and
    weighted_score = -1 (sentinel). The frontend renders these as "N/A".

Sparse data gate — BOTH conditions must hold for is_sufficient_data = True:
    - At least 30 calendar days since first non-sample transaction
    - At least 5 non-sample transactions
"""

import math
from datetime import date
from calendar import monthrange
from typing import Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.models import Account, AccountType, Transaction, TransactionType, EmiSchedule
from app.logic.balance import compute_net_worth, compute_account_balance

# ── Auditable constants ────────────────────────────────────────────────────

WEIGHTS: dict[str, float] = {
    "savings_rate":       0.30,
    "emi_to_income":      0.25,
    "credit_utilization": 0.20,
    "emergency_fund":     0.15,
    "spend_stability":    0.10,
}

# Curve parameters (all linear unless noted)
SAVINGS_RATE_MAX     = 0.50   # 50% savings rate → sub-score 100
EMI_RATIO_WORST      = 0.50   # ≥50% EMI/income  → sub-score 0
CREDIT_UTIL_WORST    = 0.50   # ≥50% utilization  → sub-score 0
EMERGENCY_COVER_MAX  = 3.0    # 3× monthly expenses → sub-score 100
SPEND_CV_WORST       = 1.0    # CV ≥ 1.0           → sub-score 0

SPARSE_MIN_DAYS         = 30
SPARSE_MIN_TRANSACTIONS = 5

# Sentinel value for skipped factors
SKIPPED = -1

_INCOME_TYPES: frozenset[str] = frozenset({
    TransactionType.INCOME.value,
    TransactionType.DEPOSIT.value,
})
_EXPENSE_TYPES: frozenset[str] = frozenset({
    TransactionType.EXPENSE.value,
    TransactionType.EMI_PAYMENT.value,
    TransactionType.INTEREST_PAYMENT.value,
})


# ── Helpers ────────────────────────────────────────────────────────────────

def _clamp100(value: float) -> int:
    return int(max(0.0, min(100.0, value)))


def _is_sufficient_data(db: Session, user_id: int) -> bool:
    """Both conditions must hold: ≥30 days AND ≥5 non-sample transactions."""
    real_txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.is_sample == False,  # noqa: E712
        )
        .order_by(Transaction.date.asc())
        .all()
    )
    if len(real_txns) < SPARSE_MIN_TRANSACTIONS:
        return False
    return (date.today() - real_txns[0].date).days >= SPARSE_MIN_DAYS


def _count_expense_txns(
    db: Session,
    user_id: int,
    start: date,
    end: date,
) -> int:
    """Count (not sum) non-sample expense transactions in [start, end]."""
    return (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.transaction_type.in_(_EXPENSE_TYPES),
            Transaction.is_sample == False,  # noqa: E712
        )
        .count()
    )


def _sum_txns(
    db: Session,
    user_id: int,
    start: date,
    end: date,
    tx_types: frozenset[str],
) -> float:
    rows = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.transaction_type.in_(tx_types),
            Transaction.is_sample == False,  # noqa: E712
        )
        .all()
    )
    return sum(t.amount for t in rows)


def _monthly_expense_buckets(db: Session, user_id: int, n_months: int) -> list[float]:
    """n_months totals (oldest → newest), non-sample expenses only."""
    today = date.today()
    buckets: list[float] = []
    for i in range(n_months - 1, -1, -1):
        ref = today - relativedelta(months=i)
        m_start = ref.replace(day=1)
        last_day = monthrange(ref.year, ref.month)[1]
        m_end = ref.replace(day=last_day)
        buckets.append(_sum_txns(db, user_id, m_start, m_end, _EXPENSE_TYPES))
    return buckets


def _trailing_range(n_months: int) -> tuple[date, date]:
    today = date.today()
    return today - relativedelta(months=n_months), today


# ── Factor functions ───────────────────────────────────────────────────────
# Each returns (sub_score: int, raw_value: str, skipped: bool, skip_reason: str)

def _savings_rate(db: Session, user_id: int) -> tuple[int, str, bool, str]:
    """
    Window: trailing 3 calendar months.
    Skip if COUNT(expense txns in trailing 3m) == 0.
    savings_rate = (income - expenses) / income  →  clamp(rate/0.50 × 100, 0, 100)
    """
    start, end = _trailing_range(3)

    if _count_expense_txns(db, user_id, start, end) == 0:
        return SKIPPED, "N/A", True, "no expense data in trailing 3 months"

    income   = _sum_txns(db, user_id, start, end, _INCOME_TYPES)
    expenses = _sum_txns(db, user_id, start, end, _EXPENSE_TYPES)

    if income <= 0:
        return 0, "0% savings rate (no income recorded)", False, ""

    rate     = (income - expenses) / income
    rate_pct = round(rate * 100, 1)
    raw      = f"{rate_pct}% savings rate (3-month trailing)"
    return _clamp100(rate / SAVINGS_RATE_MAX * 100), raw, False, ""


def _emi_to_income(db: Session, user_id: int) -> tuple[int, str, bool, str]:
    """
    ratio = Σ active EMI amounts / avg_monthly_income(trailing 3m)
    clamp((1 - ratio/0.50) × 100, 0, 100).
    Never skipped.
    """
    start, end = _trailing_range(3)
    income_total = _sum_txns(db, user_id, start, end, _INCOME_TYPES)
    avg_monthly_income = income_total / 3.0

    active_emis = (
        db.query(EmiSchedule)
        .filter(EmiSchedule.user_id == user_id, EmiSchedule.status == "Active")
        .all()
    )
    monthly_emi_total = sum(e.amount for e in active_emis)

    if avg_monthly_income <= 0:
        raw = f"₹{monthly_emi_total:,.0f}/month EMIs (no income data)"
        return 0, raw, False, ""

    ratio     = monthly_emi_total / avg_monthly_income
    ratio_pct = round(ratio * 100, 1)
    raw       = f"{ratio_pct}% of monthly income goes to EMIs"
    return _clamp100((1 - ratio / EMI_RATIO_WORST) * 100), raw, False, ""


def _credit_utilization(db: Session, user_id: int) -> tuple[int, str, bool, str]:
    """
    avg_utilization = mean(balance/limit) across credit cards.
    Skip if no credit card accounts exist.
    clamp((1 - avg_util/0.50) × 100, 0, 100).
    """
    cards = (
        db.query(Account)
        .filter(
            Account.user_id == user_id,
            Account.account_type == AccountType.CREDIT_CARD.value,
            Account.credit_limit.isnot(None),
            Account.credit_limit > 0,
        )
        .all()
    )
    if not cards:
        return SKIPPED, "N/A", True, "no credit cards"

    utils = [compute_account_balance(db, c.id) / c.credit_limit for c in cards]
    avg   = sum(utils) / len(utils)
    pct   = round(avg * 100, 1)
    raw   = f"{pct}% avg credit utilization ({len(cards)} card{'s' if len(cards) > 1 else ''})"
    return _clamp100((1 - avg / CREDIT_UTIL_WORST) * 100), raw, False, ""


def _emergency_fund(db: Session, user_id: int) -> tuple[int, str, bool, str]:
    """
    coverage = (cash + bank) / avg_monthly_expense(trailing 3m).
    Skip if COUNT(expense txns in trailing 3m) == 0 (no baseline).
    clamp(coverage/3.0 × 100, 0, 100).
    """
    start, end = _trailing_range(3)

    if _count_expense_txns(db, user_id, start, end) == 0:
        return SKIPPED, "N/A", True, "no expense baseline in trailing 3 months"

    nw     = compute_net_worth(db, user_id=user_id)
    liquid = nw["cash_balance"] + nw["bank_balance"]

    expenses_3m       = _sum_txns(db, user_id, start, end, _EXPENSE_TYPES)
    avg_monthly_exp   = expenses_3m / 3.0

    if avg_monthly_exp <= 0:
        # expenses exist but sum to zero — treat as insufficient (shouldn't normally occur)
        return SKIPPED, "N/A", True, "expense sum is zero despite transactions existing"

    coverage = liquid / avg_monthly_exp
    raw      = f"{round(coverage, 2)}× monthly expenses covered (₹{liquid:,.0f} liquid)"
    return _clamp100(coverage / EMERGENCY_COVER_MAX * 100), raw, False, ""


def _spend_stability(db: Session, user_id: int) -> tuple[int, str, bool, str]:
    """
    6-month window. CV = std_dev / mean of monthly expense totals.
    Skip if COUNT(expense txns in trailing 6m) == 0.
    clamp((1 - CV) × 100, 0, 100).
    """
    start, end = _trailing_range(6)

    if _count_expense_txns(db, user_id, start, end) == 0:
        return SKIPPED, "N/A", True, "no expense data in trailing 6 months"

    buckets = _monthly_expense_buckets(db, user_id, 6)
    mean    = sum(buckets) / 6
    if mean <= 0:
        return SKIPPED, "N/A", True, "expense sum is zero despite transactions existing"

    variance = sum((x - mean) ** 2 for x in buckets) / 6
    cv       = math.sqrt(variance) / mean
    raw      = f"CV = {round(cv * 100, 1)}% month-to-month variance (6 months)"
    return _clamp100((1 - cv / SPEND_CV_WORST) * 100), raw, False, ""


# ── Weight redistribution ──────────────────────────────────────────────────

def _redistribute_weights(
    results: list[tuple[str, int, str, bool, str]]
) -> dict[str, float]:
    """
    Exact formula (user-approved 2026-06-28):
        effective_weight_i = original_weight_i / (1 - Σ skipped_weights)
        for all non-skipped factors.
    Returns {factor_key: effective_weight}.
    """
    skipped_weight_sum = sum(
        WEIGHTS[key] for (key, _, _, skipped, _) in results if skipped
    )
    remaining_denominator = 1.0 - skipped_weight_sum
    effective: dict[str, float] = {}
    for (key, _, _, skipped, _) in results:
        if skipped:
            effective[key] = 0.0
        else:
            # Guard against edge case of all factors being skipped
            effective[key] = (
                WEIGHTS[key] / remaining_denominator
                if remaining_denominator > 0
                else 0.0
            )
    return effective


# ── Public API ─────────────────────────────────────────────────────────────

def compute_health_score(db: Session, user_id: int) -> dict:
    """
    Compute the 5-factor financial health score.

    Returns:
        {
          "score": int (0-100, or 0 when is_sufficient_data=False),
          "is_sufficient_data": bool,
          "factors": list[dict]   — all 5 factors always present;
                                    skipped ones have sub_score=-1, weighted_score=-1
        }
    """
    if not _is_sufficient_data(db, user_id):
        return {"score": 0, "is_sufficient_data": False, "factors": []}

    # Compute all 5 factors
    raw_results: list[tuple[str, int, str, bool, str]] = [
        ("savings_rate",       *_savings_rate(db, user_id)),
        ("emi_to_income",      *_emi_to_income(db, user_id)),
        ("credit_utilization", *_credit_utilization(db, user_id)),
        ("emergency_fund",     *_emergency_fund(db, user_id)),
        ("spend_stability",    *_spend_stability(db, user_id)),
    ]
    # raw_results: (key, sub_score, raw_value, skipped, skip_reason)

    effective_weights = _redistribute_weights(raw_results)

    DISPLAY_NAMES = {
        "savings_rate":       "Savings Rate",
        "emi_to_income":      "EMI-to-Income Ratio",
        "credit_utilization": "Credit Utilization",
        "emergency_fund":     "Emergency Fund Coverage",
        "spend_stability":    "Spend Stability",
    }

    factors = []
    final_score_float = 0.0

    for (key, sub_score, raw_value, skipped, skip_reason) in raw_results:
        ew = effective_weights[key]
        if skipped:
            # sub_score=-1, weighted_score=-1 are the "N/A" sentinels
            factors.append({
                "name":           DISPLAY_NAMES[key],
                "weight":         WEIGHTS[key],
                "raw_value":      f"N/A — {skip_reason}",
                "sub_score":      SKIPPED,    # -1
                "weighted_score": float(SKIPPED),  # -1.0
            })
        else:
            weighted = round(sub_score * ew, 4)
            final_score_float += weighted
            factors.append({
                "name":           DISPLAY_NAMES[key],
                "weight":         WEIGHTS[key],
                "raw_value":      raw_value,
                "sub_score":      sub_score,
                "weighted_score": round(weighted, 2),
            })

    final_score = max(0, min(100, round(final_score_float)))

    return {
        "score":               final_score,
        "is_sufficient_data":  True,
        "factors":             factors,
    }
