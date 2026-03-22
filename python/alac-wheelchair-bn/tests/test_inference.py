"""Smoke tests on toy scenarios — verify the network produces sensible results."""

import pytest
from alac.inference import classify, query, explain
from alac.scenarios import SCENARIOS


@pytest.fixture(scope="module")
def _warm_model():
    """Warm up the model once for all tests."""
    from alac.network import get_model
    get_model()


class TestScenarioSmoke:
    """Run classify on every scenario and check it doesn't crash."""

    @pytest.mark.parametrize("name", list(SCENARIOS.keys()))
    def test_scenario_runs(self, _warm_model, name):
        sc = SCENARIOS[name]
        result = classify(sc["evidence"])
        assert "pathways" in result
        assert "risks" in result
        assert "hidden" in result
        assert "rules_fired" in result


class TestExpectedFlags:
    """Verify key expected outputs from the spec scenarios."""

    def test_narrow_doorway_housing(self, _warm_model):
        result = classify(SCENARIOS["narrow_doorway_elderly"]["evidence"])
        assert result["hidden"]["houseSuitability"]["state"] == "unsuitable"

    def test_bariatric_chair(self, _warm_model):
        result = classify(SCENARIOS["bariatric_patient"]["evidence"])
        assert result["pathways"]["type"]["state"] == "bariatric"

    def test_bariatric_door_check(self, _warm_model):
        """Bariatric chair with narrow door should trigger housing referral."""
        result = classify(SCENARIOS["bariatric_patient"]["evidence"])
        assert "housing" in result.get("referrals_all", [])

    def test_progressive_mmd_powered(self, _warm_model):
        result = classify(SCENARIOS["progressive_mmd"]["evidence"])
        assert result["hidden"]["powered_12"]["state"] == "yes"

    def test_paediatric_cp_specialist(self, _warm_model):
        result = classify(SCENARIOS["paediatric_cp"]["evidence"])
        assert result["pathways"]["type"]["state"] == "specialist"

    def test_paediatric_cp_harness(self, _warm_model):
        result = classify(SCENARIOS["paediatric_cp"]["evidence"])
        assert result["pathways"]["modification"]["state"] == "harness"

    def test_hospital_discharge_urgency(self, _warm_model):
        result = classify(SCENARIOS["hospital_discharge_pressure"]["evidence"])
        assert result["pathways"]["urgency"]["state"] in ("urgent", "priority")

    def test_hospital_discharge_referrals(self, _warm_model):
        result = classify(SCENARIOS["hospital_discharge_pressure"]["evidence"])
        refs = result.get("referrals_all", [])
        assert "community_OT" in refs  # lives alone
        assert "motability" in refs    # no car

    def test_cardiac_contraindication_propel(self, _warm_model):
        """Rule A7: contra=cardiac should make actualPropel=no."""
        result = classify(SCENARIOS["cardiac_contraindication"]["evidence"])
        assert result["hidden"]["actualPropel"]["state"] == "no"

    def test_recent_seizure_no_powered(self, _warm_model):
        """Rule A1: seizure → type must not be powered."""
        result = classify(SCENARIOS["recent_seizure"]["evidence"])
        chair = result["pathways"]["type"]["state"]
        assert "powered" not in chair

    def test_active_adult_manual(self, _warm_model):
        """actualPropel=yes → manual wheelchair."""
        result = classify(SCENARIOS["active_adult_propel"]["evidence"])
        assert result["hidden"]["actualPropel"]["state"] == "yes"
        assert result["pathways"]["type"]["state"] in (
            "manual_standard", "manual_lightweight"
        )

    def test_living_alone_referrals(self, _warm_model):
        result = classify(SCENARIOS["living_alone_no_support"]["evidence"])
        refs = result.get("referrals_all", [])
        assert "community_OT" in refs
        assert "motability" in refs

    def test_posture_falls_harness(self, _warm_model):
        result = classify(SCENARIOS["posture_falls"]["evidence"])
        assert result["pathways"]["modification"]["state"] == "harness"

    def test_posture_falls_risk(self, _warm_model):
        result = classify(SCENARIOS["posture_falls"]["evidence"])
        assert result["hidden"]["fallRiskInferred"]["state"] == "high"


class TestExplainOutput:
    """Test the explain() function produces output."""

    def test_explain_returns_string(self, _warm_model):
        text = explain(SCENARIOS["progressive_mmd"]["evidence"])
        assert isinstance(text, str)
        assert "ALAC" in text
        assert "Pathway" in text or "Evidence" in text


class TestPartialEvidence:
    """Test inference with incomplete evidence."""

    def test_minimal_evidence(self, _warm_model):
        """Just age and diag should still produce results."""
        result = classify({"age": "elderly", "diag": "stroke"})
        assert "pathways" in result
        assert len(result["pathways"]) > 0

    def test_single_field(self, _warm_model):
        """Single field evidence shouldn't crash."""
        result = classify({"diag": "MS"})
        assert "pathways" in result
