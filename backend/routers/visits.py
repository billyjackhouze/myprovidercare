"""Visits router — visit lifecycle, GPS check-in, HIPAA signature, photo end."""
from fastapi import APIRouter, Depends
from dependencies import get_current_user

router = APIRouter()


@router.get("")
async def list_visits(current_user=Depends(get_current_user)):
    # TODO: implement
    return []
