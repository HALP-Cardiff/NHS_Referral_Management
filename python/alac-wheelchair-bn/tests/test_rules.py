"""Tests for absolute rule enforcement (post-processing)."""

import pytest
from alac.rules import (
    check_seizure_powered,
    check_bariatric_override,
    check_door_width,
    check_turning_circle,
    check_posture_harness,
    check_motability_referral,
    check_living_alone_ot,
    check_fall_risk_ot,
    enforce_rules,
)


def _make_result(type_state="manual_standard", size_state="manual_std_19x18x19.5",
                 mod_state="none", ref_state="none", urg_state="medium",
                 fall_risk_state="low"):
    """Helper to build a minimal result dict."""
    return {
        "pathways": {
            "type": {"state": type_state, "confidence": 0.70,
                     "distribution": {
                         "manual_standard": 0.30, "manual_lightweight": 0.25,
                         "powered_indoor": 0.15, "powered_indoor_outdoor": 0.10,
                         "specialist": 0.15, "bariatric": 0.05,
                     }},
            "size": {"state": size_state, "confidence": 0.80,
                     "distribution": {}},
            "modification": {"state": mod_state, "confidence": 0.80,
                             "distribution": {}},
            "referrals": {"state": ref_state, "confidence": 0.70,
                          "distribution": {}},
            "urgency": {"state": urg_state, "confidence": 0.60,
                        "distribution": {}},
        },
        "hidden": {
            "fallRiskInferred": {"state": fall_risk_state, "confidence": 0.60,
                                 "distribution": {}},
            "houseSuitability": {"state": "suitable", "confidence": 0.70,
                                 "distribution": {}},
        },
        "risks": [],
    }


class TestIndividualRules:

    def test_a1_seizure_blocks_powered(self):
        evidence = {"seizure": "in_last_12_months"}
        result = _make_result(type_state="powered_indoor")
        assert check_seizure_powered(evidence, result) == "A1"

    def test_a1_no_seizure_ok(self):
        evidence = {"seizure": "never"}
        result = _make_result(type_state="powered_indoor")
        assert check_seizure_powered(evidence, result) is None

    def test_a2_bariatric_weight(self):
        evidence = {"weight": "bariatric"}
        result = _make_result(type_state="manual_standard")
        assert check_bariatric_override(evidence, result) == "A2"

    def test_a2_bariatric_hip(self):
        evidence = {"hip": "bariatric_over_20"}
        result = _make_result(type_state="manual_standard")
        assert check_bariatric_override(evidence, result) == "A2"

    def test_a3_narrow_door_wide_chair(self):
        evidence = {"small_door": "narrow_under_27"}
        result = _make_result(size_state="bariatric_30x22x22")
        assert check_door_width(evidence, result) == "A3"

    def test_a3_wide_door_ok(self):
        evidence = {"small_door": "accessible_over_33"}
        result = _make_result(size_state="manual_std_19x18x19.5")
        assert check_door_width(evidence, result) is None

    def test_a4_narrow_turn_wide_chair(self):
        evidence = {"min_turn_circle": "narrow_under_40"}
        result = _make_result(size_state="bariatric_30x22x22")
        assert check_turning_circle(evidence, result) == "A4"

    def test_a5_posture_falls(self):
        evidence = {"posture": "falls_forward"}
        result = _make_result(mod_state="none")
        assert check_posture_harness(evidence, result) == "A5"

    def test_a5_posture_ok(self):
        evidence = {"posture": "can_maintain_sit"}
        result = _make_result(mod_state="none")
        assert check_posture_harness(evidence, result) is None

    def test_a6_no_car(self):
        assert check_motability_referral({"motability": "no_access_to_car"}) == "A6"

    def test_a6_has_car(self):
        assert check_motability_referral({"motability": "access_to_car"}) is None

    def test_a10_lives_alone(self):
        assert check_living_alone_ot({"lives_alone": "yes"}) == "A10"

    def test_a11_high_fall_risk(self):
        result = _make_result(fall_risk_state="high")
        assert check_fall_risk_ot(result) == "A11"


class TestEnforceRules:

    def test_seizure_overrides_powered(self):
        evidence = {"seizure": "in_last_12_months"}
        result = _make_result(type_state="powered_indoor")
        corrected, fired = enforce_rules(evidence, result)
        assert "powered" not in corrected["pathways"]["type"]["state"]
        assert any(r["rule"] == "A1" for r in fired)

    def test_bariatric_forced(self):
        evidence = {"weight": "bariatric"}
        result = _make_result(type_state="manual_standard")
        corrected, fired = enforce_rules(evidence, result)
        assert corrected["pathways"]["type"]["state"] == "bariatric"
        assert any(r["rule"] == "A2" for r in fired)

    def test_multi_referral_accumulation(self):
        evidence = {
            "lives_alone": "yes",
            "motability": "no_access_to_car",
        }
        result = _make_result(fall_risk_state="high")
        corrected, fired = enforce_rules(evidence, result)
        refs = corrected["referrals_all"]
        assert "community_OT" in refs
        assert "motability" in refs
