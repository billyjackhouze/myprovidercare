"""Users router — CRUD for org users."""
from fastapi import APIRouter, Depends
from dependencies import get_current_user, require_supervisor_or_above

router = APIRouter()


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "org_id": str(current_user.org_id),
    }
