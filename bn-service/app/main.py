"""FastAPI application – ALAC Wheelchair Bayesian Network inference service."""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers.inference import router as inference_router

app = FastAPI(
    title="ALAC Wheelchair BN Service",
    description="Bayesian Network inference API for NHS wheelchair referral screening",
    version="0.1.0",
)

# ── CORS ────────────────────────────────────────────────────────────────────

_DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

cors_env = os.getenv("CORS_ORIGIN", "")
origins = [o.strip() for o in cors_env.split(",") if o.strip()] if cors_env else _DEFAULT_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API key guard ───────────────────────────────────────────────────────────

_API_KEY = os.getenv("BN_API_KEY", "")


@app.middleware("http")
async def check_api_key(request: Request, call_next):
    if not _API_KEY:
        return await call_next(request)
    if request.url.path in ("/health", "/docs", "/openapi.json", "/redoc"):
        return await call_next(request)
    key = request.headers.get("x-api-key", "")
    if key != _API_KEY:
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing API key"})
    return await call_next(request)


# ── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "alac-wheelchair-bn"}


app.include_router(inference_router)
