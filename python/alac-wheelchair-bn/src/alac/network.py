"""Bayesian network structure for ALAC wheelchair referral screening.

Nodes across 4 tiers connected by directed edges. The size -> houseSuitability
feedback edge is excluded (creates a cycle) and handled via two-pass inference.
"""

from pgmpy.models import DiscreteBayesianNetwork as BayesianNetwork

from alac.nodes import (
    NODE_STATES, TIER0_NODES, TIER1_NODES, OBSERVABLE_NODES,
    HIDDEN_NODES, PATHWAY_NODES,
)
from alac.cpts.priors import get_prior_cpds
from alac.cpts.hidden import get_hidden_cpds
from alac.cpts.outputs import get_output_cpds

__all__ = [
    "NODE_STATES", "TIER0_NODES", "TIER1_NODES", "OBSERVABLE_NODES",
    "HIDDEN_NODES", "PATHWAY_NODES", "EDGES", "build_model", "get_model",
]

# ---------------------------------------------------------------------------
# Edge list
# ---------------------------------------------------------------------------

EDGES: list[tuple[str, str]] = [
    # --- Tier 0 (patient observables) → hidden / output ---
    # age
    ("age", "fallRiskInferred"),
    ("age", "powered_12"),
    # sex
    ("sex", "size"),
    # weight
    ("weight", "size"),
    ("weight", "type"),
    # height
    ("height", "size"),
    # hip
    ("hip", "size"),
    ("hip", "type"),
    # legUpper
    ("legUpper", "size"),
    # lowerLeg
    ("lowerLeg", "size"),
    # posture
    ("posture", "modification"),
    ("posture", "fallRiskInferred"),
    ("posture", "type"),
    # seizure
    ("seizure", "type"),
    ("seizure", "actualPropel"),
    # mobil
    ("mobil", "type"),
    ("mobil", "actualPropel"),
    # selfPropel
    ("selfPropel", "actualPropel"),
    # fatigue
    ("fatigue", "actualPropel"),
    ("fatigue", "powered_12"),
    # transfer
    ("transfer", "fallRiskInferred"),
    # jointLim
    ("jointLim", "size"),
    ("jointLim", "type"),
    # contra
    ("contra", "actualPropel"),
    ("contra", "type"),
    # diag
    ("diag", "fallRiskInferred"),
    ("diag", "powered_12"),
    ("diag", "type"),
    # inHospital
    ("inHospital", "urgency"),

    # --- Tier 1 (environment observables) → hidden / output ---
    # lives_alone
    ("lives_alone", "referrals"),
    ("lives_alone", "urgency"),
    ("lives_alone", "type"),
    # multiple_environments
    ("multiple_environments", "referrals"),
    ("multiple_environments", "type"),
    # access_another_floor
    ("access_another_floor", "houseSuitability"),
    # level_support
    ("level_support", "urgency"),
    # small_door
    ("small_door", "houseSuitability"),
    # min_turn_circle
    ("min_turn_circle", "houseSuitability"),
    # motability
    ("motability", "referrals"),
    # is_carer
    ("is_carer", "type"),

    # --- Tier 2 (hidden) → Tier 3 (output) ---
    # fallRiskInferred
    ("fallRiskInferred", "referrals"),
    ("fallRiskInferred", "urgency"),
    ("fallRiskInferred", "type"),
    # powered_12
    ("powered_12", "type"),
    # houseSuitability
    ("houseSuitability", "referrals"),
    ("houseSuitability", "urgency"),
    # actualPropel
    ("actualPropel", "type"),
    ("actualPropel", "powered_12"),

    # --- Output → Output (within DAG, no cycles) ---
    # type
    ("type", "size"),
    ("type", "modification"),
    # NOTE: size → houseSuitability is a feedback edge that creates a cycle.
    # It is excluded from the DAG and handled in two-pass inference.
]


def build_model() -> BayesianNetwork:
    """Construct and validate the full Bayesian network."""
    model = BayesianNetwork(EDGES)

    # Attach all CPDs
    for cpd in get_prior_cpds():
        model.add_cpds(cpd)
    for cpd in get_hidden_cpds():
        model.add_cpds(cpd)
    for cpd in get_output_cpds():
        model.add_cpds(cpd)

    assert model.check_model(), "Model validation failed"
    return model


# Cache the model so we only build once per process
_MODEL: BayesianNetwork | None = None


def get_model() -> BayesianNetwork:
    """Return the validated model (cached singleton)."""
    global _MODEL
    if _MODEL is None:
        _MODEL = build_model()
    return _MODEL
