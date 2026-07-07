from sqlalchemy.orm import Session
from app.models import Account, Transaction

def compute_account_running_balances(db: Session, user_id: int) -> dict[int, list[dict]]:
    """
    Calculate the running balance chronologically for each of the user's accounts.
    Returns:
        dict: { account_id: [ { "transaction_id": int, "date": str, "description": str, "amount": float, "type": str, "running_balance": float }, ... ] }
    """
    # Fetch all user accounts
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    results = {}

    for acc in accounts:
        # Fetch all transactions involving this account, ordered by date desc, id desc (newest first)
        txns = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                (Transaction.from_account_id == acc.id) | (Transaction.to_account_id == acc.id)
            )
            .order_by(Transaction.date.desc(), Transaction.id.desc())
            .all()
        )

        # We compute balances walking BACKWARDS in time starting from current_balance
        running_list = []
        current_val = acc.current_balance or 0.0

        for t in txns:
            # Record current value as the balance AFTER this transaction
            balance_after = current_val

            # Determine if this was an inflow or outflow to adjust current_val for the PREVIOUS step
            is_inflow = (t.to_account_id == acc.id)
            is_outflow = (t.from_account_id == acc.id)

            if is_inflow and is_outflow:
                # This shouldn't normally happen, but if it does (e.g. transfer to self), balance doesn't change
                pass
            elif is_inflow:
                # Balance before was lower
                current_val -= t.amount
            elif is_outflow:
                # Balance before was higher
                current_val += t.amount

            running_list.append({
                "transaction_id": t.id,
                "date": str(t.date),
                "description": t.description or f"{t.transaction_type} transaction",
                "amount": t.amount,
                "type": "inflow" if is_inflow else "outflow",
                "running_balance": round(balance_after, 2)
            })

        # Reverse the list so it is in chronological order (oldest first)
        running_list.reverse()
        results[acc.id] = running_list

    return results
