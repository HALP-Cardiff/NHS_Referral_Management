"""CPTs for the hidden / latent nodes (Tier 2).

Each CPT is generated from clinical rule functions, then materialised
into a full TabularCPD via _build_cpd(). dualProvision is a future
extension stub and gets a simple prior (defined in priors.py).
"""

import itertools
import numpy as np
from pgmpy.factors.discrete import TabularCPD

from alac.nodes import NODE_STATES

# ---------------------------------------------------------------------------
# Helper: build a TabularCPD from a rule function
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
    """Normalise a probability vector to sum to 1."""
    s = sum(probs)
    if s == 0:
        n = len(probs)
        return [1.0 / n] * n
    return [p / s for p in probs]


# ---------------------------------------------------------------------------
# actualPropel (parents: selfPropel, contra, seizure, mobil, fatigue)
# States: yes, no
# ---------------------------------------------------------------------------

def _actual_propel_rule(c: dict) -> list[float]:
    sp = c["selfPropel"]
    contra = c["contra"]
    fatigue = c["fatigue"]

    # Unable → almost certainly no
    if sp == "unable":
        return [0.05, 0.95]

    # Unknown → uncertain baseline
    if sp == "unknown":
        if contra != "none":
            return [0.15, 0.85]
        if fatigue == "deteriorates":
            return [0.35, 0.65]
        # stable, no contra, unknown ability
        if c["mobil"] == "limited_walking":
            return [0.50, 0.50]
        return [0.40, 0.60]

    # sp == "able" from here
    # Rule A7: contraindication overrides self-propel ability
    if contra == "cardiac":
        return [0.15, 0.85]
    if contra == "fatigue":
        if fatigue == "deteriorates":
            return [0.20, 0.80]
        return [0.30, 0.70]
    if contra in ("palsy", "other"):
        return [0.25, 0.75]

    # contra == "none", able
    if fatigue == "deteriorates":
        if c["mobil"] == "unable_to_walk":
            return [0.60, 0.40]
        return [0.70, 0.30]

    # able, no contra, stable fatigue
    if c["mobil"] == "unable_to_walk":
        return [0.85, 0.15]
    return [0.90, 0.10]


# ---------------------------------------------------------------------------
# fallRiskInferred (parents: age, posture, transfer, diag)
# States: high, med, low
# ---------------------------------------------------------------------------

def _fall_risk_rule(c: dict) -> list[float]:
    high = 0.10
    med = 0.25

    # Age — rule S8
    if c["age"] == "elderly":
        high += 0.20
        med += 0.10
    elif c["age"] == "paediatric":
        high += 0.05

    # Posture
    if c["posture"] == "falls_forward":
        high += 0.25
        med += 0.10
    elif c["posture"] == "falls_sideways":
        high += 0.20
        med += 0.10

    # Transfer
    if c["transfer"] == "dependent":
        high += 0.15
        med += 0.10
    elif c["transfer"] == "assisted":
        high += 0.10
        med += 0.05

    # Diagnosis
    if c["diag"] in ("stroke", "MS"):
        high += 0.15
        med += 0.10
    elif c["diag"] == "dementia_LB":
        high += 0.20
        med += 0.10
    elif c["diag"] == "TBI":
        high += 0.10
        med += 0.05
    elif c["diag"] == "CP":
        high += 0.05

    low = 1.0 - high - med
    vals = [max(v, 0.02) for v in [high, med, low]]
    return _normalise(vals)


# ---------------------------------------------------------------------------
# houseSuitability (parents: small_door, min_turn_circle, access_another_floor)
# States: suitable, adaptable, unsuitable
# Note: size feedback is handled in two-pass inference, not here.
# ---------------------------------------------------------------------------

def _house_suitability_rule(c: dict) -> list[float]:
    door = c["small_door"]
    turn = c["min_turn_circle"]
    floor = c["access_another_floor"]

    suit = 0.50
    adapt = 0.30
    unsuit = 0.20

    # Floor access
    if floor == "yes_impossible":
        unsuit += 0.25
        suit -= 0.15

    # Door width
    if door == "narrow_under_27":
        unsuit += 0.30
        suit -= 0.20
    elif door == "standard_27_30":
        unsuit += 0.05
    elif door == "wide_30_33":
        suit += 0.05
    elif door == "accessible_over_33":
        suit += 0.15

    # Turning circle
    if turn == "narrow_under_40":
        unsuit += 0.25
        suit -= 0.15
    elif turn == "standard_40_50":
        unsuit += 0.05
    elif turn == "wide_50_60":
        suit += 0.05
    elif turn == "open_over_60":
        suit += 0.10

    # Compound: narrow door + narrow turn + impossible floor
    if (door == "narrow_under_27" and turn == "narrow_under_40"
            and floor == "yes_impossible"):
        unsuit += 0.15  # push even higher

    vals = [max(v, 0.01) for v in [suit, adapt, unsuit]]
    return _normalise(vals)


# ---------------------------------------------------------------------------
# powered_12 (parents: age, fatigue, diag, actualPropel)
# States: yes, no
# ---------------------------------------------------------------------------

def _powered_12_rule(c: dict) -> list[float]:
    yes = 0.15
    no = 0.85

    diag = c["diag"]
    fatigue = c["fatigue"]
    age = c["age"]
    propel = c["actualPropel"]

    # Progressive diagnoses are the strongest driver
    if diag == "MND":
        yes += 0.40
        no -= 0.40
        if fatigue == "deteriorates":
            yes += 0.15
            no -= 0.15
    elif diag == "MS":
        yes += 0.25
        no -= 0.25
        if fatigue == "deteriorates":
            yes += 0.15
            no -= 0.15
    elif diag == "dementia_LB":
        yes += 0.15
        no -= 0.15
        if fatigue == "deteriorates":
            yes += 0.10
            no -= 0.10

    # Already unable to propel
    if propel == "no":
        yes += 0.15
        no -= 0.15

    # Age
    if age == "elderly":
        yes += 0.05
        no -= 0.05
    elif age == "paediatric":
        yes -= 0.05
        no += 0.05

    # Fatigue (general, beyond diagnosis-specific)
    if fatigue == "deteriorates" and diag not in ("MMD", "MS", "dementia_LB"):
        yes += 0.10
        no -= 0.10

    # Stable conditions
    if diag == "fracture" and propel == "yes":
        yes -= 0.10
        no += 0.10
    elif diag == "CP" and propel == "yes" and age == "paediatric":
        yes -= 0.05
        no += 0.05

    vals = [max(v, 0.02) for v in [yes, no]]
    return _normalise(vals)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_hidden_cpds() -> list[TabularCPD]:
    """Return CPDs for hidden nodes (excluding future stubs)."""
    return [
        _build_cpd("actualPropel",
                    ["selfPropel", "contra", "seizure", "mobil", "fatigue"],
                    _actual_propel_rule),
        _build_cpd("fallRiskInferred",
                    ["age", "posture", "transfer", "diag"],
                    _fall_risk_rule),
        _build_cpd("houseSuitability",
                    ["small_door", "min_turn_circle", "access_another_floor"],
                    _house_suitability_rule),
        _build_cpd("powered_12",
                    ["age", "fatigue", "diag", "actualPropel"],
                    _powered_12_rule),
    ]
