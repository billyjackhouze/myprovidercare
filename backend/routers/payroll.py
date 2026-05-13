"""Payroll router — ADP Data Input API, pre-payroll batch generation."""
from fastapi import APIRouter, Depends
from dependencies import get_current_user, require_supervisor_or_above

router = APIRouter()


@router.get("/periods")
async def list_payroll_periods(current_user=Depends(require_supervisor_or_above())):
    return []
