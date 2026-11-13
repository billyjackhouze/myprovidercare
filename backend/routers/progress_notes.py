"""Progress note router: visit clock, lock, reopen, addenda, PN2 and screening drafts.

Every rule is enforced in PostgreSQL (migrations 016 to 018). This router only:
  1. sets the transaction-local `nc.user_id` so the database knows who is writing,
  2. calls the nc_* functions or writes through the guarded tables,
  3. turns the database's refusal codes into HTTP status codes.
Nothing here decides times, locks or permissions.
"""
import re
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user

router = APIRouter()

# ── Error mapping ───────────────────────────────────────────────────────────────
_FORBIDDEN = {
    "NOT_YOUR_VISIT", "NOT_NOTE_AUTHOR", "NOT_ALLOWED", "AUTHOR_CANNOT_REOPEN_OWN_NOTE",
    "CANNOT_COUNTERSIGN_OWN_ADDENDUM", "NO_USER_CONTEXT",
}
_NOT_FOUND = {"VISIT_NOT_FOUND", "NOTE_NOT_FOUND", "ADDENDUM_NOT_FOUND", "USER_NOT_FOUND"}
_CODE = re.compile(r"\b([A-Z][A-Z0-9_]{3,})\b")


def _raise_http(exc: DBAPIError) -> None:
    """Translate a database refusal (RAISE EXCEPTION 'CODE: detail') into an HTTP error."""
    msg = str(getattr(exc, "orig", exc))
    if isinstance(exc, IntegrityError) and "uq_capture_photo_hash" in msg:
        raise HTTPException(409, {"code": "PHOTO_ALREADY_USED",
                                  "message": "That photo has already been used to close a note."})
    m = _CODE.search(msg.split("\n")[0].split(">:")[-1])
    code = m.group(1) if m else "DATABASE_ERROR"
    if code in _NOT_FOUND:
        status = 404
    elif code in _FORBIDDEN:
        status = 403
    elif code == "DATABASE_ERROR":
        status = 400
    else:
        status = 409
    detail = msg.split("\n")[0].split(">:")[-1].strip()
    raise HTTPException(status, {"code": code, "message": detail})


async def _as_user(db: AsyncSession, user) -> None:
    """Make the database aware of the acting user for this transaction only."""
    await db.execute(text("SELECT set_config('nc.user_id', :u, true)"), {"u": str(user.id)})


# ── Request bodies ──────────────────────────────────────────────────────────────
class Capture(BaseModel):
    """What the device reports. The server keeps its own clock; these are evidence."""
    mutation_id: uuid.UUID                       # idempotency key, one per tap
    device_id: Optional[uuid.UUID] = None
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    accuracy_m: Optional[float] = Field(None, ge=0)
    device_clock_at: Optional[datetime] = None
    device_elapsed_ms: Optional[int] = Field(None, ge=0)


class StopCapture(Capture):
    photo_hash: str = Field(..., min_length=64, max_length=64)   # SHA-256 of the camera image
    photo_key: Optional[str] = Field(None, max_length=500)
    camera_only: bool


class ReopenBody(BaseModel):
    reason: str = Field(..., min_length=3)


class AddendumBody(BaseModel):
    reason: str = Field(..., min_length=3)
    changes: Dict[str, Any] = {}
    signature_event_id: uuid.UUID
    new_start: Optional[datetime] = None
    new_end: Optional[datetime] = None


_GPS = ("CASE WHEN CAST(:lat AS double precision) IS NULL THEN NULL "
        "ELSE ST_SetSRID(ST_MakePoint(CAST(:lng AS double precision), CAST(:lat AS double precision)), 4326) END")


def _cap_params(c: Capture) -> dict:
    return {
        "device": c.device_id, "lat": c.lat, "lng": c.lng, "acc": c.accuracy_m,
        "dc": c.device_clock_at, "el": c.device_elapsed_ms, "mut": c.mutation_id,
    }


# ── Visit clock ─────────────────────────────────────────────────────────────────
@router.post("/visits/{visit_id}/clock/start")
async def start_clock(visit_id: uuid.UUID, body: Capture,
                      db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """HIPAA signature captured: the contact starts at the server's time."""
    try:
        await _as_user(db, user)
        r = await db.execute(text(f"""
            SELECT nc_start_clock(:visit, :user, CAST(:device AS uuid), {_GPS},
                   CAST(:acc AS numeric), CAST(:dc AS timestamptz), CAST(:el AS bigint),
                   CAST(:mut AS uuid)) AS event_id"""),
            {"visit": visit_id, "user": user.id, **_cap_params(body)})
        ev = r.scalar_one()
        t = await db.execute(text("SELECT hipaa_signed_at FROM visits WHERE id = :v"), {"v": visit_id})
        return {"event_id": ev, "started_at": t.scalar_one()}
    except DBAPIError as e:
        _raise_http(e)


@router.post("/visits/{visit_id}/clock/stop")
async def stop_clock(visit_id: uuid.UUID, body: StopCapture,
                     db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Camera capture arrives: the contact ends at the server's time."""
    try:
        await _as_user(db, user)
        r = await db.execute(text(f"""
            SELECT nc_stop_clock(:visit, :user, CAST(:device AS uuid), {_GPS},
                   CAST(:acc AS numeric), :ph, :pk, :co, CAST(:dc AS timestamptz),
                   CAST(:el AS bigint), CAST(:mut AS uuid)) AS event_id"""),
            {"visit": visit_id, "user": user.id, **_cap_params(body),
             "ph": body.photo_hash, "pk": body.photo_key, "co": body.camera_only})
        ev = r.scalar_one()
        p = await db.execute(text("""
            SELECT v.photo_taken_at, n.credited_minutes, n.closed_correctly, n.submit_due_at
              FROM visits v LEFT JOIN progress_notes n ON n.visit_id = v.id
             WHERE v.id = :v"""), {"v": visit_id})
        row = p.mappings().first()
        return {"event_id": ev, **(dict(row) if row else {})}
    except DBAPIError as e:
        _raise_http(e)


# ── My notes and starting a note ───────────────────────────────────────────────
class StartBody(BaseModel):
    client_id: uuid.UUID


# Required-section rules mirrored from the screen (frontend/src/pages/notes/sections.js).
# Temporary: these move to the form_rules table so the screen and the board share one source.
_REQ_ALL = {
    "header": ["service_location", "stage_of_change"],
    "living": ["environment"],
    "status": ["current_status", "mood_actions_reactions"],
    "plan": ["plan_problem", "plan_goal", "plan_objective", "plan_intervention"],
}
_REQ_ANY = {
    "focus": ["focus_independent_living", "focus_coordination_linkage", "focus_recovery_planning",
              "focus_crisis_prevention", "focus_social_skills", "focus_medication_services"],
    "methods": ["tm_rehearsal", "tm_instructions", "tm_handout", "tm_feedback_shaping", "tm_coaching",
                "tm_prompting", "tm_education", "tm_reinforcement", "tm_practice",
                "tm_educational_video", "tm_active_listening", "tm_motivational_interviewing"],
}


def _filled(v: Any) -> bool:
    return v is not None and v is not False and str(v).strip() != ""


def _completion(pn2: Optional[dict], clock_done: bool) -> tuple:
    """(sections done, sections required) for the board: clock plus the rule-bearing sections."""
    pn2 = pn2 or {}
    done = 1 if clock_done else 0
    for cols in _REQ_ALL.values():
        done += all(_filled(pn2.get(c)) for c in cols)
    for cols in _REQ_ANY.values():
        done += any(_filled(pn2.get(c)) for c in cols)
    done += 0 if (pn2.get("late_entry") and not pn2.get("late_entry_date")) else 1
    return done, 1 + len(_REQ_ALL) + len(_REQ_ANY) + 1


@router.get("/board")
async def note_board(date_from: Optional[date] = None, date_to: Optional[date] = None,
                     see_all: bool = False, client_id: Optional[uuid.UUID] = None,
                     cm_id: Optional[uuid.UUID] = None,
                     db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Status board. Staff see their own notes; reviewer roles see the whole organisation.

    The date is the visit start (or the day the draft was created if the visit has not started).
    `see_all` ignores the date range.
    """
    reviewer = user.role in _REVIEWER_ROLES
    where = ["n.org_id = :org"]
    params: Dict[str, Any] = {"org": user.org_id}
    if not reviewer:
        where.append("n.cm_id = :me"); params["me"] = user.id
    elif cm_id:
        where.append("n.cm_id = :cm"); params["cm"] = cm_id
    if client_id:
        where.append("n.client_id = :cl"); params["cl"] = client_id
    if not see_all:
        if date_from:
            where.append("COALESCE(v.hipaa_signed_at, n.created_at)::date >= :df"); params["df"] = date_from
        if date_to:
            where.append("COALESCE(v.hipaa_signed_at, n.created_at)::date <= :dt"); params["dt"] = date_to
    r = await db.execute(text(f"""
        SELECT n.id, n.visit_id, n.client_id, n.cm_id, n.lock_state, n.submit_due_at, n.credited_minutes,
               n.created_at, n.submitted_late,
               c.first_name AS client_first_name, c.last_name AS client_last_name,
               u.first_name AS cm_first_name, u.last_name AS cm_last_name,
               v.hipaa_signed_at, v.photo_taken_at,
               COALESCE(v.hipaa_signed_at, n.created_at) AS service_at
          FROM progress_notes n
          JOIN visits v ON v.id = n.visit_id
          JOIN clients c ON c.id = n.client_id
          JOIN users u ON u.id = n.cm_id
         WHERE {' AND '.join(where)}
         ORDER BY COALESCE(v.hipaa_signed_at, n.created_at) DESC
         LIMIT 500"""), params)
    rows = [dict(x) for x in r.mappings().all()]
    pn2 = {}
    if rows:
        p = await db.execute(text("SELECT * FROM pn2_data WHERE note_id = ANY(CAST(:ids AS uuid[]))"),
                             {"ids": [str(x["id"]) for x in rows]})
        pn2 = {x["note_id"]: dict(x) for x in p.mappings().all()}
    now = datetime.now(timezone.utc)
    for x in rows:
        clock_done = x["photo_taken_at"] is not None
        if x["lock_state"] == "locked":
            st = "submitted"
        elif x["lock_state"] == "reopened":
            st = "reopened"
        elif not x["hipaa_signed_at"]:
            st = "not_started"
        elif not clock_done:
            st = "in_progress"
        else:
            st = "ready_to_submit"
        x["board_status"] = st
        x["overdue"] = bool(x["submit_due_at"] and x["lock_state"] != "locked" and x["submit_due_at"] < now)
        x["sections_done"], x["sections_required"] = _completion(pn2.get(x["id"]), clock_done)
    return {"notes": rows, "can_see_all_staff": reviewer}


_FILL = {  # values for NOT NULL columns the live tables carry without a database default
    "photo_exif_metadata": "{}", "flag_reasons": "[]", "photo_tamper_flag": "false",
    "is_flagged": "false", "supervisor_reviewed": "false", "approved_for_billing": "false",
    "approved_for_payroll": "false", "ai_gap_analysis": "{}", "prior_note_ids": "[]",
    "is_final": "false", "supervisor_approved": "false", "version": "1",
}


async def _insert_row(db: AsyncSession, table: str, given: Dict[str, Any]) -> Any:
    """INSERT one row, also filling any NOT NULL column that has no default (the live tables differ
    from the migration files). Unknown required columns are reported by name."""
    r = await db.execute(text("""
        SELECT column_name AS c, format_type(a.atttypid, a.atttypmod) AS typ
          FROM information_schema.columns i
          JOIN pg_attribute a ON a.attrelid = CAST(:t AS regclass) AND a.attname = i.column_name
         WHERE i.table_name = :t AND i.is_nullable = 'NO' AND i.column_default IS NULL
           AND i.is_generated = 'NEVER' AND i.is_identity = 'NO'"""), {"t": table})
    need = {row.c: row.typ for row in r}
    vals: Dict[str, Any] = dict(given)
    missing = []
    for c, typ in need.items():
        if c in vals or c == "id":
            continue
        if c in _FILL:
            vals[c] = ("fill", _FILL[c], typ)
        else:
            missing.append(c)
    if missing:
        raise HTTPException(500, {"code": "MISSING_REQUIRED_COLUMNS",
                                  "message": f"{table} needs values for: {', '.join(missing)}"})
    cols, ph, params = [], [], {}
    for i, (c, v) in enumerate(vals.items()):
        cols.append(f'"{c}"')
        if isinstance(v, tuple):
            params[f"v{i}"] = v[1]; ph.append(f"CAST(CAST(:v{i} AS text) AS {v[2]})")
        else:
            params[f"v{i}"] = v; ph.append(f":v{i}")
    res = await db.execute(text(
        f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(ph)}) RETURNING id"), params)
    return res.scalar_one()


@router.post("/start", status_code=201)
async def start_note(body: StartBody, db: AsyncSession = Depends(get_db),
                     user=Depends(get_current_user)):
    """Create the visit and its draft note for one of the user's clients.

    Reuses an unfinished draft for the same client instead of making a second one.
    """
    try:
        await _as_user(db, user)
        c = await db.execute(text(
            "SELECT id, org_id, assigned_cm_id FROM clients WHERE id = :c"), {"c": body.client_id})
        client = c.mappings().first()
        if not client:
            raise HTTPException(404, {"code": "CLIENT_NOT_FOUND", "message": "Client not found"})
        if client["org_id"] != user.org_id:
            raise HTTPException(404, {"code": "CLIENT_NOT_FOUND", "message": "Client not found"})
        if client["assigned_cm_id"] != user.id and user.role not in _REVIEWER_ROLES:
            raise HTTPException(403, {"code": "NOT_ALLOWED", "message": "Client is not assigned to you"})
        ex = await db.execute(text("""
            SELECT n.id, n.visit_id FROM progress_notes n JOIN visits v ON v.id = n.visit_id
             WHERE n.cm_id = :u AND n.client_id = :c AND n.lock_state <> 'locked'
               AND v.photo_taken_at IS NULL
             ORDER BY n.created_at DESC LIMIT 1"""), {"u": user.id, "c": body.client_id})
        row = ex.mappings().first()
        if row:
            return {"note_id": row["id"], "visit_id": row["visit_id"], "reused": True}
        visit_id = await _insert_row(db, "visits", {
            "org_id": client["org_id"], "client_id": body.client_id, "cm_id": user.id})
        note_id = await _insert_row(db, "progress_notes", {
            "visit_id": visit_id, "org_id": client["org_id"], "cm_id": user.id,
            "client_id": body.client_id})
        return {"note_id": note_id, "visit_id": visit_id, "reused": False}
    except DBAPIError as e:
        _raise_http(e)


# ── Note state, submit, reopen ──────────────────────────────────────────────────
_REVIEWER_ROLES = ("team_lead", "supervisor", "owner", "admin", "developer", "auditor")


async def _note_row(db: AsyncSession, note_id: uuid.UUID, user) -> dict:
    r = await db.execute(text("""
        SELECT n.id, n.visit_id, n.client_id, n.cm_id, n.org_id, n.status, n.lock_state, n.note_type,
               n.submit_due_at, n.submitted_late, n.closed_correctly, n.credited_minutes,
               c.first_name AS client_first_name, c.last_name AS client_last_name,
               v.hipaa_signed_at, v.photo_taken_at
          FROM progress_notes n
          JOIN visits v ON v.id = n.visit_id
          JOIN clients c ON c.id = n.client_id
         WHERE n.id = :n"""), {"n": note_id})
    row = r.mappings().first()
    if not row:
        raise HTTPException(404, {"code": "NOTE_NOT_FOUND", "message": "Note not found"})
    if row["cm_id"] != user.id and user.role not in _REVIEWER_ROLES:
        raise HTTPException(403, {"code": "NOT_ALLOWED", "message": "Not your note"})
    return dict(row)


@router.get("/{note_id}")
async def get_note_state(note_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                         user=Depends(get_current_user)):
    return await _note_row(db, note_id, user)


@router.post("/{note_id}/submit")
async def submit_note(note_id: uuid.UUID, body: Capture,
                      db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Staff sign and submit: the whole note locks."""
    try:
        await _as_user(db, user)
        r = await db.execute(text(f"""
            SELECT nc_submit_note(:note, :user, CAST(:device AS uuid), {_GPS},
                   CAST(:acc AS numeric), CAST(:dc AS timestamptz), CAST(:el AS bigint),
                   CAST(:mut AS uuid)) AS event_id"""),
            {"note": note_id, "user": user.id, **_cap_params(body)})
        ev = r.scalar_one()
        return {"event_id": ev, **(await _note_row(db, note_id, user))}
    except DBAPIError as e:
        _raise_http(e)


@router.post("/{note_id}/reopen")
async def reopen_note(note_id: uuid.UUID, body: ReopenBody,
                      db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Team lead and above reopen an accidental or rejected submit. Time stays frozen."""
    try:
        await _as_user(db, user)
        r = await db.execute(text("SELECT nc_reopen_note(:n, :u, :reason)"),
                             {"n": note_id, "u": user.id, "reason": body.reason})
        rid = r.scalar_one()
        return {"reopen_id": rid, **(await _note_row(db, note_id, user))}
    except DBAPIError as e:
        _raise_http(e)


# ── Addenda ─────────────────────────────────────────────────────────────────────
@router.post("/{note_id}/addenda/signature")
async def addendum_signature(note_id: uuid.UUID, body: Capture,
                             db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Record the signing event an addendum must cite. The server stamps the time."""
    try:
        await _as_user(db, user)
        note = await _note_row(db, note_id, user)
        r = await db.execute(text(f"""
            INSERT INTO capture_events (org_id, note_id, user_id, device_id, kind, gps, gps_accuracy_m,
                                        device_clock_at, device_elapsed_ms, mutation_id)
            VALUES (:org, :note, :user, CAST(:device AS uuid), 'addendum_signature', {_GPS},
                    CAST(:acc AS numeric), CAST(:dc AS timestamptz), CAST(:el AS bigint), CAST(:mut AS uuid))
            RETURNING id"""),
            {"org": note["org_id"], "note": note_id, "user": user.id, **_cap_params(body)})
        return {"signature_event_id": r.scalar_one()}
    except DBAPIError as e:
        _raise_http(e)


@router.post("/{note_id}/addenda")
async def add_addendum(note_id: uuid.UUID, body: AddendumBody,
                       db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Signed addendum on a locked note. A time change needs the supervisor-only permission."""
    import json
    try:
        await _as_user(db, user)
        r = await db.execute(text("""
            SELECT nc_add_addendum(:n, :u, :reason, CAST(:changes AS jsonb), :sig,
                   CAST(:ns AS timestamptz), CAST(:ne AS timestamptz))"""),
            {"n": note_id, "u": user.id, "reason": body.reason, "changes": json.dumps(body.changes),
             "sig": body.signature_event_id, "ns": body.new_start, "ne": body.new_end})
        return {"addendum_id": r.scalar_one()}
    except DBAPIError as e:
        _raise_http(e)


@router.post("/addenda/{addendum_id}/countersign")
async def countersign(addendum_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                      user=Depends(get_current_user)):
    """A supervisor countersigns; a time change is applied to the visit only now."""
    try:
        await _as_user(db, user)
        await db.execute(text("SELECT nc_countersign_addendum(:a, :u)"),
                         {"a": addendum_id, "u": user.id})
        return {"addendum_id": addendum_id, "status": "countersigned"}
    except DBAPIError as e:
        _raise_http(e)


# ── PN2 and screening drafts (written through the lock guard) ───────────────────
_SCREENINGS = {
    "fall_risk": "screening_fall_risk",
    "broset": "screening_broset",
    "phq9": "screening_phq9",
    "columbia": "screening_columbia",
}
_FIXED = {"id", "note_id", "org_id", "created_at", "updated_at"}
_col_cache: Dict[str, Dict[str, str]] = {}
_has_updated_at: Dict[str, bool] = {}


async def _columns(db: AsyncSession, table: str) -> Dict[str, str]:
    """Writable columns of a note table and their SQL types. Generated columns are excluded,
    so totals and bands can never be written, only recomputed by the database."""
    if table not in _col_cache:
        r = await db.execute(text("""
            SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS typ
              FROM pg_attribute a
             WHERE a.attrelid = CAST(:t AS regclass) AND a.attnum > 0
               AND NOT a.attisdropped AND a.attgenerated = ''"""), {"t": table})
        rows = list(r)
        _has_updated_at[table] = any(row.name == "updated_at" for row in rows)
        _col_cache[table] = {row.name: row.typ for row in rows if row.name not in _FIXED}
    return _col_cache[table]


def _as_text(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)


async def _upsert(db: AsyncSession, table: str, note_id: uuid.UUID, user, fields: Dict[str, Any]) -> dict:
    cols = await _columns(db, table)
    unknown = sorted(set(fields) - set(cols))
    if unknown:
        raise HTTPException(422, {"code": "UNKNOWN_FIELDS", "message": ", ".join(unknown)})
    note = await _note_row(db, note_id, user)
    await _as_user(db, user)
    names = list(fields)
    params: Dict[str, Any] = {"note": note_id, "org": note["org_id"]}
    values = []
    for i, n in enumerate(names):
        params[f"p{i}"] = _as_text(fields[n])
        values.append(f"CAST(CAST(:p{i} AS text) AS {cols[n]})")
    col_sql = ", ".join(f'"{n}"' for n in names)
    ins_cols = "note_id, org_id" + (", " + col_sql if names else "")
    ins_vals = ":note, :org" + (", " + ", ".join(values) if names else "")
    upd = ", ".join(f'"{n}" = EXCLUDED."{n}"' for n in names)
    if _has_updated_at.get(table):
        upd = (upd + ", " if upd else "") + "updated_at = NOW()"
    elif not upd:
        upd = "note_id = EXCLUDED.note_id"
    try:
        await db.execute(text(
            f"INSERT INTO {table} ({ins_cols}) VALUES ({ins_vals}) "
            f"ON CONFLICT (note_id) DO UPDATE SET {upd}"), params)
    except DBAPIError as e:
        _raise_http(e)
    r = await db.execute(text(f"SELECT * FROM {table} WHERE note_id = :n"), {"n": note_id})
    return dict(r.mappings().first())


async def _read(db: AsyncSession, table: str, note_id: uuid.UUID, user) -> dict:
    await _note_row(db, note_id, user)
    r = await db.execute(text(f"SELECT * FROM {table} WHERE note_id = :n"), {"n": note_id})
    row = r.mappings().first()
    return dict(row) if row else {}


@router.get("/{note_id}/pn2")
async def get_pn2(note_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    data = await _read(db, "pn2_data", note_id, user)
    m = await db.execute(text("SELECT row_no, name, route, dosage, frequency, indication, prescribing_md "
                              "FROM pn2_medications WHERE note_id = :n ORDER BY row_no"), {"n": note_id})
    return {"pn2": data, "medications": [dict(x) for x in m.mappings()]}


@router.put("/{note_id}/pn2")
async def put_pn2(note_id: uuid.UUID, fields: Dict[str, Any],
                  db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Save any subset of PN2 fields. Refused with NOTE_LOCKED once submitted."""
    return await _upsert(db, "pn2_data", note_id, user, fields)


@router.put("/{note_id}/pn2/medications/{row_no}")
async def put_medication(note_id: uuid.UUID, row_no: int, fields: Dict[str, Any],
                         db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    if not 1 <= row_no <= 7:
        raise HTTPException(422, {"code": "BAD_ROW", "message": "row_no must be 1 to 7"})
    allowed = {"name", "route", "dosage", "frequency", "indication", "prescribing_md"}
    unknown = sorted(set(fields) - allowed)
    if unknown:
        raise HTTPException(422, {"code": "UNKNOWN_FIELDS", "message": ", ".join(unknown)})
    note = await _note_row(db, note_id, user)
    await _as_user(db, user)
    names = list(fields)
    params: Dict[str, Any] = {"note": note_id, "row": row_no}
    cols = ", ".join(names)
    vals = ", ".join(f":v{i}" for i in range(len(names)))
    for i, n in enumerate(names):
        params[f"v{i}"] = _as_text(fields[n])
    upd = ", ".join(f"{n} = EXCLUDED.{n}" for n in names) or "row_no = EXCLUDED.row_no"
    try:
        await db.execute(text(
            f"INSERT INTO pn2_medications (note_id, row_no{', ' + cols if names else ''}) "
            f"VALUES (:note, :row{', ' + vals if names else ''}) "
            f"ON CONFLICT (note_id, row_no) DO UPDATE SET {upd}"), params)
    except DBAPIError as e:
        _raise_http(e)
    return {"note_id": note_id, "row_no": row_no, "lock_state": note["lock_state"]}


@router.get("/{note_id}/screenings/{kind}")
async def get_screening(note_id: uuid.UUID, kind: str, db: AsyncSession = Depends(get_db),
                        user=Depends(get_current_user)):
    if kind not in _SCREENINGS:
        raise HTTPException(404, {"code": "UNKNOWN_SCREENING", "message": kind})
    return await _read(db, _SCREENINGS[kind], note_id, user)


@router.put("/{note_id}/screenings/{kind}")
async def put_screening(note_id: uuid.UUID, kind: str, fields: Dict[str, Any],
                        db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Answers only. Totals and risk bands are generated columns and are returned, never accepted."""
    if kind not in _SCREENINGS:
        raise HTTPException(404, {"code": "UNKNOWN_SCREENING", "message": kind})
    return await _upsert(db, _SCREENINGS[kind], note_id, user, fields)
