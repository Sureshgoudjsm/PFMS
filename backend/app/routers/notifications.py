"""notifications.py — GET list + PATCH read endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database import get_db
from app.models import Notification, User
from app.schemas import NotificationResponse

router = APIRouter(tags=["Notifications"])


@router.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List up to 50 notifications: unread first, then recent read."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(
            Notification.read_at.is_(None).desc(),  # unread first
            Notification.created_at.desc(),
        )
        .limit(50)
        .all()
    )


# NOTE: /read-all must be registered BEFORE /{notification_id}/read
# so FastAPI matches the literal path before the path parameter.
@router.patch("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all of the current user's unread notifications as read."""
    now = datetime.utcnow()
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read_at.is_(None),
    ).update({"read_at": now})
    db.commit()
    return {"status": "ok"}


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_one_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    n = db.get(Notification, notification_id)
    if not n or n.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    if n.read_at is None:
        n.read_at = datetime.utcnow()
        db.commit()
        db.refresh(n)
    return n
