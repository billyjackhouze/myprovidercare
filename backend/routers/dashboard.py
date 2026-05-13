"""Dashboard router — stat cards, CM map feed, pending reviews."""
from fastapi import APIRouter, Depends
from dependencies import get_current_user

router = APIRouter()


@router.get("/stats")
async def get_stats(current_user=Depends(get_current_user)):
    # TODO: real queries
    return {
        "active_clients": 0,
        "visits_today": 0,
        "pending_notes": 0,
        "flagged_visits": 0,
        "pending_claims": 0,
        "forms_count": 0,
    }
