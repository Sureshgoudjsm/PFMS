from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, UserLogin, TokenResponse, UserUpdate
from app.core.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse)
def register(request: UserCreate, db: Session = Depends(get_db)):
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == request.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Only check email uniqueness if an email was provided
    if request.email:
        existing_email = db.query(User).filter(User.email == request.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

    new_user = User(
        username=request.username,
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        avatar_url=request.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={request.username}"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=TokenResponse)
def login(request: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(data={"sub": user.username, "user_id": user.id})
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    request: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update settings for the authenticated user, including salary day and alert threshold."""
    if request.full_name is not None:
        current_user.full_name = request.full_name
    if request.avatar_url is not None:
        current_user.avatar_url = request.avatar_url
    if request.salary_day is not None:
        # Check if 1-31 or None
        current_user.salary_day = request.salary_day
    elif "salary_day" in request.model_fields_set:
        # Allow explicit nulling
        current_user.salary_day = None

    if request.forecast_alert_threshold is not None:
        current_user.forecast_alert_threshold = request.forecast_alert_threshold

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/telegram-code")
def get_telegram_link_code(current_user: User = Depends(get_current_user)):
    import random
    import string
    import time
    from app.core.telegram_shared import active_linking_codes
    
    # Generate a random 6-character uppercase alphanumeric code
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    # Valid for 10 minutes
    expiry = time.time() + 600.0
    active_linking_codes[code] = (current_user.id, expiry)
    
    return {"code": code, "expires_in_seconds": 600}

