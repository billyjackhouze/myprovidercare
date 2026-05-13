"""Clients router — CRUD for client records."""
from fastapi import APIRouter, Depends
from dependencies import get_current_user

router = APIRouter()


@router.get("")
async def list_clients(current_user=Depends(get_current_user)):
    # TODO: implement with pagination, search, filters
    return []
