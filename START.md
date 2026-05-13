# NationalCM — Start Guide

## Quick Start (Development)

### 1. Database
```bash
# Create PostgreSQL database
createdb nationalcm
psql nationalcm < database/migrations/001_initial_schema.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY and database credentials

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

### 3. Frontend (dev server)
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
# API proxied to http://localhost:8080
```

### 4. Frontend (production build → served by FastAPI)
```bash
cd frontend
npm run build
# Writes to backend/dist/
# FastAPI serves the SPA — visit http://localhost:8080
```

## Windows Server (Production)
Same as PreAuthPro:
```powershell
# Start backend
cd C:\NationalCM\backend
uvicorn main:app --host 0.0.0.0 --port 8080

# nginx proxies :8443 → :8080 (same config pattern as PreAuthPro)
```

## Forms Engine
1. Navigate to **Forms Engine** in the sidebar
2. Click **Ingest New Form**
3. Drag-and-drop a PNG/JPG/PDF screenshot of any paper form
4. Claude Vision extracts every field, section, and input type
5. Review and edit the extracted fields (change types, add options, mark required)
6. Choose a workflow trigger (e.g. "On visit start")
7. Save — the form schema is stored and ready for digital submissions

## Architecture
- **Backend**: FastAPI + uvicorn on port 8080
- **Frontend**: React 18 + Vite (builds to `backend/dist/`)
- **Database**: PostgreSQL 15 + PostGIS
- **AI**: Anthropic Claude (claude-sonnet-4-6) for form ingestion + note polishing
- **Design**: Matches PreAuthPro exactly — same colors, components, typography
