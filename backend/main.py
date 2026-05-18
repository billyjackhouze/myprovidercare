"""
NationalCM – FastAPI Application Entry Point
Mirrors PreAuthPro stack: FastAPI + uvicorn on port 8080, nginx proxy
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import structlog

from config import settings

# ── Structured logging ────────────────────────────────────────────────────────
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
log = structlog.get_logger()


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("NationalCM starting", env=settings.APP_ENV, port=settings.APP_PORT)
    yield
    log.info("NationalCM shutting down")


app = FastAPI(
    title="NationalCM API",
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request logging middleware ────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    if not request.url.path.startswith("/assets"):
        log.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
        )
    return response


# ── API Routers ───────────────────────────────────────────────────────────────
from routers import auth, forms, clients, visits, users, claims, payroll, dashboard, workflow, intake

app.include_router(auth.router,      prefix="/api/auth",      tags=["Auth"])
app.include_router(users.router,     prefix="/api/users",     tags=["Users"])
app.include_router(clients.router,   prefix="/api/clients",   tags=["Clients"])
app.include_router(intake.router,    prefix="/api/clients",   tags=["Intake"])
app.include_router(visits.router,    prefix="/api/visits",    tags=["Visits"])
app.include_router(forms.router,     prefix="/api/forms",     tags=["Forms Engine"])
app.include_router(claims.router,    prefix="/api/claims",    tags=["Claims"])
app.include_router(payroll.router,   prefix="/api/payroll",   tags=["Payroll"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(workflow.router,  prefix="/api/workflow",  tags=["Workflow"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}


# ── SPA static serving (Vite build → dist/) ───────────────────────────────────
DIST_DIR = Path(__file__).parent / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        index = DIST_DIR / "index.html"
        if index.exists():
            return FileResponse(index)
        return {"detail": "Frontend not built. Run: cd frontend && npm run build"}
