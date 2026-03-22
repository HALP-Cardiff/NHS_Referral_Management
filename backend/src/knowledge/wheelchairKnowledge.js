/**
 * Ben's Bayesian-network knowledge for wheelchair referral triage.
 * Structured as tiers, rules, and edge definitions so the RAG prompt
 * can feed this context to the LLM for clinical reasoning.
 */

const TIERS = {
  tier0_patient: {
    label: "Patient Observables (Tier 0)",
    nodes: [
      { id: "weight", label: "Weight category", states: ["Standard", "Bariatric"] },
      { id: "diag", label: "Diagnosis", states: ["CP", "MMD", "Stroke", "Fracture", "MS", "Dementia (LB)", "TBI"] },
      { id: "contra", label: "Contraindications", states: ["Cardiac", "Fatigue", "Palsy", "Other", "None"] },
      { id: "seizure", label: "Seizure status", states: ["Never", "In the last 12 months"] },
      { id: "mobil", label: "Mobility status", states: ["Limited walking", "Unable to walk"] },
      { id: "age", label: "Age category", states: ["Paediatric", "Adult", "Elderly"] },
      { id: "sex", label: "Sex", states: ["Male", "Female", "Intersex"] },
      { id: "posture", label: "Posture in the wheelchair", states: ["Can maintain sit", "Falls forward", "Falls sideways"] },
      { id: "height", label: "Height", states: ["19.5-22in"] },
      { id: "hip", label: "Hip width", states: ["Narrow (under 16in)", "Standard (16-18in)", "Wide (18-20in)", "Bariatric (over 20in)"] },
      { id: "legUpper", label: "Upper leg length", states: ["Short (under 16in)", "Standard (16-19in)", "Large (over 19in)"] },
      { id: "lowerLeg", label: "Lower leg length", states: ["Short (under 16in)", "Standard (16-20in)", "Large (over 20in)"] },
      { id: "selfPropel", label: "Self Propelled (technical ability)", states: ["Able", "Unable", "Unknown"] },
      { id: "jointLim", label: "Limited Joints", states: ["Able to sit", "Unable to sit"] },
      { id: "transfer", label: "Transfer ability", states: ["Independent", "Assisted", "Dependent"] },
      { id: "fatigue", label: "Fatigue profile", states: ["Stable", "Deteriorates"] },
      { id: "inHospital", label: "Hospital Status", states: ["Required", "Not required for discharge"] },
    ],
  },

  tier1_environment: {
    label: "Environment Observables (Tier 1)",
    nodes: [
      { id: "lives_alone", label: "Living alone", states: ["Yes", "No"] },
      { id: "multiple_environments", label: "Need to access multiple environments", states: ["Yes", "No"] },
      { id: "access_another_floor", label: "Needs to access another floor", states: ["Yes and possible in wheelchair", "Yes and impossible"] },
      { id: "is_carer", label: "Have caring responsibility for another person", states: ["Yes", "No"] },
      { id: "level_support", label: "Level of support", states: ["Has carer 24 hrs", "Has visiting carer", "No carer"] },
      { id: "small_door", label: "Smallest door", states: ["Narrow (under 27in)", "Standard (27-30in)", "Wide (30-33in)", "Accessible (over 33in)"] },
      { id: "min_turn_circle", label: "Minimum turning circle", states: ["Narrow (under 40in)", "Standard (40-50in)", "Wide (50-60in)", "Open (over 60in)"] },
      { id: "motability", label: "Have motability vehicle to fit wheelchair", states: ["Access to car", "No access to car"] },
    ],
  },

  tier2_hidden: {
    label: "Hidden (Inferred) Observables (Tier 2)",
    nodes: [
      { id: "actualPropel", label: "Actually able to self propel", states: ["Yes", "No"] },
      { id: "fallRiskInferred", label: "Fall risk inferred", states: ["High", "Medium", "Low"] },
      { id: "houseSuitability", label: "House Suitability", states: ["Suitable", "Adaptable", "Unsuitable"] },
      { id: "dualProvision", label: "More than one chair", states: ["Single chair", "Likely dual"] },
      { id: "powered_12", label: "Powered within 12 months", states: ["Yes", "No"] },
    ],
  },

  tier3_output: {
    label: "Output Nodes (Tier 3)",
    nodes: [
      {
        id: "size",
        label: "Max expected size of Wheelchair by category (Width, Depth, Height)",
        states: [
          "Manual Standard (19in width, 18in depth, 19.5in height)",
          "Manual Lightweight (19in width, 18in depth, 20in height)",
          "Powered Indoor (22in width, 20in depth, 20in height)",
          "Powered Indoor/Outdoor (24in width, 20in depth, 21in height)",
          "Specialist (22in width, 20in depth, 22in height)",
          "Bariatric (30in width, 22in depth, 22in height)",
        ],
      },
      { id: "type", label: "Wheelchair type", states: ["Manual standard", "Manual lightweight", "Powered indoor", "Powered indoor and outdoor", "Specialist", "Bariatric"] },
      { id: "multiple", label: "More than one recommendation", states: ["Multiple chairs", "Not multiple"] },
      { id: "modification", label: "Harness or additional postural support", states: ["Harness", "Pressure-relieving cushions", "None"] },
      { id: "referrals", label: "Referral to other services", states: ["Housing", "Motability", "Community OT"] },
      { id: "urgency", label: "Urgency level", states: ["Urgent", "Priority", "Medium", "Low"] },
    ],
  },
};

const ABSOLUTE_RULES = [
  "If the last seizure occurred in the last 12 months you are NOT permitted to drive powered equipment. You must be 12 months seizure-free to be permitted to drive powered equipment outdoors.",
  "Bariatric wheelchairs must be provided if hip width is greater than 20 inches or weight is bariatric category.",
  "The smallest door in the house that the person needs to pass through must be wider than the width of the wheelchair + 1 inch, AND the minimum turning circle must be wider than the turning circle of the wheelchair. If this is NOT true, generate a referral to Housing.",
  "If unable to maintain sitting independently due to posture, they will need a harness.",
  "If they do not have an accessible car, then they will need a Motability referral.",
  "actualPropel is influenced by tier0 selfPropelled (technical ability) AND by tier0 contraindications (e.g. cardiac function). If they can propel a wheelchair but DO have a contraindication, they will require a powered wheelchair.",
  "If the patient has a caring responsibility, they will probably need an electric wheelchair.",
  "If the patient is living alone, refer to Community OT.",
  "If the patient will need a powered wheelchair in 12 months, they need a powered wheelchair now.",
  "If the patient can actually propel, they need a manual wheelchair.",
  "If the patient is elderly or deaf, they have an increased fall risk.",
  "If the patient has a posture which falls (forward or sideways) they require a modification (harness).",
  "If fall risk is high, it should trigger a referral to the OT team.",
  "If there is a reason for a wider chair, the width of the chair should be equal to the required wider size.",
  "Upper limb difference may restrict actual self-propelled ability.",
];

const SOFT_RULES = [
  "Being in hospital with requirement to return home will increase urgency.",
  "Living alone can affect the type of wheelchair (powered).",
  "Living alone can affect urgency (increase).",
  "Level of support can affect urgency (decrease if high support available).",
  "Need to access multiple environments may require referral to appropriate team.",
  "In hospital increases urgency.",
];

const EDGES = {
  patient_to_hidden: [
    "age → fallRiskInferred",
    "age → powered_12",
    "age → progression",
    "sex → size",
    "weight → size",
    "weight → type",
    "height → size",
    "hip → size",
    "hip → type",
    "legUpper → size",
    "lowerLeg → size",
    "posture → modification",
    "posture → fallRiskInferred",
    "posture → type",
    "seizure → type",
    "seizure → actualPropel",
    "mobil → type",
    "mobil → actualPropel",
    "selfPropel → actualPropel",
    "fatigue → actualPropel",
    "fatigue → powered_12",
    "fatigue → progression",
    "transfer → fallRiskInferred",
    "transfer → urgency",
    "jointLim → size",
    "jointLim → type",
    "contra → actualPropel",
    "contra → type",
    "diag → progression",
    "diag → fallRiskInferred",
    "diag → powered_12",
    "diag → type",
    "inHospital → urgency",
  ],
  environment_to_hidden_and_outputs: [
    "lives_alone → referrals",
    "lives_alone → urgency",
    "lives_alone → type",
    "multiple_environments → referrals",
    "multiple_environments → type",
    "access_another_floor → houseSuitability",
    "level_support → urgency",
    "small_door → houseSuitability",
    "min_turn_circle → houseSuitability",
    "motability → referrals",
  ],
  hidden_to_output: [
    "fallRiskInferred → referrals",
    "fallRiskInferred → urgency",
    "fallRiskInferred → type",
    "powered_12 → type",
    "progression → powered_12",
    "progression → urgency",
    "houseSuitability → referrals",
    "houseSuitability → urgency",
    "actualPropel → type",
    "actualPropel → powered_12",
  ],
  output_to_output: [
    "type → size",
    "type → modification",
    "size → houseSuitability",
  ],
};

function buildKnowledgeContext() {
  const sections = [];

  sections.push("=== WHEELCHAIR REFERRAL TRIAGE KNOWLEDGE BASE ===\n");

  for (const [, tier] of Object.entries(TIERS)) {
    sections.push(`--- ${tier.label} ---`);
    for (const node of tier.nodes) {
      sections.push(`  ${node.id} (${node.label}): ${node.states.join(" | ")}`);
    }
    sections.push("");
  }

  sections.push("--- ABSOLUTE RULES (must always be applied) ---");
  for (const rule of ABSOLUTE_RULES) {
    sections.push(`  • ${rule}`);
  }
  sections.push("");

  sections.push("--- SOFT RULES (should be considered) ---");
  for (const rule of SOFT_RULES) {
    sections.push(`  • ${rule}`);
  }
  sections.push("");

  sections.push("--- CAUSAL EDGES (influence paths) ---");
  for (const [group, edges] of Object.entries(EDGES)) {
    sections.push(`  [${group}]`);
    for (const edge of edges) {
      sections.push(`    ${edge}`);
    }
  }

  return sections.join("\n");
}

module.exports = {
  TIERS,
  ABSOLUTE_RULES,
  SOFT_RULES,
  EDGES,
  buildKnowledgeContext,
};
