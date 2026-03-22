"""Map raw ALEC Screening Form field values to BN evidence keys.

Each mapper function takes a free-text value string from the PDF parser and
returns the corresponding BN discrete state, or ``None`` when the value cannot
be reliably mapped (the BN will fall back to priors for that node).
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any


# ── Helpers ─────────────────────────────────────────────────────────────────

def _extract_number(text: str) -> float | None:
    """Pull the first decimal / integer number from *text*."""
    m = re.search(r"(\d+\.?\d*)", text)
    return float(m.group(1)) if m else None


def _contains_any(text: str, keywords: list[str]) -> bool:
    return any(kw in text for kw in keywords)


def _cm_to_inches(cm: float) -> float:
    return cm * 0.3937


def _normalise(text: str) -> str:
    return text.strip().lower()


def _detect_unit_and_get_inches(text: str) -> float | None:
    """Extract a measurement and convert to inches if given in cm."""
    num = _extract_number(text)
    if num is None:
        return None
    low = text.lower()
    if "cm" in low or "centim" in low:
        return _cm_to_inches(num)
    # If the number looks like cm (> 40 for height, > 30 for limbs) assume cm
    # unless explicitly marked as inches
    if "in" in low or "inch" in low or '"' in low:
        return num
    return num  # caller decides based on context


# ── Individual field mappers ────────────────────────────────────────────────

def map_age(value: str) -> str | None:
    low = _normalise(value)
    num = _extract_number(low)
    if num is None:
        if _contains_any(low, ["paed", "child", "infant", "baby"]):
            return "paediatric"
        if _contains_any(low, ["elder", "senior", "geriatric", "old"]):
            return "elderly"
        return None
    if num < 18:
        return "paediatric"
    if num > 65:
        return "elderly"
    return "adult"


def map_sex(value: str) -> str | None:
    low = _normalise(value)
    if low.startswith("m"):
        return "male"
    if low.startswith("f"):
        return "female"
    if "inter" in low:
        return "intersex"
    return None


def map_weight(value: str) -> str | None:
    low = _normalise(value)
    if "bariat" in low:
        return "bariatric"
    num = _extract_number(low)
    if num is None:
        return None
    kg = num
    if "lb" in low or "pound" in low:
        kg = num * 0.4536
    if "stone" in low or "st" in low:
        kg = num * 6.3503
    return "bariatric" if kg >= 120 else "standard"


def map_height(value: str) -> str | None:
    num = _detect_unit_and_get_inches(value)
    if num is None:
        return None
    # Heights over 40 are almost certainly in cm
    if num > 40:
        num = _cm_to_inches(num)
    if num < 20:
        return "low_under_20"
    if num <= 21:
        return "standard_20_21"
    return "tall_over_21"


def map_mobility(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["unable", "cannot walk", "no walk", "non-ambulat", "immobil"]):
        return "unable_to_walk"
    if _contains_any(low, ["limit", "reduced", "restricted", "walk"]):
        return "limited_walking"
    return None


def map_posture(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["forward", "anterior"]):
        return "falls_forward"
    if _contains_any(low, ["sideways", "lateral", "side"]):
        return "falls_sideways"
    if _contains_any(low, ["maintain", "stable", "upright", "good", "normal", "can sit"]):
        return "can_maintain_sit"
    if _contains_any(low, ["fall", "unable", "poor", "abnormal"]):
        return "falls_forward"
    return None


def map_seizure(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["none", "never", "no", "nil", "n/a"]):
        return "never"
    if _contains_any(low, ["yes", "12 month", "recent", "active", "last year"]):
        return "in_last_12_months"
    return "never"


def map_hip(value: str) -> str | None:
    num = _detect_unit_and_get_inches(value)
    if num is None:
        return None
    # Hips over 40 are almost certainly cm
    if num > 40:
        num = _cm_to_inches(num)
    if num < 16:
        return "narrow_under_16"
    if num <= 18:
        return "standard_16_18"
    if num <= 20:
        return "wide_18_20"
    return "bariatric_over_20"


def map_leg_upper(value: str) -> str | None:
    num = _detect_unit_and_get_inches(value)
    if num is None:
        return None
    if num > 40:
        num = _cm_to_inches(num)
    if num < 16:
        return "short_under_16"
    if num <= 19:
        return "standard_16_19"
    return "large_over_19"


def map_leg_lower(value: str) -> str | None:
    num = _detect_unit_and_get_inches(value)
    if num is None:
        return None
    if num > 40:
        num = _cm_to_inches(num)
    if num < 16:
        return "short_under_16"
    if num <= 20:
        return "standard_16_20"
    return "large_over_20"


def map_joint_lim(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["unable", "yes", "limit", "restrict", "cannot"]):
        return "unable_to_sit"
    if _contains_any(low, ["able", "no", "none", "nil", "n/a", "normal"]):
        return "able_to_sit"
    return None


def map_self_propel(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["unable", "cannot", "no"]):
        return "unable"
    if _contains_any(low, ["yes", "able", "can", "independent"]):
        return "able"
    return "unknown"


def map_fatigue(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["deterior", "worsen", "declin", "progress", "increas"]):
        return "deteriorates"
    if _contains_any(low, ["stable", "no change", "consistent", "normal"]):
        return "stable"
    return None


def map_transfer(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["independent", "unaided", "self"]):
        return "independent"
    if _contains_any(low, ["dependent", "full", "hoist", "two person", "2 person"]):
        return "dependent"
    if _contains_any(low, ["assist", "help", "one person", "1 person", "partial"]):
        return "assisted"
    return None


def map_diagnosis(value: str) -> str | None:
    low = _normalise(value)
    mappings = [
        (["cerebral palsy", " cp ", "cp,", "cp."], "CP"),
        (["motor neuron", "mnd", "als", "motor neurone"], "MND"),
        (["multiple sclerosis", " ms ", "ms,", "ms."], "MS"),
        (["stroke", "cva", "cerebrovascular"], "stroke"),
        (["fracture", "broken"], "fracture"),
        (["dementia", "lewy bod"], "dementia_LB"),
        (["tbi", "traumatic brain", "head injury"], "TBI"),
    ]
    for keywords, state in mappings:
        if _contains_any(f" {low} ", keywords):
            return state
    return None


def map_contraindications(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["none", "nil", "n/a", "no "]):
        return "none"
    if _contains_any(low, ["cardiac", "heart"]):
        return "cardiac"
    if _contains_any(low, ["fatigue", "tired"]):
        return "fatigue"
    if _contains_any(low, ["palsy", "paralysis"]):
        return "palsy"
    return "other"


def map_in_hospital(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["yes", "required", "in hospital", "inpatient"]):
        return "required"
    return "not_required_for_discharge"


def map_living_alone(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["yes", "alone", "single"]):
        return "yes"
    return "no"


def map_level_support(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["24", "full time", "live-in", "live in"]):
        return "has_carer_24hrs"
    if _contains_any(low, ["visit", "part time", "occasional", "some"]):
        return "has_visiting_carer"
    if _contains_any(low, ["none", "no", "nil", "n/a"]):
        return "no_carer"
    return None


def map_smallest_door(value: str) -> str | None:
    num = _detect_unit_and_get_inches(value)
    if num is None:
        return None
    if num > 40:
        num = _cm_to_inches(num)
    if num < 27:
        return "narrow_under_27"
    if num <= 30:
        return "standard_27_30"
    if num <= 33:
        return "wide_30_33"
    return "accessible_over_33"


def map_turning_circle(value: str) -> str | None:
    num = _detect_unit_and_get_inches(value)
    if num is None:
        return None
    # Turning circles > 100 are certainly cm
    if num > 100:
        num = _cm_to_inches(num)
    if num < 40:
        return "narrow_under_40"
    if num <= 50:
        return "standard_40_50"
    if num <= 60:
        return "wide_50_60"
    return "open_over_60"


def map_stairs_lifts(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["impossible", "no access", "cannot", "unable", "no lift"]):
        return "yes_impossible"
    return "yes_possible_in_wheelchair"


def map_motability(value: str) -> str | None:
    low = _normalise(value)
    if _contains_any(low, ["no access", "no car", "no vehicle", "none", "no"]):
        return "no_access_to_car"
    if _contains_any(low, ["yes", "car", "access", "vehicle", "has"]):
        return "access_to_car"
    return "no_access_to_car"


# ── Master mapping registry ────────────────────────────────────────────────

_ALEC_TO_BN: dict[str, tuple[str, Any]] = {
    # ALEC field key  →  (BN node ID, mapper function)
    "age_dob":                ("age",                   map_age),
    "sex":                    ("sex",                   map_sex),
    "weight":                 ("weight",                map_weight),
    "height":                 ("height",                map_height),
    "mobility":               ("mobil",                 map_mobility),
    "posture":                ("posture",               map_posture),
    "abnormal_posture":       ("posture",               map_posture),
    "seizure":                ("seizure",               map_seizure),
    "hip_width":              ("hip",                   map_hip),
    "upper_leg_length":       ("legUpper",              map_leg_upper),
    "lower_leg_length":       ("lowerLeg",              map_leg_lower),
    "limited_joint_limb":     ("jointLim",              map_joint_lim),
    "self_propelled":         ("selfPropel",            map_self_propel),
    "fatigue_profile":        ("fatigue",               map_fatigue),
    "transfer_ability":       ("transfer",              map_transfer),
    "diagnosis":              ("diag",                  map_diagnosis),
    "contraindications":      ("contra",                map_contraindications),
    "in_hospital":            ("inHospital",            map_in_hospital),
    "living_alone":           ("lives_alone",           map_living_alone),
    "level_of_support":       ("level_support",         map_level_support),
    "smallest_door":          ("small_door",            map_smallest_door),
    "minimum_turning_circle": ("min_turn_circle",       map_turning_circle),
    "stairs_lifts":           ("access_another_floor",  map_stairs_lifts),
    "motability":             ("motability",             map_motability),
}

# ALEC fields that don't map to any BN node (informational only for the LLM)
_INFORMATIONAL_FIELDS = {"primary_reason", "fall_risk", "reasons_wider_chair"}


def map_alec_to_evidence(
    fields: dict[str, dict],
) -> tuple[dict[str, str], list[str]]:
    """Convert raw ALEC parsed fields to a BN evidence dict.

    Args:
        fields: ``{alec_key: {"value": "...", "section": "...", ...}}``

    Returns:
        ``(evidence, unmapped)`` where *evidence* maps BN node IDs to states
        and *unmapped* lists ALEC keys that could not be mapped.
    """
    evidence: dict[str, str] = {}
    unmapped: list[str] = []

    for alec_key, field_data in fields.items():
        raw_value = field_data.get("value", "") if isinstance(field_data, dict) else str(field_data)
        if not raw_value or not raw_value.strip():
            unmapped.append(alec_key)
            continue

        if alec_key in _INFORMATIONAL_FIELDS:
            continue

        mapping = _ALEC_TO_BN.get(alec_key)
        if mapping is None:
            unmapped.append(alec_key)
            continue

        bn_node, mapper_fn = mapping
        # Don't overwrite a node that was already mapped
        # (e.g. posture from "posture" takes precedence over "abnormal_posture")
        if bn_node in evidence:
            continue

        state = mapper_fn(raw_value)
        if state is None:
            unmapped.append(alec_key)
        else:
            evidence[bn_node] = state

    return evidence, unmapped
