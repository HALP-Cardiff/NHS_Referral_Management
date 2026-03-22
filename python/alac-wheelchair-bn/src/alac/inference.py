"""Inference engine wrapping pgmpy variable elimination.

Implements two-pass inference:
1. Run inference over the DAG to get posteriors for all hidden + output nodes.
2. Apply door-width (A3) and turning-circle (A4) checks given inferred size,
   updating houseSuitability. Apply all absolute rules via rules.py.
"""

from pgmpy.inference import VariableElimination

from alac.network import get_model
from alac.nodes import NODE_STATES, HIDDEN_NODES, PATHWAY_NODES, OBSERVABLE_NODES
from alac.rules import enforce_rules

# Risk thresholds for flagging hidden nodes
DEFAULT_RISK_THRESHOLD = 0.30

# Which states count as "high risk" for each hidden node
RISK_STATES: dict[str, list[str]] = {
    "actualPropel": [],  # not a risk — it's informational
    "fallRiskInferred": ["high"],
    "houseSuitability": ["unsuitable"],
    "powered_12": ["yes"],
}

# Human-readable labels
NODE_LABELS: dict[str, str] = {
    "actualPropel": "Actual Self-Propulsion",
    "fallRiskInferred": "Fall Risk (Inferred)",
    "houseSuitability": "Housing Suitability",
    "powered_12": "Powered Chair within 12 months",
    "type": "Wheelchair Type",
    "size": "Wheelchair Size",
    "modification": "Modification",
    "referrals": "Referrals",
    "urgency": "Urgency",
}


def query(
    evidence: dict[str, str],
    targets: list[str] | None = None,
) -> dict[str, dict[str, float]]:
    """Run exact inference and return posterior distributions.

    Args:
        evidence: Maps node IDs to observed states.
        targets: Nodes to query. Defaults to all hidden + pathway nodes.

    Returns:
        Dict of {node_id: {state: probability}} for each target.
    """
    model = get_model()
    ve = VariableElimination(model)

    if targets is None:
        targets = HIDDEN_NODES + PATHWAY_NODES

    # Filter out targets that are in evidence or are disconnected stubs
    targets = [t for t in targets if t not in evidence]

    results: dict[str, dict[str, float]] = {}
    for target in targets:
        try:
            posterior = ve.query([target], evidence=evidence)
            states = NODE_STATES[target]
            results[target] = {
                state: float(posterior.values[i])
                for i, state in enumerate(states)
            }
        except Exception:
            # Skip nodes that can't be queried (e.g. disconnected stubs)
            pass

    return results


def classify(
    evidence: dict[str, str],
    risk_threshold: float = DEFAULT_RISK_THRESHOLD,
) -> dict:
    """Run inference, pick MAP states, flag risks, and enforce rules.

    Returns:
        {
            "pathways": {node_id: {"state", "confidence", "distribution"}},
            "risks": [{"node", "label", "state", "probability"}],
            "hidden": {node_id: {"state", "confidence", "distribution"}},
            "rules_fired": [{"rule", "description", "action"}],
            "referrals_all": [str],
        }
    """
    posteriors = query(evidence)

    pathways = {}
    for node in PATHWAY_NODES:
        if node not in posteriors:
            continue
        dist = posteriors[node]
        best_state = max(dist, key=dist.get)
        pathways[node] = {
            "state": best_state,
            "confidence": dist[best_state],
            "distribution": dist,
        }

    hidden = {}
    risks = []
    for node in HIDDEN_NODES:
        if node not in posteriors:
            continue
        dist = posteriors[node]
        best_state = max(dist, key=dist.get)
        hidden[node] = {
            "state": best_state,
            "confidence": dist[best_state],
            "distribution": dist,
        }

        # Check for flagged risks
        for risk_state in RISK_STATES.get(node, []):
            prob = dist.get(risk_state, 0.0)
            if prob >= risk_threshold:
                risks.append({
                    "node": node,
                    "label": NODE_LABELS.get(node, node),
                    "state": risk_state,
                    "probability": prob,
                })

    risks.sort(key=lambda r: r["probability"], reverse=True)

    result = {
        "pathways": pathways,
        "risks": risks,
        "hidden": hidden,
    }

    # --- Two-pass: enforce absolute rules and size → housing feedback ---
    result, rules_fired = enforce_rules(evidence, result)
    result["rules_fired"] = rules_fired

    return result


def explain(
    evidence: dict[str, str],
    risk_threshold: float = DEFAULT_RISK_THRESHOLD,
) -> str:
    """Return a human-readable summary of the classification."""
    result = classify(evidence, risk_threshold)

    lines = []
    lines.append("=" * 60)
    lines.append("ALAC WHEELCHAIR REFERRAL SCREENING — INFERENCE REPORT")
    lines.append("=" * 60)

    # Evidence summary
    lines.append("\n--- Evidence ---")
    for k, v in sorted(evidence.items()):
        lines.append(f"  {k}: {v}")

    # Pathway recommendations
    lines.append("\n--- Pathway Recommendations ---")
    for node in PATHWAY_NODES:
        if node not in result["pathways"]:
            continue
        pw = result["pathways"][node]
        label = NODE_LABELS.get(node, node)
        lines.append(f"  {label}: {pw['state']} ({pw['confidence']:.0%})")

    # All referrals (from rule enforcement)
    if result.get("referrals_all"):
        refs = result["referrals_all"]
        if refs != ["none"]:
            lines.append(f"\n  All referrals: {', '.join(refs)}")

    # Rules fired
    if result.get("rules_fired"):
        lines.append("\n--- RULES FIRED ---")
        for rf in result["rules_fired"]:
            lines.append(f"  [{rf['rule']}] {rf['description']}")
            lines.append(f"         Action: {rf['action']}")

    # Flagged risks
    if result["risks"]:
        lines.append("\n--- FLAGGED RISKS ---")
        for risk in result["risks"]:
            lines.append(
                f"  ! {risk['label']}: {risk['state']} "
                f"(P={risk['probability']:.0%})"
            )
    else:
        lines.append("\n--- No risks above threshold ---")

    # Hidden node summaries
    lines.append("\n--- Hidden Node Posteriors ---")
    for node in HIDDEN_NODES:
        if node not in result["hidden"]:
            continue
        h = result["hidden"][node]
        label = NODE_LABELS.get(node, node)
        dist_str = ", ".join(
            f"{s}={p:.0%}" for s, p in h["distribution"].items()
        )
        lines.append(f"  {label}: {dist_str}")

    lines.append("\n" + "=" * 60)
    return "\n".join(lines)
