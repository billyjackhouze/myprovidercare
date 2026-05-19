"""
Form Workflow Automation Router
Handles CRUD for automation rules + execution engine that fires on form submission.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Any
import uuid
import httpx
from datetime import datetime, timezone

from database import get_db
from dependencies import get_current_user
from models.user import User

router = APIRouter()

# ── Pydantic models ────────────────────────────────────────────────────────────

class ConditionModel(BaseModel):
    field_key: str
    operator: str       # eq | neq | gt | lt | contains | is_filled | is_empty
    value: Optional[Any] = None

class ActionModel(BaseModel):
    type: str           # notify_user | send_email | create_task | set_field_value | webhook
    config: dict        # type-specific config

class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    form_id: uuid.UUID
    trigger_type: str = "on_submit"         # on_submit | field_change
    trigger_field_key: Optional[str] = None
    conditions: List[ConditionModel] = []
    actions: List[ActionModel] = []
    is_active: bool = True
    order_index: int = 0

class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_field_key: Optional[str] = None
    conditions: Optional[List[ConditionModel]] = None
    actions: Optional[List[ActionModel]] = None
    is_active: Optional[bool] = None
    order_index: Optional[int] = None

class ExecutePayload(BaseModel):
    """Sent by the form submission flow to execute automation rules for a form."""
    form_id: uuid.UUID
    client_id: Optional[uuid.UUID] = None
    field_values: dict                       # { field_key: value, ... }
    trigger_type: str = "on_submit"
    trigger_field_key: Optional[str] = None  # only for field_change triggers


# ── CRUD ───────────────────────────────────────────────────────────────────────

def _rule_to_dict(row) -> dict:
    return {
        "id":                str(row.id),
        "org_id":            str(row.org_id),
        "form_id":           str(row.form_id),
        "name":              row.name,
        "description":       row.description,
        "is_active":         row.is_active,
        "trigger_type":      row.trigger_type,
        "trigger_field_key": row.trigger_field_key,
        "conditions":        row.conditions or [],
        "actions":           row.actions or [],
        "order_index":       row.order_index,
        "created_at":        row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/forms/{form_id}/rules")
async def list_rules(
    form_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        text("""
            SELECT * FROM form_automation_rules
            WHERE org_id = :org_id AND form_id = :form_id
            ORDER BY order_index, created_at
        """),
        {"org_id": current_user.org_id, "form_id": form_id}
    )
    return [_rule_to_dict(r) for r in rows.mappings().all()]


@router.post("/forms/{form_id}/rules", status_code=201)
async def create_rule(
    form_id: uuid.UUID,
    body: RuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import json
    result = await db.execute(
        text("""
            INSERT INTO form_automation_rules
              (org_id, form_id, name, description, trigger_type, trigger_field_key,
               conditions, actions, is_active, order_index, created_by)
            VALUES
              (:org_id, :form_id, :name, :description, :trigger_type, :trigger_field_key,
               CAST(:conditions AS jsonb), CAST(:actions AS jsonb), :is_active, :order_index, :created_by)
            RETURNING *
        """),
        {
            "org_id":            current_user.org_id,
            "form_id":           form_id,
            "name":              body.name,
            "description":       body.description,
            "trigger_type":      body.trigger_type,
            "trigger_field_key": body.trigger_field_key,
            "conditions":        json.dumps([c.model_dump() for c in body.conditions]),
            "actions":           json.dumps([a.model_dump() for a in body.actions]),
            "is_active":         body.is_active,
            "order_index":       body.order_index,
            "created_by":        current_user.id,
        }
    )
    row = result.mappings().first()
    await db.commit()
    return _rule_to_dict(row)


@router.put("/forms/{form_id}/rules/{rule_id}")
async def update_rule(
    form_id: uuid.UUID,
    rule_id: uuid.UUID,
    body: RuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import json
    # Build dynamic SET clause
    updates = {}
    if body.name is not None:              updates["name"] = body.name
    if body.description is not None:       updates["description"] = body.description
    if body.trigger_type is not None:      updates["trigger_type"] = body.trigger_type
    if body.trigger_field_key is not None: updates["trigger_field_key"] = body.trigger_field_key
    if body.is_active is not None:         updates["is_active"] = body.is_active
    if body.order_index is not None:       updates["order_index"] = body.order_index

    # JSON fields need special handling
    json_sets = ""
    json_params = {}
    if body.conditions is not None:
        json_sets += ", conditions = CAST(:conditions AS jsonb)"
        json_params["conditions"] = json.dumps([c.model_dump() for c in body.conditions])
    if body.actions is not None:
        json_sets += ", actions = CAST(:actions AS jsonb)"
        json_params["actions"] = json.dumps([a.model_dump() for a in body.actions])

    if not updates and not json_sets:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates) + json_sets + ", updated_at = NOW()"
    params = {**updates, **json_params, "rule_id": rule_id, "org_id": current_user.org_id, "form_id": form_id}

    result = await db.execute(
        text(f"UPDATE form_automation_rules SET {set_clause} WHERE id = :rule_id AND org_id = :org_id AND form_id = :form_id RETURNING *"),
        params
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.commit()
    return _rule_to_dict(row)


@router.delete("/forms/{form_id}/rules/{rule_id}", status_code=204)
async def delete_rule(
    form_id: uuid.UUID,
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("DELETE FROM form_automation_rules WHERE id = :rule_id AND org_id = :org_id AND form_id = :form_id"),
        {"rule_id": rule_id, "org_id": current_user.org_id, "form_id": form_id}
    )
    await db.commit()


# ── Execution engine ───────────────────────────────────────────────────────────

def _evaluate_condition(cond: dict, field_values: dict) -> bool:
    """Returns True if the condition passes for the given field values."""
    key = cond.get("field_key", "")
    op  = cond.get("operator", "eq")
    val = cond.get("value")
    fv  = field_values.get(key)

    if op == "is_filled":
        return fv not in (None, "", [])
    if op == "is_empty":
        return fv in (None, "", [])

    if fv is None:
        return False

    try:
        if op == "eq":      return str(fv) == str(val)
        if op == "neq":     return str(fv) != str(val)
        if op == "contains": return str(val).lower() in str(fv).lower()
        if op == "gt":      return float(fv) > float(val)
        if op == "lt":      return float(fv) < float(val)
    except (TypeError, ValueError):
        return False

    return False


async def _execute_action(
    action: dict,
    rule: dict,
    payload: ExecutePayload,
    current_user: User,
    db: AsyncSession,
) -> dict:
    """Execute a single action. Returns a result dict."""
    action_type = action.get("type")
    config = action.get("config", {})
    result = {"type": action_type, "status": "ok", "detail": ""}

    try:
        if action_type == "notify_user":
            # Store as a notification — in a real system you'd push to the user's device/email
            # For now, log it (notification system can be expanded later)
            target_user_id = config.get("user_id")
            message = config.get("message", f"Form submitted — rule '{rule['name']}' triggered.")
            result["detail"] = f"Notification queued for user {target_user_id}: {message}"

        elif action_type == "send_email":
            # Placeholder: log the intent. Email sending requires an SMTP/SES integration.
            to = config.get("to", "")
            subject = config.get("subject", f"[NationalCM] {rule['name']}")
            body_tmpl = config.get("body", "A form automation rule was triggered.")
            result["detail"] = f"Email to {to}: {subject}"
            # TODO: integrate with SES / SendGrid once email creds are configured

        elif action_type == "create_task":
            # Create a simple task record (task table not yet built — log intent)
            assigned_to = config.get("assigned_to")
            title = config.get("title", f"Task from rule: {rule['name']}")
            result["detail"] = f"Task '{title}' → user {assigned_to}"

        elif action_type == "set_field_value":
            # Can be used to auto-populate a field on submit
            field_key = config.get("field_key")
            value = config.get("value")
            result["detail"] = f"Set {field_key} = {value}"
            # The caller can inspect the returned actions and apply field changes

        elif action_type == "webhook":
            url = config.get("url", "")
            if url:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.post(url, json={
                        "rule": rule["name"],
                        "form_id": str(payload.form_id),
                        "client_id": str(payload.client_id) if payload.client_id else None,
                        "field_values": payload.field_values,
                        "triggered_at": datetime.now(timezone.utc).isoformat(),
                    })
                    result["detail"] = f"Webhook → {url}: {resp.status_code}"
            else:
                result["detail"] = "No URL configured"

        else:
            result["status"] = "skipped"
            result["detail"] = f"Unknown action type: {action_type}"

    except Exception as e:
        result["status"] = "error"
        result["detail"] = str(e)

    return result


@router.post("/forms/{form_id}/execute")
async def execute_rules(
    form_id: uuid.UUID,
    payload: ExecutePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Called after a form is submitted.
    Evaluates all active rules for the form and executes matching ones.
    Returns a list of which rules fired and their action results.
    """
    import json

    # Load active rules for this form that match the trigger type
    rows = await db.execute(
        text("""
            SELECT * FROM form_automation_rules
            WHERE org_id = :org_id
              AND form_id = :form_id
              AND is_active = TRUE
              AND trigger_type = :trigger_type
            ORDER BY order_index, created_at
        """),
        {
            "org_id":       current_user.org_id,
            "form_id":      form_id,
            "trigger_type": payload.trigger_type,
        }
    )
    rules = list(rows.mappings().all())

    fired = []
    for rule in rules:
        rule_dict = _rule_to_dict(rule)

        # For field_change triggers: only run if the right field changed
        if payload.trigger_type == "field_change":
            if rule_dict["trigger_field_key"] and rule_dict["trigger_field_key"] != payload.trigger_field_key:
                continue

        # Evaluate conditions (ALL must pass — AND logic)
        conditions = rule_dict.get("conditions") or []
        if conditions:
            all_pass = all(_evaluate_condition(c, payload.field_values) for c in conditions)
            if not all_pass:
                continue

        # Execute actions in order
        actions_run = []
        for action in (rule_dict.get("actions") or []):
            action_result = await _execute_action(action, rule_dict, payload, current_user, db)
            actions_run.append(action_result)

        # Log the execution
        await db.execute(
            text("""
                INSERT INTO form_automation_logs
                  (org_id, rule_id, form_id, client_id, triggered_by, status, actions_run)
                VALUES
                  (:org_id, :rule_id, :form_id, :client_id, :triggered_by, 'success', CAST(:actions_run AS jsonb))
            """),
            {
                "org_id":       current_user.org_id,
                "rule_id":      rule_dict["id"],
                "form_id":      str(form_id),
                "client_id":    str(payload.client_id) if payload.client_id else None,
                "triggered_by": str(current_user.id),
                "actions_run":  json.dumps(actions_run),
            }
        )

        fired.append({
            "rule_id":   rule_dict["id"],
            "rule_name": rule_dict["name"],
            "actions":   actions_run,
        })

    await db.commit()
    return {"rules_fired": len(fired), "results": fired}


# ── Run log ───────────────────────────────────────────────────────────────────

@router.get("/forms/{form_id}/automation-log")
async def get_automation_log(
    form_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    rows = await db.execute(
        text("""
            SELECT l.*, r.name as rule_name
            FROM form_automation_logs l
            LEFT JOIN form_automation_rules r ON r.id = l.rule_id
            WHERE l.org_id = :org_id AND l.form_id = :form_id
            ORDER BY l.created_at DESC
            LIMIT :limit
        """),
        {"org_id": current_user.org_id, "form_id": form_id, "limit": limit}
    )
    return [dict(r) for r in rows.mappings().all()]
