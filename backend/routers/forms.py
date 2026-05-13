"""
Forms Engine Router
-------------------
POST /api/forms/ingest       — Upload a form image/PDF, Claude Vision extracts fields
POST /api/forms/ingest/save  — Approve & persist extracted schema to DB
GET  /api/forms              — List forms for the current org
GET  /api/forms/{form_id}    — Get form with sections & fields
POST /api/forms              — Create form manually
PUT  /api/forms/{form_id}    — Update form metadata
DELETE /api/forms/{form_id}  — Deactivate form

POST /api/forms/{form_id}/submissions  — Submit a completed form
GET  /api/forms/{form_id}/submissions  — List submissions for a form
"""
import base64
import io
import json
import uuid
import mimetypes
from typing import Optional
from pathlib import Path

import anthropic
from fastapi import APIRouter, Depends, File, Form as FormParam, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from dependencies import get_current_user, require_supervisor_or_above
from models.forms import Form, FormSection, FormField, FormWorkflow, FormSubmission
from models.user import User

router = APIRouter()

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ExtractedFieldOption(BaseModel):
    label: str
    value: str


class ExtractedField(BaseModel):
    field_key: str
    label: str
    field_type: str
    section_key: str
    order_index: int
    is_required: bool = False
    options: list[ExtractedFieldOption] = []
    placeholder: Optional[str] = None
    ai_confidence: Optional[float] = None
    print_x: Optional[float] = None
    print_y: Optional[float] = None
    print_width: Optional[float] = None
    print_height: Optional[float] = None


class ExtractedSection(BaseModel):
    section_key: str
    title: str
    order_index: int
    is_repeating: bool = False


class IngestionResult(BaseModel):
    form_name: str
    form_type: str
    sections: list[ExtractedSection]
    fields: list[ExtractedField]
    ai_model: str
    confidence_avg: float
    raw_response: dict


class SaveFormRequest(BaseModel):
    form_name: str
    form_type: str
    description: Optional[str] = None
    sections: list[ExtractedSection]
    fields: list[ExtractedField]
    ai_extraction_raw: dict
    source_file_s3_key: Optional[str] = None
    workflow_trigger: Optional[str] = None


class FormResponse(BaseModel):
    id: uuid.UUID
    name: str
    form_type: Optional[str]
    description: Optional[str]
    version: int
    is_active: bool
    ai_extracted: bool
    section_count: int
    field_count: int

    class Config:
        from_attributes = True


# ── Claude Vision prompt ──────────────────────────────────────────────────────

EXTRACTION_SYSTEM_PROMPT = """You are a healthcare form analyzer specializing in mental health and community-based services documentation. Your job is to analyze images of paper forms and extract their structure so they can be digitized.

For each form image, extract:
1. The form name and type (progress note, intake, HIPAA consent, treatment plan, incident report, mileage log, etc.)
2. Every section heading and its fields
3. For each field: its label, the best field_type from the allowed list, whether it appears required, any predefined options (for dropdowns/checkboxes/radio buttons), and its approximate position as a percentage of the image dimensions (print_x, print_y = top-left corner %, print_width, print_height = % of image)

ALLOWED field_types: text, textarea, number, email, phone, date, time, datetime, dropdown, radio, checkbox, multi_select, boolean, signature, photo, gps_capture, file_upload, client_name, cm_name, visit_date, visit_time, visit_duration, auth_number, service_code, calculated, hidden

SYSTEM FIELD MAPPINGS — use these field_types for common healthcare fields:
- Client name → client_name
- Case manager / staff name → cm_name
- Date of service / visit date → visit_date
- Start time → visit_time
- Duration / total time → visit_duration
- Authorization number → auth_number
- Procedure / service code → service_code
- Any signature line → signature

Generate field_key as snake_case from the label (e.g. "Date of Birth" → "date_of_birth").
Group fields into sections. If there are no explicit sections, use "general" as the section_key.
Assign order_index sequentially within each section (0-based).

Return ONLY valid JSON in this exact structure:
{
  "form_name": "string",
  "form_type": "string",
  "sections": [
    {
      "section_key": "snake_case_key",
      "title": "Display Title",
      "order_index": 0,
      "is_repeating": false
    }
  ],
  "fields": [
    {
      "field_key": "snake_case_key",
      "label": "Field Label",
      "field_type": "text",
      "section_key": "section_key",
      "order_index": 0,
      "is_required": false,
      "options": [],
      "placeholder": null,
      "ai_confidence": 0.95,
      "print_x": 5.2,
      "print_y": 12.8,
      "print_width": 45.0,
      "print_height": 3.5
    }
  ]
}"""


# ── Helper: call Claude Vision ────────────────────────────────────────────────

async def extract_fields_with_claude(image_bytes: bytes, media_type: str) -> dict:
    """Send image to Claude Vision and return parsed extraction result."""
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    b64_image = base64.standard_b64encode(image_bytes).decode("utf-8")

    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=4096,
        system=EXTRACTION_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64_image,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Please analyze this form and extract all fields and sections. Return only valid JSON.",
                    },
                ],
            }
        ],
    )

    raw_text = message.content[0].text.strip()

    # Strip markdown code fences if Claude wrapped it
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Claude returned non-JSON response: {e}. Raw: {raw_text[:300]}",
        )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/ingest", response_model=IngestionResult)
async def ingest_form(
    file: UploadFile = File(..., description="Form image (PNG/JPG) or PDF"),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a paper form scan. Claude Vision analyzes it and returns
    the extracted field structure for review before saving.
    The caller reviews/edits the result, then calls POST /forms/ingest/save.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    # Read upload
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:  # 20 MB limit
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    media_type = file.content_type or "image/png"

    # If PDF, extract first page as image using Pillow/pypdf
    if media_type == "application/pdf" or (file.filename or "").lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
            from PIL import Image as PILImage

            reader = PdfReader(io.BytesIO(contents))
            if len(reader.pages) == 0:
                raise HTTPException(status_code=400, detail="PDF has no pages")

            # Extract first page image if available; otherwise use raw bytes for Claude
            # (Claude can handle PDF pages as images when base64-encoded)
            # For now pass the PDF bytes directly — Claude handles PDFs too
            media_type = "application/pdf"
        except ImportError:
            pass  # pypdf not available in dev; proceed with raw bytes

    # Send to Claude Vision
    extracted = await extract_fields_with_claude(contents, media_type)

    # Calculate average confidence
    fields_with_conf = [f for f in extracted.get("fields", []) if f.get("ai_confidence")]
    confidence_avg = (
        sum(f["ai_confidence"] for f in fields_with_conf) / len(fields_with_conf)
        if fields_with_conf
        else 0.85
    )

    return IngestionResult(
        form_name=extracted.get("form_name", file.filename or "Untitled Form"),
        form_type=extracted.get("form_type", "unknown"),
        sections=[ExtractedSection(**s) for s in extracted.get("sections", [])],
        fields=[ExtractedField(**f) for f in extracted.get("fields", [])],
        ai_model=settings.CLAUDE_MODEL,
        confidence_avg=round(confidence_avg, 2),
        raw_response=extracted,
    )


@router.post("/ingest/save", response_model=FormResponse, status_code=201)
async def save_ingested_form(
    body: SaveFormRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Persist the reviewed/edited extraction result as a Form schema in the DB.
    Called after the user reviews the fields on the Form Ingestion page.
    """
    # Create form
    form = Form(
        org_id=current_user.org_id,
        name=body.form_name,
        form_type=body.form_type,
        description=body.description,
        ai_extracted=True,
        ai_extraction_model=settings.CLAUDE_MODEL,
        ai_extraction_raw=body.ai_extraction_raw,
        source_file_s3_key=body.source_file_s3_key,
        created_by=current_user.id,
    )
    db.add(form)
    await db.flush()  # get form.id

    # Create sections
    section_map: dict[str, uuid.UUID] = {}
    for sec in body.sections:
        section = FormSection(
            org_id=current_user.org_id,
            form_id=form.id,
            section_key=sec.section_key,
            title=sec.title,
            order_index=sec.order_index,
            is_repeating=sec.is_repeating,
        )
        db.add(section)
        await db.flush()
        section_map[sec.section_key] = section.id

    # Create fields
    for fld in body.fields:
        field = FormField(
            org_id=current_user.org_id,
            form_id=form.id,
            section_id=section_map.get(fld.section_key),
            field_key=fld.field_key,
            label=fld.label,
            field_type=fld.field_type,
            order_index=fld.order_index,
            is_required=fld.is_required,
            options=[o.model_dump() for o in fld.options],
            placeholder=fld.placeholder,
            ai_confidence=fld.ai_confidence,
            print_x=fld.print_x,
            print_y=fld.print_y,
            print_width=fld.print_width,
            print_height=fld.print_height,
        )
        db.add(field)

    # Optional: create workflow if trigger specified
    if body.workflow_trigger:
        workflow = FormWorkflow(
            org_id=current_user.org_id,
            form_id=form.id,
            name=f"{body.form_name} — {body.workflow_trigger}",
            trigger_event=body.workflow_trigger,
        )
        db.add(workflow)

    await db.commit()
    await db.refresh(form)

    return FormResponse(
        id=form.id,
        name=form.name,
        form_type=form.form_type,
        description=form.description,
        version=form.version,
        is_active=form.is_active,
        ai_extracted=form.ai_extracted,
        section_count=len(body.sections),
        field_count=len(body.fields),
    )


@router.get("", response_model=list[FormResponse])
async def list_forms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active forms for the current org."""
    result = await db.execute(
        select(Form).where(
            Form.org_id == current_user.org_id,
            Form.is_active == True,
        ).order_by(Form.created_at.desc())
    )
    forms = result.scalars().all()

    out = []
    for f in forms:
        section_count = len(f.sections) if hasattr(f, "sections") else 0
        field_count = sum(len(s.fields) for s in (f.sections or []))
        out.append(FormResponse(
            id=f.id,
            name=f.name,
            form_type=f.form_type,
            description=f.description,
            version=f.version,
            is_active=f.is_active,
            ai_extracted=f.ai_extracted,
            section_count=section_count,
            field_count=field_count,
        ))
    return out


@router.get("/{form_id}")
async def get_form(
    form_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a form with all sections and fields, ordered."""
    result = await db.execute(
        select(Form).where(Form.id == form_id, Form.org_id == current_user.org_id)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    sections_out = []
    for sec in sorted(form.sections, key=lambda s: s.order_index):
        fields_out = []
        for fld in sorted(sec.fields, key=lambda f: f.order_index):
            fields_out.append({
                "id": str(fld.id),
                "field_key": fld.field_key,
                "label": fld.label,
                "field_type": fld.field_type,
                "is_required": fld.is_required,
                "options": fld.options,
                "placeholder": fld.placeholder,
                "validation": fld.validation,
                "conditional": fld.conditional,
                "system_field": fld.system_field,
                "ai_confidence": fld.ai_confidence,
            })
        sections_out.append({
            "id": str(sec.id),
            "section_key": sec.section_key,
            "title": sec.title,
            "order_index": sec.order_index,
            "is_repeating": sec.is_repeating,
            "fields": fields_out,
        })

    return {
        "id": str(form.id),
        "name": form.name,
        "form_type": form.form_type,
        "description": form.description,
        "version": form.version,
        "is_active": form.is_active,
        "ai_extracted": form.ai_extracted,
        "sections": sections_out,
    }
