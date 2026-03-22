"""Inference router – exposes the BN classify/explain endpoints."""

from __future__ import annotations

import sys
import os

# Add the alac-wheelchair-bn package to the Python path so it can be imported
# both when installed via pip and during local development.
_BN_SRC = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "python", "alac-wheelchair-bn", "src"
)
if os.path.isdir(_BN_SRC) and _BN_SRC not in sys.path:
    sys.path.insert(0, os.path.abspath(_BN_SRC))

from fastapi import APIRouter, HTTPException

from alac.inference import classify, explain
from alac.nodes import NODE_STATES

from app.schemas.models import (
    ClassifyRequest,
    ClassifyFromAlecRequest,
    ClassifyResponse,
    ClassifyFromAlecResponse,
)
from app.mapping.alec_mapper import map_alec_to_evidence

router = APIRouter(prefix="/api/bn", tags=["inference"])


def _validate_evidence(evidence: dict[str, str]) -> None:
    """Raise 422 if any evidence key/value is invalid."""
    for node, state in evidence.items():
        if node not in NODE_STATES:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown BN node: '{node}'. Valid nodes: {sorted(NODE_STATES.keys())}",
            )
        valid = NODE_STATES[node]
        if state not in valid:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid state '{state}' for node '{node}'. Valid states: {valid}",
            )


def _run_classify(evidence: dict[str, str], risk_threshold: float) -> dict:
    """Run BN classify and normalise the result for the response model."""
    result = classify(evidence, risk_threshold=risk_threshold)

    pathways = {}
    for node, data in result.get("pathways", {}).items():
        pathways[node] = {
            "state": data["state"],
            "confidence": round(data["confidence"], 4),
            "distribution": {k: round(v, 4) for k, v in data["distribution"].items()},
        }

    hidden = {}
    for node, data in result.get("hidden", {}).items():
        dist = data.get("distribution", {})
        hidden[node] = {
            "state": data["state"],
            "confidence": round(data["confidence"], 4),
            "distribution": {k: round(v, 4) for k, v in dist.items()},
        }

    return {
        "pathways": pathways,
        "hidden": hidden,
        "risks": result.get("risks", []),
        "rules_fired": result.get("rules_fired", []),
        "referrals_all": result.get("referrals_all", ["none"]),
    }


@router.post("/classify", response_model=ClassifyResponse)
async def classify_endpoint(req: ClassifyRequest):
    """Run BN inference with raw evidence keys."""
    _validate_evidence(req.evidence)
    try:
        return _run_classify(req.evidence, req.risk_threshold)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/classify-from-alec", response_model=ClassifyFromAlecResponse)
async def classify_from_alec_endpoint(req: ClassifyFromAlecRequest):
    """Run BN inference from raw ALEC parsed fields (handles mapping)."""
    fields_raw = {k: v.model_dump() for k, v in req.fields.items()}
    evidence, unmapped = map_alec_to_evidence(fields_raw)

    if not evidence:
        raise HTTPException(
            status_code=422,
            detail=f"Could not map any ALEC fields to BN evidence. Unmapped: {unmapped}",
        )

    _validate_evidence(evidence)

    try:
        result = _run_classify(evidence, req.risk_threshold)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {
        **result,
        "mapped_evidence": evidence,
        "unmapped_fields": unmapped,
    }


@router.post("/explain")
async def explain_endpoint(req: ClassifyRequest):
    """Return a human-readable text report from the BN."""
    _validate_evidence(req.evidence)
    try:
        report = explain(req.evidence, risk_threshold=req.risk_threshold)
        return {"report": report}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
