"""Prior distributions for all observable (root) nodes.

Values are toy estimates for a typical Welsh ALAC referral population.
"""

from pgmpy.factors.discrete import TabularCPD


def get_prior_cpds() -> list[TabularCPD]:
    """Return CPDs for all Tier 0 and Tier 1 root nodes."""
    return [
        # --- Tier 0: Patient observables (clinical) ---

        TabularCPD("age", 3, [[0.12], [0.55], [0.33]],
                   state_names={"age": ["paediatric", "adult", "elderly"]}),

        TabularCPD("weight", 2, [[0.82], [0.18]],
                   state_names={"weight": ["standard", "bariatric"]}),

        TabularCPD("diag", 7,
                   [[0.10], [0.08], [0.25], [0.12], [0.18], [0.10], [0.17]],
                   state_names={"diag": [
                       "CP", "MND", "stroke", "fracture", "MS",
                       "dementia_LB", "TBI",
                   ]}),

        TabularCPD("contra", 5,
                   [[0.15], [0.15], [0.10], [0.10], [0.50]],
                   state_names={"contra": [
                       "cardiac", "fatigue", "palsy", "other", "none",
                   ]}),

        TabularCPD("seizure", 2, [[0.85], [0.15]],
                   state_names={"seizure": ["never", "in_last_12_months"]}),

        TabularCPD("mobil", 2, [[0.45], [0.55]],
                   state_names={"mobil": ["limited_walking", "unable_to_walk"]}),

        TabularCPD("sex", 3, [[0.48], [0.50], [0.02]],
                   state_names={"sex": ["male", "female", "intersex"]}),

        TabularCPD("posture", 3, [[0.55], [0.25], [0.20]],
                   state_names={"posture": [
                       "can_maintain_sit", "falls_forward", "falls_sideways",
                   ]}),

        TabularCPD("height", 3, [[0.25], [0.50], [0.25]],
                   state_names={"height": [
                       "low_under_20", "standard_20_21", "tall_over_21",
                   ]}),

        TabularCPD("hip", 4, [[0.15], [0.45], [0.25], [0.15]],
                   state_names={"hip": [
                       "narrow_under_16", "standard_16_18",
                       "wide_18_20", "bariatric_over_20",
                   ]}),

        TabularCPD("legUpper", 3, [[0.20], [0.55], [0.25]],
                   state_names={"legUpper": [
                       "short_under_16", "standard_16_19", "large_over_19",
                   ]}),

        TabularCPD("lowerLeg", 3, [[0.20], [0.55], [0.25]],
                   state_names={"lowerLeg": [
                       "short_under_16", "standard_16_20", "large_over_20",
                   ]}),

        TabularCPD("selfPropel", 3, [[0.40], [0.45], [0.15]],
                   state_names={"selfPropel": ["able", "unable", "unknown"]}),

        TabularCPD("jointLim", 2, [[0.75], [0.25]],
                   state_names={"jointLim": ["able_to_sit", "unable_to_sit"]}),

        TabularCPD("transfer", 3, [[0.30], [0.40], [0.30]],
                   state_names={"transfer": [
                       "independent", "assisted", "dependent",
                   ]}),

        TabularCPD("fatigue", 2, [[0.55], [0.45]],
                   state_names={"fatigue": ["stable", "deteriorates"]}),

        TabularCPD("inHospital", 2, [[0.30], [0.70]],
                   state_names={"inHospital": [
                       "required", "not_required_for_discharge",
                   ]}),

        # --- Tier 1: Environment observables ---

        TabularCPD("lives_alone", 2, [[0.35], [0.65]],
                   state_names={"lives_alone": ["yes", "no"]}),

        TabularCPD("multiple_environments", 2, [[0.50], [0.50]],
                   state_names={"multiple_environments": ["yes", "no"]}),

        TabularCPD("access_another_floor", 2, [[0.20], [0.80]],
                   state_names={"access_another_floor": [
                       "yes_possible_in_wheelchair", "yes_impossible",
                   ]}),

        TabularCPD("is_carer", 2, [[0.10], [0.90]],
                   state_names={"is_carer": ["yes", "no"]}),

        TabularCPD("level_support", 3, [[0.15], [0.40], [0.45]],
                   state_names={"level_support": [
                       "has_carer_24hrs", "has_visiting_carer", "no_carer",
                   ]}),

        TabularCPD("small_door", 4, [[0.15], [0.45], [0.30], [0.10]],
                   state_names={"small_door": [
                       "narrow_under_27", "standard_27_30",
                       "wide_30_33", "accessible_over_33",
                   ]}),

        TabularCPD("min_turn_circle", 4, [[0.10], [0.35], [0.35], [0.20]],
                   state_names={"min_turn_circle": [
                       "narrow_under_40", "standard_40_50",
                       "wide_50_60", "open_over_60",
                   ]}),

        TabularCPD("motability", 2, [[0.55], [0.45]],
                   state_names={"motability": ["access_to_car", "no_access_to_car"]}),

    ]
