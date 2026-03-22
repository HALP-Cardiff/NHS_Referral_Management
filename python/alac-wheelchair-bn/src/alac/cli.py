"""CLI entry point for the ALAC wheelchair referral screening tool."""

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from alac.nodes import NODE_STATES, OBSERVABLE_NODES
from alac.inference import (
    classify, NODE_LABELS, HIDDEN_NODES, PATHWAY_NODES,
)
from alac.scenarios import get_scenario, list_scenarios

console = Console()

LIMITATIONS_NOTE = (
    "NOTE: This system cannot assess cross-border eligibility, "
    "postcode/GP registration, or waiting list position. "
    "These require manual review."
)


def _render_results(result: dict, evidence: dict) -> None:
    """Render classification results using Rich."""
    # Evidence panel
    ev_lines = [f"[dim]{k}:[/dim] {v}" for k, v in sorted(evidence.items())]
    console.print(Panel(
        "\n".join(ev_lines),
        title="Evidence",
        border_style="blue",
    ))

    # Pathway recommendations table
    table = Table(title="Pathway Recommendations", show_lines=True)
    table.add_column("Category", style="bold")
    table.add_column("Recommendation", style="green")
    table.add_column("Confidence")
    table.add_column("Distribution")

    for node in PATHWAY_NODES:
        if node not in result["pathways"]:
            continue
        pw = result["pathways"][node]
        label = NODE_LABELS.get(node, node)
        dist_str = " | ".join(
            f"{s}={p:.0%}" for s, p in pw["distribution"].items()
        )
        conf_style = "green" if pw["confidence"] >= 0.5 else "yellow"
        table.add_row(
            label,
            pw["state"].replace("_", " "),
            f"[{conf_style}]{pw['confidence']:.0%}[/{conf_style}]",
            f"[dim]{dist_str}[/dim]",
        )
    console.print(table)

    # All referrals (from rule enforcement)
    refs = result.get("referrals_all", [])
    if refs and refs != ["none"]:
        ref_text = ", ".join(r.replace("_", " ") for r in refs)
        console.print(Panel(
            f"[bold]{ref_text}[/bold]",
            title="All Referrals (incl. rule-based)",
            border_style="yellow",
        ))

    # Hidden node posteriors table
    hidden_table = Table(title="Hidden Node Posteriors", show_lines=True)
    hidden_table.add_column("Factor", style="bold")
    hidden_table.add_column("Most Likely", style="cyan")
    hidden_table.add_column("Distribution")

    for node in HIDDEN_NODES:
        if node not in result["hidden"]:
            continue
        h = result["hidden"][node]
        label = NODE_LABELS.get(node, node)
        dist_str = " | ".join(
            f"{s}={p:.0%}" for s, p in h["distribution"].items()
        )
        hidden_table.add_row(
            label,
            h["state"].replace("_", " "),
            f"[dim]{dist_str}[/dim]",
        )
    console.print(hidden_table)

    # Flagged risks
    if result["risks"]:
        risk_text = Text()
        for risk in result["risks"]:
            risk_text.append(
                f"! {risk['label']}: {risk['state']} "
                f"(P={risk['probability']:.0%})\n",
                style="bold red",
            )
        console.print(Panel(risk_text, title="FLAGGED RISKS", border_style="red"))
    else:
        console.print(Panel(
            "No risks above threshold.",
            title="Risks",
            border_style="green",
        ))

    # Rules fired
    if result.get("rules_fired"):
        rule_text = Text()
        for rf in result["rules_fired"]:
            rule_text.append(f"[{rf['rule']}] ", style="bold yellow")
            rule_text.append(f"{rf['description']}\n")
            rule_text.append(f"  Action: {rf['action']}\n", style="dim")
        console.print(Panel(rule_text, title="Rules Fired", border_style="yellow"))

    console.print(f"\n[dim]{LIMITATIONS_NOTE}[/dim]")


@click.group()
def main():
    """ALAC Wheelchair Referral Screening — Bayesian Network Prototype."""
    pass


@main.command("scenario")
@click.argument("name")
@click.option("--threshold", "-t", default=0.30, help="Risk flagging threshold")
def run_scenario(name: str, threshold: float):
    """Run a named toy scenario."""
    try:
        sc = get_scenario(name)
    except KeyError:
        console.print(f"[red]Unknown scenario: {name}[/red]")
        console.print("Available scenarios:")
        for s in list_scenarios():
            console.print(f"  [bold]{s['id']}[/bold] — {s['description']}")
        raise SystemExit(1)

    console.print(Panel(
        f"[bold]{sc['name']}[/bold]\n{sc['description']}",
        title="Scenario",
        border_style="magenta",
    ))

    result = classify(sc["evidence"], risk_threshold=threshold)
    _render_results(result, sc["evidence"])


@main.command("scenarios")
def list_all_scenarios():
    """List all available toy scenarios."""
    table = Table(title="Available Scenarios")
    table.add_column("ID", style="bold")
    table.add_column("Name")
    table.add_column("Description")

    for s in list_scenarios():
        table.add_row(s["id"], s["name"], s["description"])
    console.print(table)


@main.command("query")
@click.option("--age", type=click.Choice(NODE_STATES["age"]))
@click.option("--weight", type=click.Choice(NODE_STATES["weight"]))
@click.option("--diag", type=click.Choice(NODE_STATES["diag"]))
@click.option("--contra", type=click.Choice(NODE_STATES["contra"]))
@click.option("--seizure", type=click.Choice(NODE_STATES["seizure"]))
@click.option("--mobil", type=click.Choice(NODE_STATES["mobil"]))
@click.option("--sex", type=click.Choice(NODE_STATES["sex"]))
@click.option("--posture", type=click.Choice(NODE_STATES["posture"]))
@click.option("--height", "height_", type=click.Choice(NODE_STATES["height"]))
@click.option("--hip", type=click.Choice(NODE_STATES["hip"]))
@click.option("--leg-upper", "legUpper", type=click.Choice(NODE_STATES["legUpper"]))
@click.option("--lower-leg", "lowerLeg", type=click.Choice(NODE_STATES["lowerLeg"]))
@click.option("--self-propel", "selfPropel", type=click.Choice(NODE_STATES["selfPropel"]))
@click.option("--joint-lim", "jointLim", type=click.Choice(NODE_STATES["jointLim"]))
@click.option("--transfer", type=click.Choice(NODE_STATES["transfer"]))
@click.option("--fatigue", type=click.Choice(NODE_STATES["fatigue"]))
@click.option("--in-hospital", "inHospital", type=click.Choice(NODE_STATES["inHospital"]))
@click.option("--lives-alone", "lives_alone", type=click.Choice(NODE_STATES["lives_alone"]))
@click.option("--multiple-environments", "multiple_environments",
              type=click.Choice(NODE_STATES["multiple_environments"]))
@click.option("--access-another-floor", "access_another_floor",
              type=click.Choice(NODE_STATES["access_another_floor"]))
@click.option("--is-carer", "is_carer", type=click.Choice(NODE_STATES["is_carer"]))
@click.option("--level-support", "level_support",
              type=click.Choice(NODE_STATES["level_support"]))
@click.option("--small-door", "small_door", type=click.Choice(NODE_STATES["small_door"]))
@click.option("--min-turn-circle", "min_turn_circle",
              type=click.Choice(NODE_STATES["min_turn_circle"]))
@click.option("--motability", type=click.Choice(NODE_STATES["motability"]))
@click.option("--threshold", "-t", default=0.30, help="Risk flagging threshold")
def run_query(threshold: float, **kwargs):
    """Run inference with specified evidence values."""
    evidence = {}
    key_map = {"height_": "height"}
    for k, v in kwargs.items():
        if v is not None:
            node = key_map.get(k, k)
            evidence[node] = v

    if not evidence:
        console.print("[red]No evidence provided. Use --help for options.[/red]")
        raise SystemExit(1)

    n_provided = len(evidence)
    n_total = len(OBSERVABLE_NODES)
    if n_provided < n_total:
        console.print(
            f"[yellow]Partial evidence: {n_provided}/{n_total} fields provided. "
            f"Missing fields will use prior distributions.[/yellow]\n"
        )

    result = classify(evidence, risk_threshold=threshold)
    _render_results(result, evidence)


@main.command("interactive")
@click.option("--threshold", "-t", default=0.30, help="Risk flagging threshold")
def interactive(threshold: float):
    """Guided form that prompts for each field, then runs inference."""
    console.print(Panel(
        "Answer each question below. Press Enter to skip (uses prior).",
        title="Interactive Referral Form",
        border_style="cyan",
    ))

    evidence = {}
    prompts = {
        "weight": "Weight category",
        "diag": "Primary diagnosis",
        "contra": "Contraindications",
        "seizure": "Seizure status",
        "mobil": "Mobility status",
        "age": "Age bracket",
        "sex": "Sex",
        "posture": "Posture in wheelchair",
        "height": "Height category",
        "hip": "Hip width",
        "legUpper": "Upper leg length",
        "lowerLeg": "Lower leg length",
        "selfPropel": "Self-propelled (technical ability)",
        "jointLim": "Joint limitations",
        "transfer": "Transfer ability",
        "fatigue": "Fatigue profile",
        "inHospital": "Hospital status",
        "lives_alone": "Lives alone",
        "multiple_environments": "Needs multiple environments",
        "access_another_floor": "Needs to access another floor",
        "is_carer": "Has caring responsibility",
        "level_support": "Level of support",
        "small_door": "Smallest doorway",
        "min_turn_circle": "Minimum turning circle",
        "motability": "Has Motability vehicle",
    }

    for node in OBSERVABLE_NODES:
        states = NODE_STATES[node]
        label = prompts.get(node, node)
        options = ", ".join(states)
        console.print(f"\n[bold]{label}[/bold] [{options}]")
        value = input("  > ").strip()
        if value and value in states:
            evidence[node] = value
        elif value:
            console.print(f"  [yellow]Invalid value '{value}', skipping.[/yellow]")

    console.print()
    result = classify(evidence, risk_threshold=threshold)
    _render_results(result, evidence)


if __name__ == "__main__":
    main()
