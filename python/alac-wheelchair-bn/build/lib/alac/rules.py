"""Absolute rule enforcement (post-processing overrides).

These implement the hard clinical rules from §4.1 of the spec.
They run after Bayesian inference and override results where
deterministic constraints must hold. Also handles two-pass
feedback (size → houseSuitability) and multi-referral accumulation.
"""

from alac.nodes import SIZE_DIMENSIONS, SIZE_TURNING_CIRCLE, TYPE_TO_SIZE, NODE_STATES

# Door width ranges in inches (use lower bound — worst case for the patient)
DOOR_WIDTH_INCHES: dict[str, float] = {
    "narrow_under_27": 25.0,
    "standard_27_30": 27.0,
    "wide_30_33": 30.0,
    "accessible_over_33": 33.0,
}

# Turning circle ranges in inches (use upper bound — give benefit of the doubt)
TURN_CIRCLE_INCHES: dict[str, float] = {
    "narrow_under_40": 39.0,
    "standard_40_50": 50.0,
    "wide_50_60": 60.0,
    "open_over_60": 70.0,
}


def check_seizure_powered(evidence: dict, result: dict) -> str | None:
    """A1: Seizure in last 12 months → no powered equipment."""
    if evidence.get("seizure") != "in_last_12_months":
        return None
    chair_state = result["pathways"].get("type", {}).get("state", "")
    if "powered" in chair_state:
        return "A1"
    return None


def check_bariatric_override(evidence: dict, result: dict) -> str | None:
    """A2: Bariatric weight or hip → must be bariatric chair."""
    if (evidence.get("weight") == "bariatric"
            or evidence.get("hip") == "bariatric_over_20"):
        if result["pathways"].get("type", {}).get("state") != "bariatric":
            return "A2"
    return None


def check_door_width(evidence: dict, result: dict) -> str | None:
    """A3: Smallest door must be wider than wheelchair width + 1 inch."""
    door = evidence.get("small_door")
    size_state = result["pathways"].get("size", {}).get("state")
    if not door or not size_state:
        return None

    door_inches = DOOR_WIDTH_INCHES.get(door, 30.0)
    chair_width = SIZE_DIMENSIONS.get(size_state, (19.0, 18.0, 19.5))[0]

    if door_inches < chair_width + 1.0:
        return "A3"
    return None


def check_turning_circle(evidence: dict, result: dict) -> str | None:
    """A4: Minimum turning circle must be wider than wheelchair turning circle."""
    turn = evidence.get("min_turn_circle")
    size_state = result["pathways"].get("size", {}).get("state")
    if not turn or not size_state:
        return None

    turn_inches = TURN_CIRCLE_INCHES.get(turn, 50.0)
    chair_turn = SIZE_TURNING_CIRCLE.get(size_state, 42.0)

    if turn_inches < chair_turn:
        return "A4"
    return None


def check_posture_harness(evidence: dict, result: dict) -> str | None:
    """A5/A12: Falling posture → needs harness."""
    if evidence.get("posture") in ("falls_forward", "falls_sideways"):
        mod = result["pathways"].get("modification", {}).get("state")
        if mod != "harness":
            return "A5"
    return None


def check_motability_referral(evidence: dict) -> str | None:
    """A6: No car → Motability referral."""
    if evidence.get("motability") == "no_access_to_car":
        return "A6"
    return None


def check_living_alone_ot(evidence: dict) -> str | None:
    """A10: Living alone → community OT referral."""
    if evidence.get("lives_alone") == "yes":
        return "A10"
    return None


def check_fall_risk_ot(result: dict) -> str | None:
    """A11: High fall risk → OT referral."""
    fall_risk = result.get("hidden", {}).get("fallRiskInferred", {})
    if fall_risk.get("state") == "high":
        return "A11"
    return None


# ---------------------------------------------------------------------------
# Main enforcement function
# ---------------------------------------------------------------------------

RULE_DESCRIPTIONS: dict[str, str] = {
    "A1": "Seizure in last 12 months — no powered equipment",
    "A2": "Bariatric override — chair must be bariatric",
    "A3": "Door width check failed — wheelchair too wide for smallest door",
    "A4": "Turning circle check failed — insufficient space to turn",
    "A5": "Falling posture — harness required",
    "A6": "No accessible car — Motability referral",
    "A7": "Contraindication overrides self-propel — powered needed",
    "A8": "Can actually self-propel — manual wheelchair",
    "A9": "Will need powered in 12 months — prescribe powered now",
    "A10": "Living alone — community OT referral",
    "A11": "High fall risk — community OT referral",
    "A12": "Falling posture — modification required",
    "A13": "Width match — chair sized to hip width",
}


def enforce_rules(
    evidence: dict[str, str],
    result: dict,
) -> tuple[dict, list[dict[str, str]]]:
    """Apply absolute rules as post-processing overrides.

    Args:
        evidence: The original evidence dict.
        result: The inference result from classify().

    Returns:
        (corrected_result, rules_fired) where rules_fired is a list of
        {"rule": str, "description": str, "action": str} dicts.
    """
    rules_fired: list[dict[str, str]] = []

    # --- A1: Seizure → no powered ---
    if check_seizure_powered(evidence, result):
        # Override type to best non-powered alternative
        dist = result["pathways"]["type"]["distribution"]
        manual_types = ["manual_standard", "manual_lightweight", "specialist"]
        best = max(manual_types, key=lambda t: dist.get(t, 0.0))
        result["pathways"]["type"]["state"] = best
        result["pathways"]["type"]["confidence"] = dist.get(best, 0.0)
        rules_fired.append({
            "rule": "A1",
            "description": RULE_DESCRIPTIONS["A1"],
            "action": f"Overrode type to {best}",
        })

    # --- A2: Bariatric override ---
    if check_bariatric_override(evidence, result):
        result["pathways"]["type"]["state"] = "bariatric"
        result["pathways"]["type"]["confidence"] = 0.99
        rules_fired.append({
            "rule": "A2",
            "description": RULE_DESCRIPTIONS["A2"],
            "action": "Forced type to bariatric",
        })

    # --- A5/A12: Posture → harness ---
    if check_posture_harness(evidence, result):
        result["pathways"]["modification"]["state"] = "harness"
        result["pathways"]["modification"]["confidence"] = 0.99
        rules_fired.append({
            "rule": "A5",
            "description": RULE_DESCRIPTIONS["A5"],
            "action": "Forced modification to harness",
        })

    # --- Two-pass: A3/A4 door width and turning circle checks ---
    # These depend on the (possibly overridden) type → size
    a3 = check_door_width(evidence, result)
    a4 = check_turning_circle(evidence, result)

    # --- Accumulate referrals ---
    referral_set: set[str] = set()
    primary = result["pathways"].get("referrals", {}).get("state", "none")
    if primary != "none":
        referral_set.add(primary)

    if a3:
        referral_set.add("housing")
        rules_fired.append({
            "rule": "A3",
            "description": RULE_DESCRIPTIONS["A3"],
            "action": "Added housing referral",
        })

    if a4:
        referral_set.add("housing")
        rules_fired.append({
            "rule": "A4",
            "description": RULE_DESCRIPTIONS["A4"],
            "action": "Added housing referral",
        })

    if check_motability_referral(evidence):
        referral_set.add("motability")
        rules_fired.append({
            "rule": "A6",
            "description": RULE_DESCRIPTIONS["A6"],
            "action": "Added Motability referral",
        })

    if check_living_alone_ot(evidence):
        referral_set.add("community_OT")
        rules_fired.append({
            "rule": "A10",
            "description": RULE_DESCRIPTIONS["A10"],
            "action": "Added community OT referral",
        })

    if check_fall_risk_ot(result):
        referral_set.add("community_OT")
        rules_fired.append({
            "rule": "A11",
            "description": RULE_DESCRIPTIONS["A11"],
            "action": "Added community OT referral",
        })

    # Update result with full referral set
    result["referrals_all"] = sorted(referral_set) if referral_set else ["none"]

    # --- Update houseSuitability if door/turning checks failed ---
    if a3 or a4:
        hs = result.get("hidden", {}).get("houseSuitability", {})
        if hs.get("state") != "unsuitable":
            hs["state"] = "unsuitable"
            hs["confidence"] = 1.0
            hs["distribution"] = {
                "suitable": 0.0, "adaptable": 0.0, "unsuitable": 1.0,
            }
            hs["override_reason"] = "Door width or turning circle check failed"

    return result, rules_fired
