"""Node definitions and state spaces for the ALAC Bayesian network.

Based on the Cardiff ALAC wheelchair referral screening spec.
Nodes across 4 tiers with discrete state spaces.
"""

# ---------------------------------------------------------------------------
# Node definitions — state spaces
# ---------------------------------------------------------------------------

NODE_STATES: dict[str, list[str]] = {
    # Tier 0 — Patient observables (clinical)
    "weight": ["standard", "bariatric"],
    "diag": ["CP", "MND", "stroke", "fracture", "MS", "dementia_LB", "TBI"],
    "contra": ["cardiac", "fatigue", "palsy", "other", "none"],
    "seizure": ["never", "in_last_12_months"],
    "mobil": ["limited_walking", "unable_to_walk"],
    "age": ["paediatric", "adult", "elderly"],
    "sex": ["male", "female", "intersex"],
    "posture": ["can_maintain_sit", "falls_forward", "falls_sideways"],
    "height": ["low_under_20", "standard_20_21", "tall_over_21"],
    "hip": ["narrow_under_16", "standard_16_18", "wide_18_20", "bariatric_over_20"],
    "legUpper": ["short_under_16", "standard_16_19", "large_over_19"],
    "lowerLeg": ["short_under_16", "standard_16_20", "large_over_20"],
    "selfPropel": ["able", "unable", "unknown"],
    "jointLim": ["able_to_sit", "unable_to_sit"],
    "transfer": ["independent", "assisted", "dependent"],
    "fatigue": ["stable", "deteriorates"],
    "inHospital": ["required", "not_required_for_discharge"],

    # Tier 1 — Environment observables
    "lives_alone": ["yes", "no"],
    "multiple_environments": ["yes", "no"],
    "access_another_floor": ["yes_possible_in_wheelchair", "yes_impossible"],
    "is_carer": ["yes", "no"],
    "level_support": ["has_carer_24hrs", "has_visiting_carer", "no_carer"],
    "small_door": [
        "narrow_under_27", "standard_27_30", "wide_30_33", "accessible_over_33",
    ],
    "min_turn_circle": [
        "narrow_under_40", "standard_40_50", "wide_50_60", "open_over_60",
    ],
    "motability": ["access_to_car", "no_access_to_car"],

    # Tier 2 — Hidden / inferred
    "actualPropel": ["yes", "no"],
    "fallRiskInferred": ["high", "med", "low"],
    "houseSuitability": ["suitable", "adaptable", "unsuitable"],
    "powered_12": ["yes", "no"],

    # Tier 3 — Output nodes (pathway)
    "type": [
        "manual_standard", "manual_lightweight", "powered_indoor",
        "powered_indoor_outdoor", "specialist", "bariatric",
    ],
    "size": [
        "manual_std_19x18x19.5", "manual_lw_19x18x20",
        "powered_indoor_22x20x20", "powered_io_24x20x21",
        "specialist_22x20x22", "bariatric_30x22x22",
    ],
    "modification": ["harness", "pressure_relieving_cushions", "none"],
    "referrals": ["housing", "motability", "community_OT", "none"],
    "urgency": ["urgent", "priority", "medium", "low"],
}

# Convenience groupings
TIER0_NODES = [
    "weight", "diag", "contra", "seizure", "mobil", "age", "sex",
    "posture", "height", "hip", "legUpper", "lowerLeg", "selfPropel",
    "jointLim", "transfer", "fatigue", "inHospital",
]
TIER1_NODES = [
    "lives_alone", "multiple_environments", "access_another_floor",
    "is_carer", "level_support", "small_door", "min_turn_circle", "motability",
]
OBSERVABLE_NODES = TIER0_NODES + TIER1_NODES
HIDDEN_NODES = [
    "actualPropel", "fallRiskInferred", "houseSuitability", "powered_12",
]
PATHWAY_NODES = ["type", "size", "modification", "referrals", "urgency"]

# Future extension stubs (not in the active network)
# "dualProvision": ["single_chair", "likely_dual"]
# "multiple": ["multiple_chairs", "not_multiple"]

# Wheelchair size reference table (width, depth, height in inches)
SIZE_DIMENSIONS: dict[str, tuple[float, float, float]] = {
    "manual_std_19x18x19.5": (19.0, 18.0, 19.5),
    "manual_lw_19x18x20": (19.0, 18.0, 20.0),
    "powered_indoor_22x20x20": (22.0, 20.0, 20.0),
    "powered_io_24x20x21": (24.0, 20.0, 21.0),
    "specialist_22x20x22": (22.0, 20.0, 22.0),
    "bariatric_30x22x22": (30.0, 22.0, 22.0),
}

# Map type states to their corresponding size states
TYPE_TO_SIZE: dict[str, str] = {
    "manual_standard": "manual_std_19x18x19.5",
    "manual_lightweight": "manual_lw_19x18x20",
    "powered_indoor": "powered_indoor_22x20x20",
    "powered_indoor_outdoor": "powered_io_24x20x21",
    "specialist": "specialist_22x20x22",
    "bariatric": "bariatric_30x22x22",
}

# Realistic turning circle per size state (inches)
# Based on typical NHS wheelchair specs
SIZE_TURNING_CIRCLE: dict[str, float] = {
    "manual_std_19x18x19.5": 42.0,
    "manual_lw_19x18x20": 40.0,
    "powered_indoor_22x20x20": 33.0,   # designed for tight indoor spaces
    "powered_io_24x20x21": 47.0,
    "specialist_22x20x22": 42.0,
    "bariatric_30x22x22": 60.0,
}
