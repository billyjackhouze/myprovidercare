"""Workflow router — org tab configuration and client form responses."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user, require_supervisor_or_above

router = APIRouter()


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class TabUpdate(BaseModel):
    label: str | None = None
    is_visible: bool | None = None
    sort_order: int | None = None


class TabsReorder(BaseModel):
    """List of {tab_key, sort_order, is_visible} for bulk reorder."""
    tabs: list[dict]


class FormResponseUpsert(BaseModel):
    response_data: dict
    status: str = "draft"


# ─── Workflow tab config ──────────────────────────────────────────────────────

@router.get("/tabs")
async def get_workflow_tabs(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the org's ordered tab list. Seeds defaults if none exist yet."""
    rows = (await db.execute(text("""
        SELECT id, tab_key, label, tab_type, form_schema_id,
               sort_order, is_visible, is_locked
        FROM workflow_tabs
        WHERE org_id = :org_id
        ORDER BY sort_order, label
    """), {"org_id": str(current_user.org_id)})).mappings().all()

    if not rows:
        # Seed defaults on first access
        await db.execute(text("""
            INSERT INTO workflow_tabs
                (org_id, tab_key, label, tab_type, sort_order, is_visible, is_locked)
            VALUES
                (:org_id, 'general',     'General Info',       'builtin', 1,  true, true),
                (:org_id, 'intake',      'Intake',             'builtin', 2,  true, false),
                (:org_id, 'referral',    'Referral',           'builtin', 3,  true, false),
                (:org_id, 'hospital',    'Hospital Discharge', 'builtin', 4,  true, false),
                (:org_id, 'auths',       'Auths',              'builtin', 5,  true, false),
                (:org_id, 'superbill',   'Super Bill',         'builtin', 6,  true, false),
                (:org_id, 'therapy',     'Therapy Note',       'builtin', 7,  true, false),
                (:org_id, 'ansa',        'ANSA',               'builtin', 8,  true, false),
                (:org_id, 'treatment',   'Treatment Plan',     'builtin', 9,  true, false),
                (:org_id, 'bio',         'BIO',                'builtin', 10, true, false),
                (:org_id, 'nursing',     'Nursing',            'builtin', 11, true, false),
                (:org_id, 'risk',        'Risk Screening',     'builtin', 12, true, false),
                (:org_id, 'notes',       'Progress Notes',     'builtin', 13, true, false),
                (:org_id, 'appts',       'Appointments',       'builtin', 14, true, false),
                (:org_id, 'attachments', 'Attachments',        'builtin', 15, true, false),
                (:org_id, 'discharge',   'Discharge',          'builtin', 16, true, false),
                (:org_id, 'contacts',    'Contact Notes',      'builtin', 17, true, false)
            ON CONFLICT (org_id, tab_key) DO NOTHING
        """), {"org_id": str(current_user.org_id)})
        await db.commit()
        rows = (await db.execute(text("""
            SELECT id, tab_key, label, tab_type, form_schema_id,
                   sort_order, is_visible, is_locked
            FROM workflow_tabs WHERE org_id = :org_id ORDER BY sort_order, label
        """), {"org_id": str(current_user.org_id)})).mappings().all()

    return [dict(r) for r in rows]


@router.put("/tabs/reorder")
async def reorder_tabs(
    body: TabsReorder,
    current_user=Depends(require_supervisor_or_above),
    db: AsyncSession = Depends(get_db),
):
    """Bulk update sort_order and is_visible for all tabs."""
    for t in body.tabs:
        await db.execute(text("""
            UPDATE workflow_tabs
            SET sort_order = :sort_order,
                is_visible  = :is_visible,
                updated_at  = NOW()
            WHERE org_id = :org_id AND tab_key = :tab_key AND is_locked = false
        """), {
            "org_id": str(current_user.org_id),
            "tab_key": t.get("tab_key"),
            "sort_order": t.get("sort_order", 0),
            "is_visible": t.get("is_visible", True),
        })
    await db.commit()
    return {"ok": True}


@router.put("/tabs/{tab_key}")
async def update_tab(
    tab_key: str,
    body: TabUpdate,
    current_user=Depends(require_supervisor_or_above),
    db: AsyncSession = Depends(get_db),
):
    """Update a single tab's label / visibility."""
    updates = {}
    if body.label is not None:
        updates["label"] = body.label
    if body.is_visible is not None:
        updates["is_visible"] = body.is_visible
    if body.sort_order is not None:
        updates["sort_order"] = body.sort_order

    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["org_id"] = str(current_user.org_id)
    updates["tab_key"] = tab_key

    await db.execute(
        text(f"UPDATE workflow_tabs SET {set_clause}, updated_at=NOW() WHERE org_id=:org_id AND tab_key=:tab_key AND is_locked=false"),
        updates
    )
    await db.commit()
    return {"ok": True}


@router.post("/tabs/custom")
async def add_custom_tab(
    body: dict,
    current_user=Depends(require_supervisor_or_above),
    db: AsyncSession = Depends(get_db),
):
    """Add a custom form as a new tab."""
    form_schema_id = body.get("form_schema_id")
    label = body.get("label", "Custom Form")

    if not form_schema_id:
        raise HTTPException(status_code=400, detail="form_schema_id required")

    # Get current max sort order
    max_order = (await db.execute(text(
        "SELECT COALESCE(MAX(sort_order), 0) FROM workflow_tabs WHERE org_id = :org_id"
    ), {"org_id": str(current_user.org_id)})).scalar_one()

    tab_key = f"custom_{form_schema_id[:8]}"

    await db.execute(text("""
        INSERT INTO workflow_tabs
            (org_id, tab_key, label, tab_type, form_schema_id, sort_order, is_visible)
        VALUES
            (:org_id, :tab_key, :label, 'custom', :form_schema_id, :sort_order, true)
        ON CONFLICT (org_id, tab_key) DO UPDATE SET label=EXCLUDED.label, is_visible=true
    """), {
        "org_id": str(current_user.org_id),
        "tab_key": tab_key,
        "label": label,
        "form_schema_id": form_schema_id,
        "sort_order": max_order + 1,
    })
    await db.commit()
    return {"ok": True, "tab_key": tab_key}


@router.delete("/tabs/{tab_key}")
async def remove_org_tab(
    tab_key: str,
    current_user=Depends(require_supervisor_or_above),
    db: AsyncSession = Depends(get_db),
):
    """Remove any non-locked tab from org defaults."""
    result = await db.execute(text("""
        DELETE FROM workflow_tabs
        WHERE org_id = :org_id AND tab_key = :tab_key AND is_locked = false
        RETURNING id
    """), {"org_id": str(current_user.org_id), "tab_key": tab_key})
    if not result.rowcount:
        raise HTTPException(status_code=404, detail="Tab not found or is locked")
    await db.commit()
    return {"ok": True}


# ─── Client form responses ────────────────────────────────────────────────────

@router.get("/clients/{client_id}/responses/{form_schema_id}")
async def get_form_response(
    client_id: str,
    form_schema_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the latest form response for a client+form combination."""
    row = (await db.execute(text("""
        SELECT id, response_data, status, version, completed_at, updated_at
        FROM client_form_responses
        WHERE org_id = :org_id
          AND client_id = :client_id
          AND form_schema_id = :form_schema_id
        ORDER BY version DESC
        LIMIT 1
    """), {
        "org_id": str(current_user.org_id),
        "client_id": client_id,
        "form_schema_id": form_schema_id,
    })).mappings().first()

    if not row:
        return {"response_data": {}, "status": "draft", "version": 0}
    return dict(row)


@router.put("/clients/{client_id}/responses/{form_schema_id}")
async def upsert_form_response(
    client_id: str,
    form_schema_id: str,
    body: FormResponseUpsert,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save/update a client's form response."""
    import json

    existing = (await db.execute(text("""
        SELECT id, version FROM client_form_responses
        WHERE org_id = :org_id AND client_id = :client_id AND form_schema_id = :form_schema_id
        ORDER BY version DESC LIMIT 1
    """), {
        "org_id": str(current_user.org_id),
        "client_id": client_id,
        "form_schema_id": form_schema_id,
    })).mappings().first()

    completed_at = "NOW()" if body.status == "complete" else "NULL"

    if existing:
        await db.execute(text(f"""
            UPDATE client_form_responses
            SET response_data = CAST(:data AS jsonb),
                status = :status,
                completed_at = {'NOW()' if body.status == 'complete' else 'NULL'},
                updated_by = :user_id,
                updated_at = NOW()
            WHERE id = :id
        """), {
            "id": str(existing["id"]),
            "data": json.dumps(body.response_data),
            "status": body.status,
            "user_id": str(current_user.id),
        })
    else:
        await db.execute(text("""
            INSERT INTO client_form_responses
                (org_id, client_id, form_schema_id, response_data, status, version, created_by, updated_by)
            VALUES
                (:org_id, :client_id, :form_schema_id, CAST(:data AS jsonb), :status, 1, :user_id, :user_id)
        """), {
            "org_id": str(current_user.org_id),
            "client_id": client_id,
            "form_schema_id": form_schema_id,
            "data": json.dumps(body.response_data),
            "status": body.status,
            "user_id": str(current_user.id),
        })

    await db.commit()
    return {"ok": True}


# ─── Per-client tab configuration ────────────────────────────────────────────

@router.get("/clients/{client_id}/tabs")
async def get_client_tabs(
    client_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return this client's tab list. Seeds from org defaults on first access."""
    rows = (await db.execute(text("""
        SELECT id, tab_key, label, tab_type, form_schema_id, sort_order, is_visible
        FROM client_tabs
        WHERE client_id = :cid AND org_id = :oid
        ORDER BY sort_order, label
    """), {"cid": client_id, "oid": str(current_user.org_id)})).mappings().all()

    if not rows:
        # Seed with General Info only — all other tabs are added per-client as needed
        await db.execute(text("""
            INSERT INTO client_tabs
                (org_id, client_id, tab_key, label, tab_type, sort_order, is_visible)
            VALUES (:oid, :cid, 'general', 'General Info', 'builtin', 1, true)
            ON CONFLICT (client_id, tab_key) DO NOTHING
        """), {"cid": client_id, "oid": str(current_user.org_id)})
        await db.commit()
        rows = (await db.execute(text("""
            SELECT id, tab_key, label, tab_type, form_schema_id, sort_order, is_visible
            FROM client_tabs
            WHERE client_id = :cid AND org_id = :oid
            ORDER BY sort_order, label
        """), {"cid": client_id, "oid": str(current_user.org_id)})).mappings().all()

    return [dict(r) for r in rows]


@router.post("/clients/{client_id}/tabs")
async def add_client_tab(
    client_id: str,
    body: dict,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a custom form tab to a specific client."""
    form_schema_id = body.get("form_schema_id")
    label = body.get("label", "Custom Form")
    tab_key = body.get("tab_key") or f"custom_{form_schema_id[:8] if form_schema_id else 'tab'}"

    max_order = (await db.execute(text(
        "SELECT COALESCE(MAX(sort_order), 0) FROM client_tabs WHERE client_id = :cid"
    ), {"cid": client_id})).scalar_one()

    await db.execute(text("""
        INSERT INTO client_tabs
            (org_id, client_id, tab_key, label, tab_type, form_schema_id, sort_order, is_visible)
        VALUES (:oid, :cid, :tab_key, :label, 'custom', :form_schema_id, :sort_order, true)
        ON CONFLICT (client_id, tab_key) DO UPDATE
            SET label = EXCLUDED.label, is_visible = true
    """), {
        "oid": str(current_user.org_id),
        "cid": client_id,
        "tab_key": tab_key,
        "label": label,
        "form_schema_id": form_schema_id,
        "sort_order": max_order + 1,
    })
    await db.commit()
    return {"ok": True, "tab_key": tab_key}


@router.delete("/clients/{client_id}/tabs/{tab_key}")
async def remove_client_tab(
    client_id: str,
    tab_key: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove any tab from a client except General Info."""
    if tab_key == "general":
        raise HTTPException(status_code=400, detail="General Info tab cannot be removed")
    await db.execute(text("""
        DELETE FROM client_tabs
        WHERE client_id = :cid AND org_id = :oid AND tab_key = :tab_key
    """), {"cid": client_id, "oid": str(current_user.org_id), "tab_key": tab_key})
    await db.commit()
    return {"ok": True}


@router.put("/clients/{client_id}/tabs/reorder")
async def reorder_client_tabs(
    client_id: str,
    body: TabsReorder,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reorder a client's tabs."""
    for t in body.tabs:
        await db.execute(text("""
            UPDATE client_tabs SET sort_order = :sort_order, updated_at = NOW()
            WHERE client_id = :cid AND org_id = :oid AND tab_key = :tab_key
        """), {
            "cid": client_id,
            "oid": str(current_user.org_id),
            "tab_key": t.get("tab_key"),
            "sort_order": t.get("sort_order", 0),
        })
    await db.commit()
    return {"ok": True}


# ─── Form submissions (multi-record list-view forms) ─────────────────────────

@router.get("/clients/{client_id}/submissions/{form_id}")
async def list_submissions(
    client_id: str,
    form_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all submissions for a client+form (for list-view forms)."""
    rows = (await db.execute(text("""
        SELECT id, response_data, status, version, created_at, updated_at
        FROM client_form_responses
        WHERE org_id = :oid AND client_id = :cid AND form_schema_id = :fid
        ORDER BY created_at DESC
    """), {
        "oid": str(current_user.org_id),
        "cid": client_id,
        "fid": form_id,
    })).mappings().all()
    result = []
    for r in rows:
        d = dict(r)
        for k in ["id", "created_at", "updated_at"]:
            if d.get(k): d[k] = str(d[k])
        result.append(d)
    return result


@router.post("/clients/{client_id}/submissions/{form_id}")
async def create_submission(
    client_id: str,
    form_id: str,
    body: FormResponseUpsert,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new submission (always inserts a new row)."""
    import json as _json
    row = await db.execute(text("""
        INSERT INTO client_form_responses
            (org_id, client_id, form_schema_id, response_data, status, version, created_by, updated_by)
        VALUES
            (:oid, :cid, :fid, CAST(:data AS jsonb), :status, 1, :uid, :uid)
        RETURNING id
    """), {
        "oid": str(current_user.org_id),
        "cid": client_id,
        "fid": form_id,
        "data": _json.dumps(body.response_data),
        "status": body.status,
        "uid": str(current_user.id),
    })
    await db.commit()
    return {"id": str(row.fetchone()[0])}


@router.get("/clients/{client_id}/submissions/{form_id}/{submission_id}")
async def get_submission(
    client_id: str,
    form_id: str,
    submission_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific submission."""
    row = (await db.execute(text("""
        SELECT id, response_data, status, version, created_at, updated_at
        FROM client_form_responses
        WHERE id = :sid AND client_id = :cid AND org_id = :oid AND form_schema_id = :fid
    """), {
        "sid": submission_id, "cid": client_id,
        "oid": str(current_user.org_id), "fid": form_id,
    })).mappings().first()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "Submission not found")
    d = dict(row)
    for k in ["id", "created_at", "updated_at"]:
        if d.get(k): d[k] = str(d[k])
    return d


@router.put("/clients/{client_id}/submissions/{form_id}/{submission_id}")
async def update_submission(
    client_id: str,
    form_id: str,
    submission_id: str,
    body: FormResponseUpsert,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a specific submission."""
    import json as _json
    await db.execute(text("""
        UPDATE client_form_responses
        SET response_data = CAST(:data AS jsonb),
            status = :status,
            updated_by = :uid,
            updated_at = NOW()
        WHERE id = :sid AND client_id = :cid AND org_id = :oid
    """), {
        "data": _json.dumps(body.response_data),
        "status": body.status,
        "uid": str(current_user.id),
        "sid": submission_id,
        "cid": client_id,
        "oid": str(current_user.org_id),
    })
    await db.commit()
    return {"ok": True}


@router.delete("/clients/{client_id}/submissions/{form_id}/{submission_id}")
async def delete_submission(
    client_id: str,
    form_id: str,
    submission_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific submission."""
    await db.execute(text("""
        DELETE FROM client_form_responses
        WHERE id = :sid AND client_id = :cid AND org_id = :oid
    """), {
        "sid": submission_id, "cid": client_id,
        "oid": str(current_user.org_id),
    })
    await db.commit()
    return {"ok": True}
