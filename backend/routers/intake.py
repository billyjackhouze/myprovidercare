"""
intake.py — Biopsychosocial Assessment / Intake Visit endpoints
Mounted at /api/clients/{client_id}/intake
"""
from uuid import UUID
from datetime import date, time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
import json

from dependencies import get_db, get_current_user

router = APIRouter()


# ─── Pydantic schemas ────────────────────────────────────────────────────────

class IntakeVisitCreate(BaseModel):
    visit_date:          Optional[date]   = None
    case_manager:        Optional[str]    = None
    visit_start:         Optional[str]    = None   # "HH:MM"
    visit_end:           Optional[str]    = None
    assessor_name:       Optional[str]    = None
    assessor_credentials: Optional[str]  = None
    form_data:           Optional[dict]   = {}
    status:              Optional[str]    = "draft"


class IntakeVisitUpdate(IntakeVisitCreate):
    signed_by:  Optional[str] = None


# ─── Helper: verify client belongs to org ────────────────────────────────────

async def verify_client(client_id: str, org_id: UUID, db: AsyncSession):
    row = await db.execute(
        text("SELECT id FROM clients WHERE id = :cid AND org_id = :oid"),
        {"cid": client_id, "oid": str(org_id)}
    )
    if not row.fetchone():
        raise HTTPException(404, "Client not found")


# ─── List visits ─────────────────────────────────────────────────────────────

@router.get("/{client_id}/intake")
async def list_intake_visits(
    client_id: str,
    db: AsyncSession   = Depends(get_db),
    user               = Depends(get_current_user),
):
    await verify_client(client_id, user.org_id, db)
    rows = await db.execute(
        text("""
            SELECT id, visit_date, case_manager, visit_start, visit_end,
                   status, assessor_name, assessor_credentials,
                   signed_by, signed_at, created_at, updated_at
            FROM client_intake_visits
            WHERE client_id = :cid AND org_id = :oid
            ORDER BY visit_date DESC, visit_start DESC
        """),
        {"cid": client_id, "oid": str(user.org_id)}
    )
    visits = []
    for r in rows.fetchall():
        v = dict(r._mapping)
        # Calculate total time
        if v["visit_start"] and v["visit_end"]:
            try:
                from datetime import datetime
                s = datetime.strptime(str(v["visit_start"])[:5], "%H:%M")
                e = datetime.strptime(str(v["visit_end"])[:5], "%H:%M")
                delta = e - s
                mins = int(delta.total_seconds() / 60)
                v["total_time"] = f"{mins // 60}h {mins % 60}m" if mins >= 60 else f"{mins}m"
            except Exception:
                v["total_time"] = None
        else:
            v["total_time"] = None
        # Stringify UUID/time fields for JSON
        for k in ["id", "signed_at", "created_at", "updated_at"]:
            if v[k] is not None:
                v[k] = str(v[k])
        if v["visit_date"]:
            v["visit_date"] = str(v["visit_date"])
        if v["visit_start"]:
            v["visit_start"] = str(v["visit_start"])[:5]
        if v["visit_end"]:
            v["visit_end"] = str(v["visit_end"])[:5]
        visits.append(v)
    return visits


# ─── Create visit ─────────────────────────────────────────────────────────────

@router.post("/{client_id}/intake")
async def create_intake_visit(
    client_id: str,
    body:      IntakeVisitCreate,
    db:        AsyncSession = Depends(get_db),
    user                    = Depends(get_current_user),
):
    await verify_client(client_id, user.org_id, db)
    row = await db.execute(
        text("""
            INSERT INTO client_intake_visits
              (org_id, client_id, visit_date, case_manager, visit_start, visit_end,
               assessor_name, assessor_credentials, form_data, status)
            VALUES
              (:oid, :cid, :vd, :cm, :vs, :ve, :an, :ac, :fd::jsonb, :st)
            RETURNING id
        """),
        {
            "oid": str(user.org_id),
            "cid": client_id,
            "vd":  body.visit_date or date.today(),
            "cm":  body.case_manager or f"{user.first_name} {user.last_name}".strip(),
            "vs":  body.visit_start,
            "ve":  body.visit_end,
            "an":  body.assessor_name or f"{user.first_name} {user.last_name}".strip(),
            "ac":  body.assessor_credentials,
            "fd":  json.dumps(body.form_data or {}),
            "st":  body.status or "draft",
        }
    )
    await db.commit()
    new_id = str(row.fetchone()[0])
    return {"id": new_id}


# ─── Get single visit ─────────────────────────────────────────────────────────

@router.get("/{client_id}/intake/{visit_id}")
async def get_intake_visit(
    client_id: str,
    visit_id:  str,
    db:        AsyncSession = Depends(get_db),
    user                    = Depends(get_current_user),
):
    await verify_client(client_id, user.org_id, db)
    row = await db.execute(
        text("""
            SELECT id, visit_date, case_manager, visit_start, visit_end,
                   status, assessor_name, assessor_credentials,
                   form_data, signed_by, signed_at, created_at, updated_at
            FROM client_intake_visits
            WHERE id = :vid AND client_id = :cid AND org_id = :oid
        """),
        {"vid": visit_id, "cid": client_id, "oid": str(user.org_id)}
    )
    r = row.fetchone()
    if not r:
        raise HTTPException(404, "Visit not found")
    v = dict(r._mapping)
    for k in ["id", "signed_at", "created_at", "updated_at"]:
        if v[k] is not None:
            v[k] = str(v[k])
    if v["visit_date"]:
        v["visit_date"] = str(v["visit_date"])
    if v["visit_start"]:
        v["visit_start"] = str(v["visit_start"])[:5]
    if v["visit_end"]:
        v["visit_end"] = str(v["visit_end"])[:5]
    return v


# ─── Update visit ─────────────────────────────────────────────────────────────

@router.put("/{client_id}/intake/{visit_id}")
async def update_intake_visit(
    client_id: str,
    visit_id:  str,
    body:      IntakeVisitUpdate,
    db:        AsyncSession = Depends(get_db),
    user                    = Depends(get_current_user),
):
    await verify_client(client_id, user.org_id, db)

    signed_at_clause = ""
    if body.status == "signed" and body.signed_by:
        signed_at_clause = ", signed_at = NOW()"

    await db.execute(
        text(f"""
            UPDATE client_intake_visits SET
                visit_date           = COALESCE(:vd, visit_date),
                case_manager         = COALESCE(:cm, case_manager),
                visit_start          = COALESCE(:vs, visit_start),
                visit_end            = COALESCE(:ve, visit_end),
                assessor_name        = COALESCE(:an, assessor_name),
                assessor_credentials = COALESCE(:ac, assessor_credentials),
                form_data            = :fd::jsonb,
                status               = COALESCE(:st, status),
                signed_by            = COALESCE(:sb, signed_by),
                updated_at           = NOW()
                {signed_at_clause}
            WHERE id = :vid AND client_id = :cid AND org_id = :oid
        """),
        {
            "vd":  body.visit_date,
            "cm":  body.case_manager,
            "vs":  body.visit_start,
            "ve":  body.visit_end,
            "an":  body.assessor_name,
            "ac":  body.assessor_credentials,
            "fd":  json.dumps(body.form_data or {}),
            "st":  body.status,
            "sb":  body.signed_by,
            "vid": visit_id,
            "cid": client_id,
            "oid": str(user.org_id),
        }
    )
    await db.commit()
    return {"ok": True}


# ─── Delete visit ─────────────────────────────────────────────────────────────

@router.delete("/{client_id}/intake/{visit_id}")
async def delete_intake_visit(
    client_id: str,
    visit_id:  str,
    db:        AsyncSession = Depends(get_db),
    user                    = Depends(get_current_user),
):
    await verify_client(client_id, user.org_id, db)
    await db.execute(
        text("DELETE FROM client_intake_visits WHERE id=:vid AND client_id=:cid AND org_id=:oid"),
        {"vid": visit_id, "cid": client_id, "oid": str(user.org_id)}
    )
    await db.commit()
    return {"ok": True}
