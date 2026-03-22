"""Pydantic request/response models for the BN inference API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ── Request models ──────────────────────────────────────────────────────────

class ClassifyRequest(BaseModel):
    """Direct BN inference – caller supplies evidence using BN node keys."""

    evidence: dict[str, str] = Field(
        ...,
        description="Maps BN node IDs to discrete state values",
        examples=[{"age": "elderly", "diag": "stroke", "seizure": "never"}],
    )
    risk_threshold: float = Field(
        default=0.30,
        ge=0.0,
        le=1.0,
        description="Probability threshold for flagging a risk",
    )


class AlecFieldValue(BaseModel):
    """A single parsed ALEC form field."""

    value: str
    section: str | None = None
    label: str | None = None


class ClassifyFromAlecRequest(BaseModel):
    """ALEC-form inference – caller supplies raw parsed fields from pdfParser."""

    fields: dict[str, AlecFieldValue] = Field(
        ...,
        description="Raw parsed ALEC fields exactly as returned by pdfParser.js",
    )
    risk_threshold: float = Field(default=0.30, ge=0.0, le=1.0)


# ── Response models ─────────────────────────────────────────────────────────

class NodeResult(BaseModel):
    state: str
    confidence: float
    distribution: dict[str, float]


class RiskFlag(BaseModel):
    node: str
    label: str
    state: str
    probability: float


class RuleFired(BaseModel):
    rule: str
    description: str
    action: str


class ClassifyResponse(BaseModel):
    pathways: dict[str, NodeResult]
    hidden: dict[str, NodeResult]
    risks: list[RiskFlag]
    rules_fired: list[RuleFired]
    referrals_all: list[str]


class ClassifyFromAlecResponse(BaseModel):
    """Wraps ClassifyResponse and adds mapping metadata."""

    pathways: dict[str, NodeResult]
    hidden: dict[str, NodeResult]
    risks: list[RiskFlag]
    rules_fired: list[RuleFired]
    referrals_all: list[str]
    mapped_evidence: dict[str, str] = Field(
        description="The BN evidence dict produced from ALEC field mapping",
    )
    unmapped_fields: list[str] = Field(
        description="ALEC fields that could not be mapped to BN nodes",
    )
