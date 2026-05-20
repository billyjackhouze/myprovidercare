"""Settings router — org settings, user management, password change, RBAC."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt as _bcrypt
import uuid
from typing import Optional

from database import get_db
from dependencies import get_current_user, require_roles
from models.user import User, VALID_ROLES
from models.org import Organization
from models.client import ServiceCity, InsuranceEmailRecipient

router = APIRouter()

# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# ── Org endpoints ─────────────────────────────────────────────────────────────

class OrgUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    npi: str | None = None
    tax_id: str | None = None
    medicaid_provider_id: str | None = None


@router.get("/org")
async def get_org(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "phone": org.phone,
        "address_line1": org.address_line1,
        "address_line2": org.address_line2,
        "city": org.city,
        "state": org.state,
        "zip_code": org.zip_code,
        "npi": org.npi,
        "tax_id": org.tax_id,
        "medicaid_provider_id": org.medicaid_provider_id,
    }


@router.put("/org")
async def update_org(
    body: OrgUpdate,
    current_user: User = Depends(require_roles("owner", "supervisor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(org, field, value)

    await db.commit()
    await db.refresh(org)
    return {"ok": True, "name": org.name}


# ── User management endpoints ─────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.org_id == current_user.org_id).order_by(User.first_name)
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


class InviteUser(BaseModel):
    full_name: str
    email: EmailStr
    role: str
    temp_password: str


@router.post("/users/invite", status_code=201)
async def invite_user(
    body: InviteUser,
    current_user: User = Depends(require_roles("owner", "supervisor")),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    # Check for existing email in org
    existing = await db.execute(
        select(User).where(User.email == body.email.lower(), User.org_id == current_user.org_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with that email already exists in this organization")

    # Split full name
    parts = body.full_name.strip().split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""

    new_user = User(
        org_id=current_user.org_id,
        email=body.email.lower(),
        hashed_password=hash_password(body.temp_password),
        first_name=first_name,
        last_name=last_name,
        role=body.role,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return {
        "id": str(new_user.id),
        "full_name": new_user.full_name,
        "email": new_user.email,
        "role": new_user.role,
        "is_active": new_user.is_active,
    }


class RoleUpdate(BaseModel):
    role: str


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: uuid.UUID,
    body: RoleUpdate,
    current_user: User = Depends(require_roles("owner", "supervisor")),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = body.role
    await db.commit()
    return {"ok": True, "role": user.role}


class StatusUpdate(BaseModel):
    is_active: bool


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: uuid.UUID,
    body: StatusUpdate,
    current_user: User = Depends(require_roles("owner", "supervisor")),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own account status")

    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = body.is_active
    await db.commit()
    return {"ok": True, "is_active": user.is_active}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles("owner", "supervisor")),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    await db.commit()
    return {"ok": True}


# ── Password change ───────────────────────────────────────────────────────────

class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.put("/me/password")
async def change_password(
    body: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    current_user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"ok": True}


# ── RBAC: Permissions & Role Defaults ─────────────────────────────────────────

@router.get("/permissions")
async def list_permissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All permissions in the system, grouped by section."""
    rows = await db.execute(
        text("SELECT * FROM permissions ORDER BY order_index, key")
    )
    perms = [dict(r) for r in rows.mappings().all()]
    # Group by section
    sections: dict = {}
    for p in perms:
        sec = p["section"]
        if sec not in sections:
            sections[sec] = []
        sections[sec].append(p)
    return {"permissions": perms, "by_section": sections}


@router.get("/roles")
async def list_role_defaults(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns each role with the permission keys it has by default."""
    rows = await db.execute(
        text("SELECT role, permission_key, granted FROM role_permissions ORDER BY role, permission_key")
    )
    result: dict = {}
    for r in rows.mappings().all():
        role = r["role"]
        if role not in result:
            result[role] = []
        if r["granted"]:
            result[role].append(r["permission_key"])
    return result


class RolePermissionUpdate(BaseModel):
    permission_key: str
    granted: bool


@router.put("/roles/{role}/permissions")
async def update_role_permission(
    role: str,
    body: RolePermissionUpdate,
    current_user: User = Depends(require_roles("developer", "admin", "owner")),
    db: AsyncSession = Depends(get_db),
):
    """Grant or revoke a permission for a role."""
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Unknown role: {role}")

    await db.execute(
        text("""
            INSERT INTO role_permissions (role, permission_key, granted)
            VALUES (:role, :permission_key, :granted)
            ON CONFLICT (role, permission_key) DO UPDATE SET granted = :granted
        """),
        {"role": role, "permission_key": body.permission_key, "granted": body.granted}
    )
    await db.commit()
    return {"ok": True}


# ── RBAC: Per-User Permission Overrides ───────────────────────────────────────

@router.get("/users/{user_id}/permissions")
async def get_user_permissions(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the effective permissions for a user:
    - All permissions from the system
    - Each one has: role_default (T/F), override (granted/denied/null), effective (T/F)
    """
    # Get target user
    user_row = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    target = user_row.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # All permissions
    perm_rows = await db.execute(
        text("SELECT * FROM permissions ORDER BY order_index, key")
    )
    all_perms = {r["key"]: dict(r) for r in perm_rows.mappings().all()}

    # Role defaults for this user's role
    role_rows = await db.execute(
        text("SELECT permission_key, granted FROM role_permissions WHERE role = :role"),
        {"role": target.role}
    )
    role_defaults = {r["permission_key"]: r["granted"] for r in role_rows.mappings().all()}

    # User-specific overrides
    override_rows = await db.execute(
        text("SELECT permission_key, state FROM user_permissions WHERE user_id = :user_id"),
        {"user_id": user_id}
    )
    overrides = {r["permission_key"]: r["state"] for r in override_rows.mappings().all()}

    # Build effective list
    result = []
    for key, perm in all_perms.items():
        role_default = role_defaults.get(key, False)
        override = overrides.get(key)  # 'granted' | 'denied' | None

        if override == "granted":
            effective = True
        elif override == "denied":
            effective = False
        else:
            effective = role_default

        result.append({
            **perm,
            "role_default":  role_default,
            "override":      override,
            "effective":     effective,
        })

    return {
        "user_id":   str(user_id),
        "user_name": target.full_name,
        "role":      target.role,
        "permissions": result,
    }


class UserPermissionOverride(BaseModel):
    permission_key: str
    state: Optional[str] = None  # 'granted' | 'denied' | None (None = remove override)


@router.put("/users/{user_id}/permissions")
async def set_user_permission_override(
    user_id: uuid.UUID,
    body: UserPermissionOverride,
    current_user: User = Depends(require_roles("developer", "admin", "owner", "supervisor")),
    db: AsyncSession = Depends(get_db),
):
    """Set or clear a per-user permission override."""
    # Verify user is in the same org
    user_row = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    if not user_row.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    if body.state is None:
        # Remove override — fall back to role default
        await db.execute(
            text("DELETE FROM user_permissions WHERE user_id = :user_id AND permission_key = :key"),
            {"user_id": user_id, "key": body.permission_key}
        )
    else:
        if body.state not in ("granted", "denied"):
            raise HTTPException(status_code=400, detail="state must be 'granted', 'denied', or null")
        await db.execute(
            text("""
                INSERT INTO user_permissions (org_id, user_id, permission_key, state, granted_by)
                VALUES (:org_id, :user_id, :key, :state, :granted_by)
                ON CONFLICT (user_id, permission_key) DO UPDATE
                  SET state = :state, granted_by = :granted_by
            """),
            {
                "org_id":     current_user.org_id,
                "user_id":    user_id,
                "key":        body.permission_key,
                "state":      body.state,
                "granted_by": current_user.id,
            }
        )

    await db.commit()
    return {"ok": True}


# ── Permission check for current user (used by frontend) ──────────────────────

@router.get("/me/permissions")
async def get_my_permissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns effective permission keys for the authenticated user.
    Frontend uses this to show/hide nav items and UI sections.
    """
    # Role defaults
    role_rows = await db.execute(
        text("SELECT permission_key, granted FROM role_permissions WHERE role = :role"),
        {"role": current_user.role}
    )
    role_defaults = {r["permission_key"]: r["granted"] for r in role_rows.mappings().all()}

    # User overrides
    override_rows = await db.execute(
        text("SELECT permission_key, state FROM user_permissions WHERE user_id = :user_id"),
        {"user_id": current_user.id}
    )
    overrides = {r["permission_key"]: r["state"] for r in override_rows.mappings().all()}

    # Merge: overrides win
    effective = {}
    for key, granted in role_defaults.items():
        override = overrides.get(key)
        if override == "granted":
            effective[key] = True
        elif override == "denied":
            effective[key] = False
        else:
            effective[key] = granted

    # Also apply any overrides for perms not in role defaults
    for key, state in overrides.items():
        if key not in effective:
            effective[key] = state == "granted"

    return {
        "role": current_user.role,
        "permissions": [k for k, v in effective.items() if v],
    }


# ── Service Cities ─────────────────────────────────────────────────────────────

class CityCreate(BaseModel):
    name: str
    sort_order: int = 0

class CityUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


@router.get("/service-cities")
async def list_service_cities(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ServiceCity)
        .where(ServiceCity.org_id == current_user.org_id)
        .order_by(ServiceCity.sort_order, ServiceCity.name)
    )
    cities = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "is_active": c.is_active,
            "sort_order": c.sort_order,
        }
        for c in cities
    ]


@router.post("/service-cities", status_code=201)
async def create_service_city(
    body: CityCreate,
    current_user: User = Depends(require_roles("owner", "admin", "supervisor", "developer")),
    db: AsyncSession = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="City name cannot be blank")

    # Check for duplicate
    existing = await db.execute(
        select(ServiceCity).where(
            ServiceCity.org_id == current_user.org_id,
            ServiceCity.name == name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"City '{name}' already exists")

    city = ServiceCity(
        org_id=current_user.org_id,
        name=name,
        sort_order=body.sort_order,
    )
    db.add(city)
    await db.commit()
    await db.refresh(city)
    return {"id": str(city.id), "name": city.name, "is_active": city.is_active, "sort_order": city.sort_order}


@router.put("/service-cities/{city_id}")
async def update_service_city(
    city_id: uuid.UUID,
    body: CityUpdate,
    current_user: User = Depends(require_roles("owner", "admin", "supervisor", "developer")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ServiceCity).where(
            ServiceCity.id == city_id, ServiceCity.org_id == current_user.org_id
        )
    )
    city = result.scalar_one_or_none()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    if body.name is not None:
        city.name = body.name.strip()
    if body.is_active is not None:
        city.is_active = body.is_active
    if body.sort_order is not None:
        city.sort_order = body.sort_order

    await db.commit()
    return {"ok": True, "id": str(city.id), "name": city.name, "is_active": city.is_active}


@router.delete("/service-cities/{city_id}")
async def delete_service_city(
    city_id: uuid.UUID,
    current_user: User = Depends(require_roles("owner", "admin", "supervisor", "developer")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ServiceCity).where(
            ServiceCity.id == city_id, ServiceCity.org_id == current_user.org_id
        )
    )
    city = result.scalar_one_or_none()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    # Remove this city from any recipient subscriptions
    await db.execute(
        text("""
            UPDATE insurance_email_recipients
            SET subscribed_city_ids = (
                SELECT jsonb_agg(val)
                FROM jsonb_array_elements_text(subscribed_city_ids) AS val
                WHERE val <> :city_id
            )
            WHERE org_id = :org_id
              AND subscribed_city_ids @> :city_id_arr::jsonb
        """),
        {"city_id": str(city_id), "org_id": current_user.org_id, "city_id_arr": f'["{city_id}"]'}
    )

    await db.delete(city)
    await db.commit()
    return {"ok": True}


# ── Insurance Email Recipients ─────────────────────────────────────────────────

class EmailRecipientCreate(BaseModel):
    email: EmailStr
    label: Optional[str] = None
    subscribed_city_ids: list[str] = []   # list of city UUID strings; [] = all cities

class EmailRecipientUpdate(BaseModel):
    email: Optional[EmailStr] = None
    label: Optional[str] = None
    is_active: Optional[bool] = None
    subscribed_city_ids: Optional[list[str]] = None


@router.get("/insurance-emails")
async def list_insurance_email_recipients(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InsuranceEmailRecipient)
        .where(InsuranceEmailRecipient.org_id == current_user.org_id)
        .order_by(InsuranceEmailRecipient.created_at)
    )
    recipients = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "email": r.email,
            "label": r.label,
            "is_active": r.is_active,
            "subscribed_city_ids": r.subscribed_city_ids or [],
        }
        for r in recipients
    ]


@router.post("/insurance-emails", status_code=201)
async def create_insurance_email_recipient(
    body: EmailRecipientCreate,
    current_user: User = Depends(require_roles("owner", "admin", "supervisor", "developer")),
    db: AsyncSession = Depends(get_db),
):
    # Check for duplicate
    existing = await db.execute(
        select(InsuranceEmailRecipient).where(
            InsuranceEmailRecipient.org_id == current_user.org_id,
            InsuranceEmailRecipient.email == body.email.lower(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="That email address is already in the list")

    recipient = InsuranceEmailRecipient(
        org_id=current_user.org_id,
        email=body.email.lower(),
        label=body.label,
        subscribed_city_ids=body.subscribed_city_ids,
        created_by=current_user.id,
    )
    db.add(recipient)
    await db.commit()
    await db.refresh(recipient)
    return {
        "id": str(recipient.id),
        "email": recipient.email,
        "label": recipient.label,
        "is_active": recipient.is_active,
        "subscribed_city_ids": recipient.subscribed_city_ids or [],
    }


@router.put("/insurance-emails/{recipient_id}")
async def update_insurance_email_recipient(
    recipient_id: uuid.UUID,
    body: EmailRecipientUpdate,
    current_user: User = Depends(require_roles("owner", "admin", "supervisor", "developer")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InsuranceEmailRecipient).where(
            InsuranceEmailRecipient.id == recipient_id,
            InsuranceEmailRecipient.org_id == current_user.org_id,
        )
    )
    recipient = result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    if body.email is not None:
        recipient.email = body.email.lower()
    if body.label is not None:
        recipient.label = body.label
    if body.is_active is not None:
        recipient.is_active = body.is_active
    if body.subscribed_city_ids is not None:
        recipient.subscribed_city_ids = body.subscribed_city_ids

    await db.commit()
    return {
        "ok": True,
        "id": str(recipient.id),
        "email": recipient.email,
        "label": recipient.label,
        "is_active": recipient.is_active,
        "subscribed_city_ids": recipient.subscribed_city_ids or [],
    }


@router.delete("/insurance-emails/{recipient_id}")
async def delete_insurance_email_recipient(
    recipient_id: uuid.UUID,
    current_user: User = Depends(require_roles("owner", "admin", "supervisor", "developer")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InsuranceEmailRecipient).where(
            InsuranceEmailRecipient.id == recipient_id,
            InsuranceEmailRecipient.org_id == current_user.org_id,
        )
    )
    recipient = result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    await db.delete(recipient)
    await db.commit()
    return {"ok": True}
