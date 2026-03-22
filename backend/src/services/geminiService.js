const { GoogleGenerativeAI } = require("@google/generative-ai");
const { buildKnowledgeContext } = require("../knowledge/wheelchairKnowledge");

const MODEL_NAME = "gemma-3-27b-it";

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

const SYSTEM_PROMPT = `You are an expert NHS wheelchair referral triage assistant. You analyse patient referral data using a structured clinical knowledge base (provided below) to produce evidence-based recommendations.

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

async function analyseReferral(parsedFields) {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL_NAME });

  const knowledgeContext = buildKnowledgeContext();
  const patientData = formatPatientData(parsedFields);

  const prompt = `${SYSTEM_PROMPT}

${knowledgeContext}

${patientData}

Now analyse this patient's data against the knowledge base. Produce your response with the three sections: Pathway, References, and Clinical Reasoning.`;

  const result = await callWithRetry(() => model.generateContent(prompt));
  const response = result.response;
  const text = response.text();

  return parseGeminiResponse(text);
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
