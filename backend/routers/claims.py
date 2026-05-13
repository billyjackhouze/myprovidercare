"""Claims router — 837P generation, Office Ally submission, ERA 835 receipt."""
from fastapi import APIRouter, Depends
from dependencies import get_current_user, require_billing

router = APIRouter()


@router.get("")
async def list_claims(current_user=Depends(get_current_user)):
    return []
