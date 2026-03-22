"""Tests for CPT validity — sums to 1, no NaN, correct dimensions."""

import numpy as np
import pytest
from alac.network import build_model, NODE_STATES


@pytest.fixture(scope="module")
def model():
    return build_model()


def test_all_cpds_present(model):
    """Every node has an attached CPD."""
    for node in NODE_STATES:
        cpd = model.get_cpds(node)
        assert cpd is not None, f"Missing CPD for {node}"


def test_cpd_no_nan(model):
    """No NaN values in any CPD."""
    for node in NODE_STATES:
        cpd = model.get_cpds(node)
        values = cpd.get_values()
        assert not np.any(np.isnan(values)), f"NaN in CPD for {node}"


def test_cpd_no_negative(model):
    """No negative values in any CPD."""
    for node in NODE_STATES:
        cpd = model.get_cpds(node)
        values = cpd.get_values()
        assert np.all(values >= 0), f"Negative values in CPD for {node}"


def test_cpd_columns_sum_to_one(model):
    """Each column of every CPD sums to approximately 1."""
    for node in NODE_STATES:
        cpd = model.get_cpds(node)
        values = cpd.get_values()
        col_sums = values.sum(axis=0)
        np.testing.assert_allclose(
            col_sums, 1.0, atol=1e-6,
            err_msg=f"CPD columns for {node} don't sum to 1",
        )


def test_cpd_correct_cardinality(model):
    """CPD row count matches the node's state space."""
    for node in NODE_STATES:
        cpd = model.get_cpds(node)
        expected_rows = len(NODE_STATES[node])
        actual_rows = cpd.get_values().shape[0]
        assert actual_rows == expected_rows, (
            f"{node}: expected {expected_rows} rows, got {actual_rows}"
        )
