"""Toy scenarios for testing the ALAC Bayesian network.

11 scenarios from §7 of the spec, covering the key clinical situations.
"""

SCENARIOS: dict[str, dict] = {
    "narrow_doorway_elderly": {
        "name": "Narrow doorway elderly",
        "description": (
            "Elderly stroke patient with narrow door and narrow turning circle. "
            "Should flag houseSuitability=unsuitable, referrals=housing, "
            "and urgency escalated."
        ),
        "evidence": {
            "age": "elderly",
            "weight": "standard",
            "diag": "stroke",
            "contra": "none",
            "seizure": "never",
            "mobil": "limited_walking",
            "sex": "female",
            "posture": "can_maintain_sit",
            "height": "standard_20_21",
            "hip": "standard_16_18",
            "legUpper": "standard_16_19",
            "lowerLeg": "standard_16_20",
            "selfPropel": "unable",
            "jointLim": "able_to_sit",
            "transfer": "assisted",
            "fatigue": "stable",
            "inHospital": "not_required_for_discharge",
            "lives_alone": "no",
            "multiple_environments": "no",
            "access_another_floor": "yes_impossible",
            "is_carer": "no",
            "level_support": "has_visiting_carer",
            "small_door": "narrow_under_27",
            "min_turn_circle": "narrow_under_40",
            "motability": "access_to_car",
        },
        "expected_flags": [
            "houseSuitability=unsuitable",
            "referrals=housing",
            "urgency escalated",
        ],
    },

    "bariatric_patient": {
        "name": "Bariatric patient",
        "description": (
            "Bariatric patient with narrow doors in a standard home. "
            "Should recommend bariatric chair, door check fails → housing referral."
        ),
        "evidence": {
            "age": "adult",
            "weight": "bariatric",
            "diag": "fracture",
            "contra": "none",
            "seizure": "never",
            "mobil": "limited_walking",
            "sex": "male",
            "posture": "can_maintain_sit",
            "height": "standard_20_21",
            "hip": "bariatric_over_20",
            "legUpper": "standard_16_19",
            "lowerLeg": "standard_16_20",
            "selfPropel": "able",
            "jointLim": "able_to_sit",
            "transfer": "assisted",
            "fatigue": "stable",
            "inHospital": "not_required_for_discharge",
            "lives_alone": "no",
            "multiple_environments": "no",
            "access_another_floor": "yes_possible_in_wheelchair",
            "is_carer": "no",
            "level_support": "has_visiting_carer",
            "small_door": "narrow_under_27",
            "min_turn_circle": "standard_40_50",
            "motability": "access_to_car",
        },
        "expected_flags": [
            "type=bariatric",
            "houseSuitability=adaptable or unsuitable",
            "door check → housing referral",
        ],
    },

    "progressive_mmd": {
        "name": "Progressive MND",
        "description": (
            "MND patient with deteriorating fatigue and limited self-propel. "
            "Should flag powered_12=yes and type=powered_*."
        ),
        "evidence": {
            "age": "adult",
            "weight": "standard",
            "diag": "MND",
            "contra": "fatigue",
            "seizure": "never",
            "mobil": "limited_walking",
            "sex": "male",
            "posture": "can_maintain_sit",
            "height": "standard_20_21",
            "hip": "standard_16_18",
            "legUpper": "standard_16_19",
            "lowerLeg": "standard_16_20",
            "selfPropel": "able",
            "jointLim": "able_to_sit",
            "transfer": "assisted",
            "fatigue": "deteriorates",
            "inHospital": "not_required_for_discharge",
            "lives_alone": "no",
            "multiple_environments": "yes",
            "access_another_floor": "yes_possible_in_wheelchair",
            "is_carer": "no",
            "level_support": "has_visiting_carer",
            "small_door": "standard_27_30",
            "min_turn_circle": "standard_40_50",
            "motability": "access_to_car",
        },
        "expected_flags": [
            "powered_12=yes",
            "type=powered_*",
        ],
    },

    "paediatric_cp": {
        "name": "Paediatric CP",
        "description": (
            "Paediatric CP patient, falls forward, unable to sit. "
            "Should recommend specialist chair and harness modification."
        ),
        "evidence": {
            "age": "paediatric",
            "weight": "standard",
            "diag": "CP",
            "contra": "none",
            "seizure": "never",
            "mobil": "unable_to_walk",
            "sex": "female",
            "posture": "falls_forward",
            "height": "low_under_20",
            "hip": "narrow_under_16",
            "legUpper": "short_under_16",
            "lowerLeg": "short_under_16",
            "selfPropel": "unable",
            "jointLim": "unable_to_sit",
            "transfer": "dependent",
            "fatigue": "stable",
            "inHospital": "not_required_for_discharge",
            "lives_alone": "no",
            "multiple_environments": "no",
            "access_another_floor": "yes_possible_in_wheelchair",
            "is_carer": "no",
            "level_support": "has_carer_24hrs",
            "small_door": "standard_27_30",
            "min_turn_circle": "standard_40_50",
            "motability": "access_to_car",
        },
        "expected_flags": [
            "type=specialist",
            "modification=harness",
        ],
    },

    "hospital_discharge_pressure": {
        "name": "Hospital discharge pressure",
        "description": (
            "Stroke patient in hospital, narrow doors, lives alone, no support. "
            "Should trigger urgent urgency and multiple referrals."
        ),
        "evidence": {
            "age": "elderly",
            "weight": "standard",
            "diag": "stroke",
            "contra": "none",
            "seizure": "never",
            "mobil": "limited_walking",
            "sex": "male",
            "posture": "can_maintain_sit",
            "height": "standard_20_21",
            "hip": "standard_16_18",
            "legUpper": "standard_16_19",
            "lowerLeg": "standard_16_20",
            "selfPropel": "unable",
            "jointLim": "able_to_sit",
            "transfer": "assisted",
            "fatigue": "deteriorates",
            "inHospital": "required",
            "lives_alone": "yes",
            "multiple_environments": "no",
            "access_another_floor": "yes_impossible",
            "is_carer": "no",
            "level_support": "no_carer",
            "small_door": "narrow_under_27",
            "min_turn_circle": "narrow_under_40",
            "motability": "no_access_to_car",
        },
        "expected_flags": [
            "urgency=urgent",
            "referrals includes housing + community_OT + motability",
        ],
    },

    "cardiac_contraindication": {
        "name": "Cardiac contraindication",
        "description": (
            "Adult, selfPropel=able but contra=cardiac. "
            "Rule A7: actualPropel should be no, type should be powered."
        ),
        "evidence": {
            "age": "adult",
            "weight": "standard",
            "diag": "MS",
            "contra": "cardiac",
            "seizure": "never",
            "mobil": "limited_walking",
            "sex": "male",
            "posture": "can_maintain_sit",
            "height": "standard_20_21",
            "hip": "standard_16_18",
            "legUpper": "standard_16_19",
            "lowerLeg": "standard_16_20",
            "selfPropel": "able",
            "jointLim": "able_to_sit",
            "transfer": "independent",
            "fatigue": "stable",
            "inHospital": "not_required_for_discharge",
            "lives_alone": "no",
            "multiple_environments": "yes",
            "access_another_floor": "yes_possible_in_wheelchair",
            "is_carer": "no",
            "level_support": "has_visiting_carer",
            "small_door": "wide_30_33",
            "min_turn_circle": "wide_50_60",
            "motability": "access_to_car",
        },
        "expected_flags": [
            "actualPropel=no",
            "type=powered_*",
        ],
    },

    "recent_seizure": {
        "name": "Recent seizure",
        "description": (
            "Adult with seizure in last 12 months, unable to self-propel. "
            "Rule A1: type must NOT be powered, even if otherwise indicated."
        ),
        "evidence": {
            "age": "adult",
            "weight": "standard",
            "diag": "TBI",
            "contra": "none",
            "seizure": "in_last_12_months",
            "mobil": "unable_to_walk",
            "sex": "male",
            "posture": "can_maintain_sit",
            "height": "standard_20_21",
            "hip": "standard_16_18",
            "legUpper": "standard_16_19",
            "lowerLeg": "standard_16_20",
            "selfPropel": "unable",
            "jointLim": "able_to_sit",
            "transfer": "assisted",
            "fatigue": "deteriorates",
            "inHospital": "not_required_for_discharge",
            "lives_alone": "no",
            "multiple_environments": "no",
            "access_another_floor": "yes_possible_in_wheelchair",
            "is_carer": "no",
            "level_support": "has_visiting_carer",
            "small_door": "standard_27_30",
            "min_turn_circle": "standard_40_50",
            "motability": "access_to_car",
        },
        "expected_flags": [
            "type must NOT be powered (rule A1)",
        ],
    },

    "active_adult_propel": {
        "name": "Active adult, can propel",
        "description": (
            "Adult fracture, selfPropel=able, no contraindication, stable fatigue. "
            "actualPropel=yes, type=manual_standard or manual_lightweight."
        ),
        "evidence": {
            "age": "adult",
            "weight": "standard",
            "diag": "fracture",
            "contra": "none",
            "seizure": "never",
            "mobil": "limited_walking",
            "sex": "male",
            "posture": "can_maintain_sit",
            "height": "standard_20_21",
            "hip": "standard_16_18",
            "legUpper": "standard_16_19",
            "lowerLeg": "standard_16_20",
            "selfPropel": "able",
            "jointLim": "able_to_sit",
            "transfer": "independent",
            "fatigue": "stable",
            "inHospital": "not_required_for_discharge",
            "lives_alone": "no",
            "multiple_environments": "no",
            "access_another_floor": "yes_possible_in_wheelchair",
            "is_carer": "no",
            "level_support": "has_visiting_carer",
            "small_door": "standard_27_30",
            "min_turn_circle": "standard_40_50",
            "motability": "access_to_car",
        },
        "expected_flags": [
            "actualPropel=yes",
            "type=manual_standard or manual_lightweight",
        ],
    },

    "caring_responsibility": {
        "name": "Caring responsibility",
        "description": (
            "Adult MS patient, is_carer=yes, selfPropel=able. "
            "Rule S7: push towards powered."
        ),
        "evidence": {
            "age": "adult",
            "weight": "standard",
            "diag": "MS",
            "contra": "none",
            "seizure": "never",
            "mobil": "limited_walking",
            "sex": "female",
            "posture": "can_maintain_sit",
            "height": "standard_20_21",
            "hip": "standard_16_18",
            "legUpper": "standard_16_19",
            "lowerLeg": "standard_16_20",
            "selfPropel": "able",
            "jointLim": "able_to_sit",
            "transfer": "independent",
            "fatigue": "stable",
            "inHospital": "not_required_for_discharge",
            "lives_alone": "no",
            "multiple_environments": "yes",
            "access_another_floor": "yes_possible_in_wheelchair",
            "is_carer": "yes",
            "level_support": "has_visiting_carer",
            "small_door": "wide_30_33",
            "min_turn_circle": "wide_50_60",
            "motability": "access_to_car",
        },
        "expected_flags": [
            "push towards powered (rule S7)",
        ],
    },

    "living_alone_no_support": {
        "name": "Living alone, no support",
        "description": (
            "Elderly, lives alone, no carer, no car. "
            "Should generate community_OT + motability referrals, urgency increased."
        ),
        "evidence": {
            "age": "elderly",
            "weight": "standard",
            "diag": "MS",
            "contra": "fatigue",
            "seizure": "never",
            "mobil": "limited_walking",
            "sex": "female",
            "posture": "can_maintain_sit",
            "height": "standard_20_21",
            "hip": "standard_16_18",
            "legUpper": "standard_16_19",
            "lowerLeg": "standard_16_20",
            "selfPropel": "unable",
            "jointLim": "able_to_sit",
            "transfer": "assisted",
            "fatigue": "deteriorates",
            "inHospital": "not_required_for_discharge",
            "lives_alone": "yes",
            "multiple_environments": "no",
            "access_another_floor": "yes_impossible",
            "is_carer": "no",
            "level_support": "no_carer",
            "small_door": "standard_27_30",
            "min_turn_circle": "standard_40_50",
            "motability": "no_access_to_car",
        },
        "expected_flags": [
            "referrals includes community_OT + motability",
            "urgency increased",
        ],
    },

    "posture_falls": {
        "name": "Posture falls",
        "description": (
            "Adult stroke, falls sideways, dependent transfer. "
            "modification=harness, fallRiskInferred=high, referrals=community_OT."
        ),
        "evidence": {
            "age": "adult",
            "weight": "standard",
            "diag": "stroke",
            "contra": "none",
            "seizure": "never",
            "mobil": "unable_to_walk",
            "sex": "male",
            "posture": "falls_sideways",
            "height": "standard_20_21",
            "hip": "standard_16_18",
            "legUpper": "standard_16_19",
            "lowerLeg": "standard_16_20",
            "selfPropel": "unable",
            "jointLim": "able_to_sit",
            "transfer": "dependent",
            "fatigue": "stable",
            "inHospital": "not_required_for_discharge",
            "lives_alone": "no",
            "multiple_environments": "no",
            "access_another_floor": "yes_possible_in_wheelchair",
            "is_carer": "no",
            "level_support": "has_visiting_carer",
            "small_door": "standard_27_30",
            "min_turn_circle": "standard_40_50",
            "motability": "access_to_car",
        },
        "expected_flags": [
            "modification=harness",
            "fallRiskInferred=high",
            "referrals includes community_OT",
        ],
    },
}


def get_scenario(name: str) -> dict:
    """Get a scenario by name. Raises KeyError if not found."""
    return SCENARIOS[name]


def list_scenarios() -> list[dict]:
    """Return a summary of all scenarios."""
    return [
        {"id": k, "name": v["name"], "description": v["description"]}
        for k, v in SCENARIOS.items()
    ]
