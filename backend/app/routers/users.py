from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.config import get_settings
from app.models.user import User
from app.schemas import UserMeOut

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserMeOut)
async def get_me(current_user: User = Depends(get_current_user)) -> UserMeOut:
    settings = get_settings()
    return UserMeOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        jobTitle=current_user.job_title,
        department=current_user.department,
        isAuthenticated=True,
        isDemo=settings.auth_disabled or current_user.entra_oid == "demo-local",
        tenantId=current_user.entra_oid,
    )
