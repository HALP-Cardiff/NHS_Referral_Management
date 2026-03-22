const { GoogleGenerativeAI } = require("@google/generative-ai");
const { buildKnowledgeContext } = require("../knowledge/wheelchairKnowledge");

const MODEL_NAME = "gemma-3-27b-it";
const BN_SERVICE_URL = process.env.BN_SERVICE_URL || "http://127.0.0.1:10000";
const BN_API_KEY = process.env.BN_API_KEY || "";
const BN_TIMEOUT_MS = parseInt(process.env.BN_TIMEOUT_MS || "15000", 10);

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw Object.assign(new Error("GEMINI_API_KEY is not configured"), {
      statusCode: 503,
    });
  }
  return new GoogleGenerativeAI(key);
}

function formatPatientData(parsedFields) {
  const lines = ["=== PATIENT REFERRAL DATA ===\n"];

  const sectionLabels = {
    patient: "Patient Observed States",
    clinical: "Clinical Decisions",
    environment: "Environment Observed States",
  };

  const grouped = {};
  for (const [key, entry] of Object.entries(parsedFields)) {
    const s = entry.section || "other";
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push({ key, ...entry });
  }

  for (const sectionKey of ["patient", "clinical", "environment", "other"]) {
    const fields = grouped[sectionKey];
    if (!fields?.length) continue;
    lines.push(`--- ${sectionLabels[sectionKey] || sectionKey} ---`);
    for (const f of fields) {
      lines.push(`  ${f.label}: ${f.value}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── BN service integration ─────────────────────────────────────────────────

async function fetchBnClassification(parsedFields) {
  const url = `${BN_SERVICE_URL}/api/bn/classify-from-alec`;
  const headers = { "Content-Type": "application/json" };
  if (BN_API_KEY) headers["x-api-key"] = BN_API_KEY;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BN_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ fields: parsedFields }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`BN service returned ${res.status}: ${body}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function formatBnResults(bn) {
  const lines = ["=== BAYESIAN NETWORK INFERENCE RESULTS ===\n"];
  lines.push(
    "The following recommendations were computed by exact probabilistic inference",
    "over a validated clinical Bayesian Network. Use these as your primary basis",
    "for the Pathway recommendation. Validate against the knowledge base rules",
    "and explain/contextualise the results in your Clinical Reasoning.\n"
  );

  lines.push("--- Pathway Recommendations ---");
  for (const [node, data] of Object.entries(bn.pathways || {})) {
    const pct = (data.confidence * 100).toFixed(1);
    lines.push(`  ${node}: ${data.state} (${pct}% confidence)`);
    if (data.distribution) {
      const dist = Object.entries(data.distribution)
        .map(([s, p]) => `${s}=${(p * 100).toFixed(1)}%`)
        .join(", ");
      lines.push(`    Distribution: ${dist}`);
    }
  }

  lines.push("\n--- Hidden / Inferred States ---");
  for (const [node, data] of Object.entries(bn.hidden || {})) {
    const pct = (data.confidence * 100).toFixed(1);
    lines.push(`  ${node}: ${data.state} (${pct}% confidence)`);
  }

  if (bn.risks?.length) {
    lines.push("\n--- Flagged Risks ---");
    for (const r of bn.risks) {
      const pct = (r.probability * 100).toFixed(1);
      lines.push(`  ! ${r.label}: ${r.state} (P=${pct}%)`);
    }
  }

  if (bn.rules_fired?.length) {
    lines.push("\n--- Absolute Rules Fired ---");
    for (const rf of bn.rules_fired) {
      lines.push(`  [${rf.rule}] ${rf.description}`);
      lines.push(`         Action: ${rf.action}`);
    }
  }

  if (bn.referrals_all?.length) {
    lines.push(`\n--- All Referrals: ${bn.referrals_all.join(", ")} ---`);
  }

  if (bn.mapped_evidence) {
    lines.push("\n--- Mapped Evidence (ALEC → BN) ---");
    for (const [node, state] of Object.entries(bn.mapped_evidence)) {
      lines.push(`  ${node} = ${state}`);
    }
  }

  if (bn.unmapped_fields?.length) {
    lines.push(`\n--- Unmapped ALEC Fields: ${bn.unmapped_fields.join(", ")} ---`);
    lines.push("  (These fields could not be mapped to BN nodes — consider them manually.)");
  }

  lines.push("");
  return lines.join("\n");
}

// ── System prompts ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT_WITH_BN = `You are an expert NHS wheelchair referral triage assistant. A clinical Bayesian Network has already analysed this patient's ALEC Screening Form data and produced structured probabilistic recommendations (provided below as "BAYESIAN NETWORK INFERENCE RESULTS").

Your task: Use the BN results as your primary basis, validate them against the clinical knowledge base, and produce three clearly separated sections:

1. **Pathway** – The recommended wheelchair provision pathway. The BN has already computed:
   - Wheelchair type, size, modifications, urgency, and referrals with confidence scores.
   - You should adopt the BN's recommendations unless you identify a clear conflict with the knowledge base rules. If you disagree with the BN on any point, explain why.

2. **References** – The specific rules, edges, and knowledge base nodes that support or conflict with the BN's output. Cite each rule or edge explicitly. Note which absolute rules the BN has already enforced (listed in "Absolute Rules Fired").

3. **Clinical Reasoning** – A step-by-step narrative explaining HOW the BN moved from patient observables (Tier 0) and environment observables (Tier 1) through the hidden inferred layer (Tier 2) to the output layer (Tier 3). Use the probability distributions provided by the BN to discuss confidence levels and any areas of uncertainty. Address any unmapped fields that the BN could not process.

IMPORTANT CONSTRAINTS:
- The BN's absolute rule enforcement is authoritative — do NOT override rules the BN has already applied.
- You MUST consider all SOFT RULES and note when they influenced your reasoning.
- You MUST follow the causal edges defined in the knowledge base.
- If the BN could not map certain ALEC fields (listed as "Unmapped ALEC Fields"), you should reason about those fields manually using the knowledge base.
- Convert patient measurements to inches when comparing against thresholds (1 cm ≈ 0.3937 inches).
- If data is ambiguous or missing, state assumptions clearly.
- Structure your output with clear markdown headings: ## Pathway, ## References, ## Clinical Reasoning.
- Be thorough but concise. Every claim must trace back to a specific rule, edge, or BN output.`;

const SYSTEM_PROMPT_FALLBACK = `You are an expert NHS wheelchair referral triage assistant. You analyse patient referral data using a structured clinical knowledge base (provided below) to produce evidence-based recommendations.

Your task: Given a patient's ALEC Screening Form data, apply the knowledge base rules and causal edges to produce three clearly separated sections:

1. **Pathway** – The recommended wheelchair provision pathway. Include:
   - Wheelchair type (manual standard, manual lightweight, powered indoor, powered indoor/outdoor, specialist, bariatric)
   - Recommended size (width, depth, footplate height)
   - Any modifications needed (harness, pressure-relieving cushion, lateral supports, pelvic belt, etc.)
   - Urgency level (Urgent, Priority, Medium, Low)
   - Whether multiple chairs are needed

2. **References** – The specific rules, edges, and knowledge base nodes you used to reach your conclusions. Cite each rule or edge explicitly (e.g. "ABSOLUTE RULE: If unable to maintain sit independently due to posture, they will need a harness" or "EDGE: posture → modification"). This section must show full traceability.

3. **Clinical Reasoning** – A step-by-step narrative explaining HOW you moved from the patient observables (Tier 0) and environment observables (Tier 1) through the hidden inferred layer (Tier 2) to the output layer (Tier 3). Walk through each causal edge you activated, each rule you applied, and why. Explain any conflicts or trade-offs.

IMPORTANT CONSTRAINTS:
- You MUST apply all ABSOLUTE RULES without exception.
- You MUST consider all SOFT RULES and note when they influenced your reasoning.
- You MUST follow the causal edges defined in the knowledge base.
- Convert patient measurements to inches when comparing against thresholds (1 cm ≈ 0.3937 inches).
- If data is ambiguous or missing, state assumptions clearly.
- Structure your output with clear markdown headings: ## Pathway, ## References, ## Clinical Reasoning.
- Be thorough but concise. Every claim must trace back to a specific rule or edge.`;

// ── Retry logic ────────────────────────────────────────────────────────────

async function callWithRetry(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err?.message || "";
      const is429 = msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota");
      if (is429) {
        if (msg.includes("limit: 0") || msg.includes("exceeded your current quota")) {
          const friendly = Object.assign(
            new Error(
              "Gemini API daily quota exhausted. The free tier resets daily — please try again later or upgrade your API plan at https://ai.google.dev."
            ),
            { statusCode: 429 }
          );
          throw friendly;
        }
        if (attempt < maxRetries) {
          const retryMatch = msg.match(/retry in ([\d.]+)s/i);
          const waitSec = retryMatch
            ? Math.min(Math.ceil(parseFloat(retryMatch[1])) + 2, 30)
            : 10 * (attempt + 1);
          console.log(`Gemini rate-limited. Waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}...`);
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          continue;
        }
      }
      throw err;
    }
  }
}

// ── Main analysis function ─────────────────────────────────────────────────

async function analyseReferral(parsedFields) {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL_NAME });

  const knowledgeContext = buildKnowledgeContext();
  const patientData = formatPatientData(parsedFields);

  let bnResults = null;
  try {
    bnResults = await fetchBnClassification(parsedFields);
    console.log("BN service returned successfully");
  } catch (err) {
    console.warn("BN service unavailable, falling back to LLM-only:", err.message);
  }

  let prompt;
  if (bnResults) {
    const bnContext = formatBnResults(bnResults);
    prompt = `${SYSTEM_PROMPT_WITH_BN}

${knowledgeContext}

${patientData}

${bnContext}

Now analyse this patient's data. The Bayesian Network results above are your primary basis. Validate them against the knowledge base, address any unmapped fields, and produce your response with the three sections: Pathway, References, and Clinical Reasoning.`;
  } else {
    prompt = `${SYSTEM_PROMPT_FALLBACK}

${knowledgeContext}

${patientData}

Now analyse this patient's data against the knowledge base. Produce your response with the three sections: Pathway, References, and Clinical Reasoning.`;
  }

  const result = await callWithRetry(() => model.generateContent(prompt));
  const response = result.response;
  const text = response.text();

  const parsed = parseGeminiResponse(text);
  parsed.bnResults = bnResults;
  return parsed;
}

function parseGeminiResponse(raw) {
  const sections = { pathway: "", references: "", clinicalReasoning: "", raw };

  const pathwayMatch = raw.match(
    /##\s*Pathway\s*\n([\s\S]*?)(?=##\s*References|##\s*Clinical\s*Reasoning|$)/i
  );
  const referencesMatch = raw.match(
    /##\s*References\s*\n([\s\S]*?)(?=##\s*Clinical\s*Reasoning|$)/i
  );
  const reasoningMatch = raw.match(
    /##\s*Clinical\s*Reasoning\s*\n([\s\S]*?)$/i
  );

  if (pathwayMatch) sections.pathway = pathwayMatch[1].trim();
  if (referencesMatch) sections.references = referencesMatch[1].trim();
  if (reasoningMatch) sections.clinicalReasoning = reasoningMatch[1].trim();

  if (!sections.pathway && !sections.references && !sections.clinicalReasoning) {
    sections.pathway = raw;
  }

  return sections;
}

module.exports = { analyseReferral };
