"""Clients router — full CRUD with search, filtering, medications, treatment plans."""
import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user, require_supervisor_or_above
from models.client import Client, ClientMedication, ClientTreatmentPlan, DropdownOption

router = APIRouter()


# ─── Pydantic schemas ────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    first_name: str
    last_name: str
    salutation: str | None = None
    middle_name: str | None = None
    suffix: str | None = None
    date_of_birth: str | None = None
    birth_year: int | None = None
    ssn: str | None = None
    ssn_last4: str | None = None
    gender: str | None = None
    gender_expression: str | None = None
    gender_identifier: str | None = None
    gender_orientation: str | None = None
    marital_status: str | None = None
    race: str | None = None
    ethnicity: str | None = None
    phone: str | None = None
    email: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    county: str | None = None
    sda: str | None = None
    medicaid_id: str | None = None
    medicare_id: str | None = None
    subscriber_id: str | None = None
    ins_vendor: str | None = None
    psych_name: str | None = None
    pcp_name: str | None = None
    primary_care_physician: str | None = None
    psychiatric_provider: str | None = None
    on_a_lai: bool = False
    lai_medication: str | None = None
    injection_dates: str | None = None
    loc: str | None = None
    chart_id: str | None = None
    hit_list: bool = False
    legal_guardian: str | None = None
    mc_note2: str | None = None
    pt_status: str = "active"
    pre_auth_status: str | None = None
    pre_auth_cm1: str | None = None
    pre_auth_cm2: str | None = None
    pre_auth_ansa: str | None = None
    diagnosis_codes: list = []
    emergency_contact: dict = {}
    notes: str | None = None
    assigned_cm_id: str | None = None


class ClientUpdate(ClientCreate):
    first_name: str | None = None
    last_name: str | None = None
    last_ansa_date: str | None = None
    exp_ansa_date: str | None = None
    last_bios_date: str | None = None
    exp_bios_date: str | None = None
    last_tp_date: str | None = None
    exp_tp_date: str | None = None
    last_pn_date: str | None = None
    last_auth_start_date: str | None = None
    last_auth_end_date: str | None = None
    auth_hrs_units: float | None = None
    avail_hrs_units: float | None = None
    intake_date: str | None = None
    discharge_date: str | None = None
    last_visit_date: str | None = None


class MedicationCreate(BaseModel):
    name: str
    route: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    indication: str | None = None
    prescribing_md: str | None = None
    is_active: bool = True
    start_date: str | None = None
    end_date: str | None = None
    notes: str | None = None


class TreatmentPlanUpdate(BaseModel):
    problem: str | None = None
    goals: str | None = None
    objective: str | None = None
    interventions: str | None = None
    target_date: str | None = None
    status: str | None = None


def _client_dict(c: Client) -> dict:
    """Serialize a Client ORM object to a JSON-safe dict."""
    return {
        "id": str(c.id),
        "org_id": str(c.org_id),
        "salutation": c.salutation,
        "first_name": c.first_name,
        "middle_name": c.middle_name,
        "last_name": c.last_name,
        "suffix": c.suffix,
        "full_name": c.full_name,
        "display_name": c.display_name,
        "date_of_birth": str(c.date_of_birth) if c.date_of_birth else None,
        "birth_year": c.birth_year,
        "ssn_last4": c.ssn_last4,
        "gender": c.gender,
        "gender_expression": c.gender_expression,
        "gender_identifier": c.gender_identifier,
        "gender_orientation": c.gender_orientation,
        "marital_status": c.marital_status,
        "race": c.race,
        "ethnicity": c.ethnicity,
        "birthday_65th": str(c.birthday_65th) if c.birthday_65th else None,
        "phone": c.phone,
        "email": c.email,
        "address_line1": c.address_line1,
        "address_line2": c.address_line2,
        "city": c.city,
        "state": c.state,
        "zip_code": c.zip_code,
        "county": c.county,
        "sda": c.sda,
        "medicaid_id": c.medicaid_id,
        "medicare_id": c.medicare_id,
        "subscriber_id": c.subscriber_id,
        "ins_vendor": c.ins_vendor,
        "psych_name": c.psych_name,
        "pcp_name": c.pcp_name,
        "primary_care_physician": c.primary_care_physician,
        "psychiatric_provider": c.psychiatric_provider,
        "on_a_lai": c.on_a_lai,
        "lai_medication": c.lai_medication,
        "injection_dates": c.injection_dates,
        "loc": c.loc,
        "chart_id": c.chart_id,
        "hit_list": c.hit_list,
        "legal_guardian": c.legal_guardian,
        "mc_note2": c.mc_note2,
        "pt_status": c.pt_status,
        "status": c.status,
        "is_active": c.is_active,
        "intake_date": str(c.intake_date) if c.intake_date else None,
        "discharge_date": str(c.discharge_date) if c.discharge_date else None,
        "last_visit_date": str(c.last_visit_date) if c.last_visit_date else None,
        "pre_auth_status": c.pre_auth_status,
        "pre_auth_cm1": c.pre_auth_cm1,
        "pre_auth_cm2": c.pre_auth_cm2,
        "pre_auth_ansa": c.pre_auth_ansa,
        "last_ansa_date": str(c.last_ansa_date) if c.last_ansa_date else None,
        "exp_ansa_date": str(c.exp_ansa_date) if c.exp_ansa_date else None,
        "last_bios_date": str(c.last_bios_date) if c.last_bios_date else None,
        "exp_bios_date": str(c.exp_bios_date) if c.exp_bios_date else None,
        "last_tp_date": str(c.last_tp_date) if c.last_tp_date else None,
        "exp_tp_date": str(c.exp_tp_date) if c.exp_tp_date else None,
        "last_pn_date": str(c.last_pn_date) if c.last_pn_date else None,
        "last_auth_start_date": str(c.last_auth_start_date) if c.last_auth_start_date else None,
        "last_auth_end_date": str(c.last_auth_end_date) if c.last_auth_end_date else None,
        "auth_hrs_units": float(c.auth_hrs_units) if c.auth_hrs_units else None,
        "avail_hrs_units": float(c.avail_hrs_units) if c.avail_hrs_units else None,
        "diagnosis_codes": c.diagnosis_codes or [],
        "emergency_contact": c.emergency_contact or {},
        "notes": c.notes,
        "assigned_cm_id": str(c.assigned_cm_id) if c.assigned_cm_id else None,
        "photo_s3_key": c.photo_s3_key,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "medications": [_med_dict(m) for m in (c.medications or [])],
        "treatment_plans": [_plan_dict(p) for p in (c.treatment_plans or [])],
    }


def _med_dict(m: ClientMedication) -> dict:
    return {
        "id": str(m.id),
        "name": m.name,
        "route": m.route,
        "dosage": m.dosage,
        "frequency": m.frequency,
        "indication": m.indication,
        "prescribing_md": m.prescribing_md,
        "is_active": m.is_active,
        "start_date": str(m.start_date) if m.start_date else None,
        "end_date": str(m.end_date) if m.end_date else None,
        "notes": m.notes,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


def _plan_dict(p: ClientTreatmentPlan) -> dict:
    return {
        "id": str(p.id),
        "plan_number": p.plan_number,
        "problem": p.problem,
        "goals": p.goals,
        "objective": p.objective,
        "interventions": p.interventions,
        "target_date": str(p.target_date) if p.target_date else None,
        "status": p.status,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ─── Client list ─────────────────────────────────────────────────────────────

@router.get("")
async def list_clients(
    q: str | None = Query(None, description="Search by name, Medicaid ID, phone, chart ID"),
    pt_status: str = Query("active", description="Filter by pt_status; pass 'all' for no filter"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Client).where(Client.org_id == current_user.org_id)

    if pt_status != "all":
        stmt = stmt.where(Client.pt_status == pt_status)

    if q:
        term = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Client.first_name).like(term),
                func.lower(Client.last_name).like(term),
                func.lower(func.concat(Client.first_name, " ", Client.last_name)).like(term),
                func.lower(func.concat(Client.last_name, ", ", Client.first_name)).like(term),
                func.lower(Client.medicaid_id).like(term),
                func.lower(Client.chart_id).like(term),
                func.lower(Client.phone).like(term),
            )
        )

    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Paginated results — order by last name
    stmt = stmt.order_by(Client.last_name, Client.first_name)
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(stmt)).scalars().all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "clients": [
            {
                "id": str(c.id),
                "display_name": c.display_name,
                "full_name": c.full_name,
                "pt_status": c.pt_status,
                "medicaid_id": c.medicaid_id,
                "chart_id": c.chart_id,
                "phone": c.phone,
                "date_of_birth": str(c.date_of_birth) if c.date_of_birth else None,
                "last_visit_date": str(c.last_visit_date) if c.last_visit_date else None,
                "assigned_cm_id": str(c.assigned_cm_id) if c.assigned_cm_id else None,
                "photo_s3_key": c.photo_s3_key,
                "loc": c.loc,
                "hit_list": c.hit_list,
                "diagnosis_codes": c.diagnosis_codes or [],
            }
            for c in rows
        ],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_none=True)
    if "assigned_cm_id" in data and data["assigned_cm_id"]:
        data["assigned_cm_id"] = uuid.UUID(data["assigned_cm_id"])
    client = Client(org_id=current_user.org_id, **data)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return _client_dict(client)


@router.get("/{client_id}")
async def get_client(
    client_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_or_404(client_id, current_user.org_id, db)
    return _client_dict(client)


@router.put("/{client_id}")
async def update_client(
    client_id: str,
    body: ClientUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_or_404(client_id, current_user.org_id, db)
    data = body.model_dump(exclude_none=True)
    if "assigned_cm_id" in data and data["assigned_cm_id"]:
        data["assigned_cm_id"] = uuid.UUID(data["assigned_cm_id"])
    for k, v in data.items():
        setattr(client, k, v)
    await db.commit()
    await db.refresh(client)
    return _client_dict(client)


# ─── Medications ─────────────────────────────────────────────────────────────

@router.get("/{client_id}/medications")
async def list_medications(
    client_id: str,
    active_only: bool = Query(True),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_or_404(client_id, current_user.org_id, db)
    stmt = select(ClientMedication).where(
        ClientMedication.client_id == uuid.UUID(client_id),
        ClientMedication.org_id == current_user.org_id,
    )
    if active_only:
        stmt = stmt.where(ClientMedication.is_active == True)
    stmt = stmt.order_by(ClientMedication.name)
    meds = (await db.execute(stmt)).scalars().all()
    return [_med_dict(m) for m in meds]


@router.post("/{client_id}/medications", status_code=status.HTTP_201_CREATED)
async def add_medication(
    client_id: str,
    body: MedicationCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_or_404(client_id, current_user.org_id, db)
    med = ClientMedication(
        org_id=current_user.org_id,
        client_id=uuid.UUID(client_id),
        created_by=current_user.id,
        updated_by=current_user.id,
        **body.model_dump(exclude_none=True),
    )
    db.add(med)
    await db.commit()
    await db.refresh(med)
    return _med_dict(med)


@router.put("/{client_id}/medications/{med_id}")
async def update_medication(
    client_id: str,
    med_id: str,
    body: MedicationCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    med = await _get_med_or_404(med_id, client_id, current_user.org_id, db)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(med, k, v)
    med.updated_by = current_user.id
    await db.commit()
    await db.refresh(med)
    return _med_dict(med)


@router.delete("/{client_id}/medications/{med_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medication(
    client_id: str,
    med_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    med = await _get_med_or_404(med_id, client_id, current_user.org_id, db)
    await db.delete(med)
    await db.commit()


# ─── Treatment Plans ─────────────────────────────────────────────────────────

@router.get("/{client_id}/treatment-plans")
async def get_treatment_plans(
    client_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_or_404(client_id, current_user.org_id, db)
    stmt = select(ClientTreatmentPlan).where(
        ClientTreatmentPlan.client_id == uuid.UUID(client_id),
        ClientTreatmentPlan.org_id == current_user.org_id,
    ).order_by(ClientTreatmentPlan.plan_number)
    plans = (await db.execute(stmt)).scalars().all()
    # Ensure all 4 plan slots are returned (empty if not yet created)
    plan_map = {p.plan_number: _plan_dict(p) for p in plans}
    return [
        plan_map.get(n, {"plan_number": n, "problem": None, "goals": None,
                         "objective": None, "interventions": None,
                         "target_date": None, "status": "active"})
        for n in range(1, 5)
    ]


@router.put("/{client_id}/treatment-plans/{plan_number}")
async def upsert_treatment_plan(
    client_id: str,
    plan_number: int,
    body: TreatmentPlanUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if plan_number not in range(1, 5):
        raise HTTPException(status_code=400, detail="plan_number must be 1–4")
    await _get_or_404(client_id, current_user.org_id, db)

    stmt = select(ClientTreatmentPlan).where(
        ClientTreatmentPlan.client_id == uuid.UUID(client_id),
        ClientTreatmentPlan.plan_number == plan_number,
    )
    plan = (await db.execute(stmt)).scalar_one_or_none()
    if plan is None:
        plan = ClientTreatmentPlan(
            org_id=current_user.org_id,
            client_id=uuid.UUID(client_id),
            plan_number=plan_number,
            created_by=current_user.id,
        )
        db.add(plan)

    for k, v in body.model_dump(exclude_none=True).items():
        setattr(plan, k, v)
    plan.updated_by = current_user.id
    await db.commit()
    await db.refresh(plan)
    return _plan_dict(plan)


# ─── Dropdown options ────────────────────────────────────────────────────────

@router.get("/dropdowns/{page_key}")
async def get_dropdowns(
    page_key: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(DropdownOption).where(
        DropdownOption.org_id == current_user.org_id,
        DropdownOption.page_key == page_key,
        DropdownOption.is_active == True,
    ).order_by(DropdownOption.field_key, DropdownOption.sort_order)
    opts = (await db.execute(stmt)).scalars().all()
    result: dict[str, list] = {}
    for o in opts:
        result.setdefault(o.field_key, []).append({"label": o.label, "value": o.value})
    return result


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_or_404(client_id: str, org_id: uuid.UUID, db: AsyncSession) -> Client:
    try:
        cid = uuid.UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Client not found")
    client = (
        await db.execute(
            select(Client).where(Client.id == cid, Client.org_id == org_id)
        )
    ).scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


async def _get_med_or_404(
    med_id: str, client_id: str, org_id: uuid.UUID, db: AsyncSession
) -> ClientMedication:
    med = (
        await db.execute(
            select(ClientMedication).where(
                ClientMedication.id == uuid.UUID(med_id),
                ClientMedication.client_id == uuid.UUID(client_id),
                ClientMedication.org_id == org_id,
            )
        )
    ).scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    return med
