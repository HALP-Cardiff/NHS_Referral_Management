"""CPTs for the 6 pathway output nodes (Tier 3).

Uses the same rule-function approach as hidden.py.
The `type` node has many parents (14) — the CPT is large but manageable
since all Tier 0/1 nodes collapse to point values during inference.
"""

import itertools
import numpy as np
from pgmpy.factors.discrete import TabularCPD

from alac.nodes import NODE_STATES, TYPE_TO_SIZE

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_cpd(node: str, parents: list[str], rule_fn) -> TabularCPD:
    """Generate a full CPT by evaluating rule_fn over every parent combo."""
    child_states = NODE_STATES[node]
    parent_states_list = [NODE_STATES[p] for p in parents]
    parent_cards = [len(s) for s in parent_states_list]
    n_child = len(child_states)

    combos = list(itertools.product(*parent_states_list))
    table = np.zeros((n_child, len(combos)))

    for col, combo in enumerate(combos):
        combo_dict = dict(zip(parents, combo))
        probs = rule_fn(combo_dict)
        table[:, col] = probs

    state_names = {node: child_states}
    for p in parents:
        state_names[p] = NODE_STATES[p]

    return TabularCPD(
        variable=node,
        variable_card=n_child,
        values=table.tolist(),
        evidence=parents,
        evidence_card=parent_cards,
        state_names=state_names,
    )


def _normalise(probs: list[float]) -> list[float]:
    s = sum(probs)
    if s == 0:
        return [1.0 / len(probs)] * len(probs)
    return [p / s for p in probs]


# ---------------------------------------------------------------------------
# type (parents: actualPropel, powered_12, weight, hip, posture, jointLim,
#               mobil, contra, is_carer, lives_alone, seizure,
#               fallRiskInferred, multiple_environments, diag)
# States: manual_standard, manual_lightweight, powered_indoor,
#         powered_indoor_outdoor, specialist, bariatric
# ---------------------------------------------------------------------------

def _type_rule(c: dict) -> list[float]:
    # ms, ml, pi, pio, spec, bar
    ms, ml, pi, pio, spec, bar = 0.20, 0.15, 0.10, 0.10, 0.10, 0.05

    # --- Rule A2: Bariatric override ---
    if c["weight"] == "bariatric" or c["hip"] == "bariatric_over_20":
        bar += 0.70
        ms -= 0.10
        ml -= 0.10
        return _normalise([max(v, 0.01) for v in [ms, ml, pi, pio, spec, bar]])

    # --- Rule A1: Seizure blocks powered (encoded in CPT as strong bias) ---
    seizure_block = c["seizure"] == "in_last_12_months"

    # --- Specialist: posture falling + jointLim ---
    if c["posture"] in ("falls_forward", "falls_sideways"):
        if c["jointLim"] == "unable_to_sit":
            spec += 0.55
            ms -= 0.10
            ml -= 0.05
        else:
            spec += 0.20

    # --- Powered vs Manual: core logic ---
    if c["actualPropel"] == "yes":
        # Rule A8: can propel → manual
        if c["multiple_environments"] == "yes":
            ml += 0.30
            ms += 0.10
        else:
            ms += 0.35
            ml += 0.10
    else:
        # Cannot propel → powered or specialist
        if c["powered_12"] == "yes":
            # Rule A9: powered within 12 months → powered now
            if c["multiple_environments"] == "yes":
                pio += 0.35
                pi += 0.10
            else:
                pi += 0.30
                pio += 0.15
        else:
            pi += 0.20
            pio += 0.10

    # --- Rule A7: contra != none with selfPropel → powered ---
    if c["contra"] != "none":
        pi += 0.10
        pio += 0.05

    # --- Rule S7: carer responsibility → powered ---
    if c["is_carer"] == "yes":
        pio += 0.10
        pi += 0.05

    # --- Rule S2: lives alone → push powered ---
    if c["lives_alone"] == "yes":
        if c["actualPropel"] == "no":
            pio += 0.05
            pi += 0.05

    # --- Mobility status ---
    if c["mobil"] == "unable_to_walk" and c["actualPropel"] == "no":
        pi += 0.05

    # --- Fall risk: caution with powered ---
    if c["fallRiskInferred"] == "high":
        pio -= 0.08
        pi -= 0.05
        spec += 0.05
    elif c["fallRiskInferred"] == "med":
        pio -= 0.03

    # --- Diagnosis-specific nudges ---
    if c["diag"] == "MND":
        pi += 0.05
        pio += 0.05
    elif c["diag"] == "dementia_LB":
        spec += 0.05
        pio -= 0.05

    # --- Hip width: wider hip nudges toward wider chairs ---
    if c["hip"] == "wide_18_20":
        spec += 0.03

    # --- Seizure block: heavily penalise powered ---
    if seizure_block:
        ms += pi * 0.5 + pio * 0.5
        ml += pi * 0.3 + pio * 0.3
        spec += pi * 0.2 + pio * 0.2
        pi *= 0.05
        pio *= 0.05

    vals = [max(v, 0.01) for v in [ms, ml, pi, pio, spec, bar]]
    return _normalise(vals)


# ---------------------------------------------------------------------------
# size (parents: type, sex, weight, height, hip, legUpper, lowerLeg, jointLim)
# States: manual_std_19x18x19.5, manual_lw_19x18x20,
#         powered_indoor_22x20x20, powered_io_24x20x21,
#         specialist_22x20x22, bariatric_30x22x22
# Largely deterministic given type, adjusted by body measurements.
# ---------------------------------------------------------------------------

def _size_rule(c: dict) -> list[float]:
    # Base: size is almost deterministic given type
    chair = c["type"]
    target_size = TYPE_TO_SIZE.get(chair, "manual_std_19x18x19.5")
    size_states = NODE_STATES["size"]

    probs = [0.02] * len(size_states)
    target_idx = size_states.index(target_size)
    probs[target_idx] = 0.80

    # Body measurement adjustments: larger body → push to next size up
    hip = c["hip"]
    if hip in ("wide_18_20", "bariatric_over_20"):
        # Push toward larger sizes
        bar_idx = size_states.index("bariatric_30x22x22")
        spec_idx = size_states.index("specialist_22x20x22")
        if hip == "bariatric_over_20":
            probs[bar_idx] += 0.30
            probs[target_idx] -= 0.15
        else:
            probs[spec_idx] += 0.10

    # jointLim adjustments
    if c["jointLim"] == "unable_to_sit":
        spec_idx = size_states.index("specialist_22x20x22")
        probs[spec_idx] += 0.10

    vals = [max(v, 0.01) for v in probs]
    return _normalise(vals)


# ---------------------------------------------------------------------------
# modification (parents: posture, type)
# States: harness, pressure_relieving_cushions, none
# ---------------------------------------------------------------------------

def _modification_rule(c: dict) -> list[float]:
    posture = c["posture"]
    chair = c["type"]

    # Rule A5 / A12: falling posture → harness
    if posture in ("falls_forward", "falls_sideways"):
        return [0.88, 0.07, 0.05]

    # Can maintain sit
    if chair == "specialist":
        return [0.10, 0.40, 0.50]
    else:
        return [0.05, 0.15, 0.80]


# ---------------------------------------------------------------------------
# referrals (parents: houseSuitability, motability, lives_alone,
#                     fallRiskInferred, multiple_environments)
# States: housing, motability, community_OT, none
# Note: multi-referral logic handled in post-processing (rules.py).
#       This CPT models the single most likely primary referral.
# ---------------------------------------------------------------------------

def _referrals_rule(c: dict) -> list[float]:
    # housing, motability, community_OT, none
    housing = 0.05
    mota = 0.05
    ot = 0.05
    none_ = 0.85

    # Housing suitability
    if c["houseSuitability"] == "unsuitable":
        housing += 0.65
        none_ -= 0.40
    elif c["houseSuitability"] == "adaptable":
        housing += 0.25
        none_ -= 0.15

    # Rule A6: no car → motability
    if c["motability"] == "no_access_to_car":
        mota += 0.60
        none_ -= 0.25

    # Rule A10: lives alone → community OT
    if c["lives_alone"] == "yes":
        ot += 0.50
        none_ -= 0.20

    # Rule A11: high fall risk → OT
    if c["fallRiskInferred"] == "high":
        ot += 0.40
        none_ -= 0.15
    elif c["fallRiskInferred"] == "med":
        ot += 0.10

    # Multiple environments
    if c["multiple_environments"] == "yes":
        ot += 0.05
        housing += 0.03

    vals = [max(v, 0.01) for v in [housing, mota, ot, none_]]
    return _normalise(vals)


# ---------------------------------------------------------------------------
# urgency (parents: inHospital, lives_alone, level_support,
#                   fallRiskInferred, houseSuitability)
# States: urgent, priority, medium, low
# ---------------------------------------------------------------------------

def _urgency_rule(c: dict) -> list[float]:
    urgent = 0.10
    priority = 0.25
    medium = 0.35
    low = 0.30

    # Rule S1/S6: in hospital increases urgency
    if c["inHospital"] == "required":
        urgent += 0.30
        priority += 0.10
        low -= 0.20
        medium -= 0.10

    # Rule S3: lives alone increases urgency
    if c["lives_alone"] == "yes":
        urgent += 0.10
        priority += 0.05
        low -= 0.10

    # Rule S4: 24hr carer decreases urgency
    if c["level_support"] == "has_carer_24hrs":
        low += 0.15
        urgent -= 0.05
        priority -= 0.05
    elif c["level_support"] == "no_carer":
        urgent += 0.10
        priority += 0.05
        low -= 0.10

    # Fall risk
    if c["fallRiskInferred"] == "high":
        urgent += 0.20
        priority += 0.10
        low -= 0.15
        medium -= 0.10
    elif c["fallRiskInferred"] == "med":
        priority += 0.10
        medium += 0.05
        low -= 0.10

    # Housing suitability
    if c["houseSuitability"] == "unsuitable":
        urgent += 0.15
        priority += 0.10
        low -= 0.15
    elif c["houseSuitability"] == "adaptable":
        priority += 0.05

    # Combined high-risk
    if (c["inHospital"] == "required" and c["lives_alone"] == "yes"
            and c["level_support"] == "no_carer"
            and c["fallRiskInferred"] == "high"
            and c["houseSuitability"] == "unsuitable"):
        urgent += 0.20
        low -= 0.10

    # Low-risk baseline
    if (c["inHospital"] == "not_required_for_discharge"
            and c["fallRiskInferred"] == "low"
            and c["houseSuitability"] == "suitable"
            and c["level_support"] == "has_carer_24hrs"):
        low += 0.25
        medium += 0.10
        urgent -= 0.05

    vals = [max(v, 0.01) for v in [urgent, priority, medium, low]]
    return _normalise(vals)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_output_cpds() -> list[TabularCPD]:
    """Return CPDs for all pathway output nodes (excluding future stubs)."""
    return [
        _build_cpd("type",
                    ["actualPropel", "powered_12", "weight", "hip", "posture",
                     "jointLim", "mobil", "contra", "is_carer", "lives_alone",
                     "seizure", "fallRiskInferred", "multiple_environments",
                     "diag"],
                    _type_rule),
        _build_cpd("size",
                    ["type", "sex", "weight", "height", "hip",
                     "legUpper", "lowerLeg", "jointLim"],
                    _size_rule),
        _build_cpd("modification",
                    ["posture", "type"],
                    _modification_rule),
        _build_cpd("referrals",
                    ["houseSuitability", "motability", "lives_alone",
                     "fallRiskInferred", "multiple_environments"],
                    _referrals_rule),
        _build_cpd("urgency",
                    ["inHospital", "lives_alone", "level_support",
                     "fallRiskInferred", "houseSuitability"],
                    _urgency_rule),
    ]
