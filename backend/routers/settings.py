"""Settings router — org settings, user management, password change."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt as _bcrypt
import uuid

from database import get_db
from dependencies import get_current_user, require_roles
from models.user import User, VALID_ROLES
from models.org import Organization

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
