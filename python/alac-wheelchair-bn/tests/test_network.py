"""Tests for network structure validation."""

import pytest
from alac.network import (
    build_model, NODE_STATES, EDGES, OBSERVABLE_NODES,
    HIDDEN_NODES, PATHWAY_NODES,
)


@pytest.fixture(scope="module")
def model():
    return build_model()


def test_model_validates(model):
    """Model passes pgmpy's internal validation."""
    assert model.check_model()


def test_node_count(model):
    """Network has all defined nodes."""
    assert len(model.nodes()) == len(NODE_STATES)


def test_edge_count(model):
    """Network has the expected number of edges."""
    assert len(model.edges()) == len(EDGES)


def test_all_nodes_present(model):
    """All defined nodes exist in the model."""
    all_nodes = set(NODE_STATES.keys())
    model_nodes = set(model.nodes())
    assert all_nodes == model_nodes


def test_is_dag(model):
    """Network is a valid DAG (no cycles)."""
    import networkx as nx
    assert nx.is_directed_acyclic_graph(model)


def test_observable_are_roots(model):
    """All observable nodes have no parents in the model."""
    for node in OBSERVABLE_NODES:
        parents = list(model.get_parents(node))
        assert parents == [], f"{node} should be a root but has parents: {parents}"


def test_hidden_have_parents(model):
    """All hidden nodes have at least one parent."""
    for node in HIDDEN_NODES:
        parents = list(model.get_parents(node))
        assert len(parents) > 0, f"{node} should have parents"


def test_pathway_have_parents(model):
    """All pathway output nodes have at least one parent."""
    for node in PATHWAY_NODES:
        parents = list(model.get_parents(node))
        assert len(parents) > 0, f"{node} should have parents"


def test_tier_counts():
    """Correct number of nodes in each tier."""
    assert len(OBSERVABLE_NODES) == 25  # 17 clinical + 8 environment
    assert len(HIDDEN_NODES) == 4
    assert len(PATHWAY_NODES) == 5
