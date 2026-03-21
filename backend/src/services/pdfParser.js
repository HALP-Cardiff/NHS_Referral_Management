const { PDFParse } = require("pdf-parse");
const {
  ALEC_STROKE_FIELDS,
  SECTIONS,
} = require("../schemas/alecStrokeFields");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pdfInfoToJson(infoResult) {
  if (!infoResult?.info || typeof infoResult.info !== "object") {
    return { title: null, author: null, subject: null };
  }
  const i = infoResult.info;
  const str = (v) => {
    if (v == null) return null;
    if (typeof v === "string") return v;
    try {
      return String(v);
    } catch {
      return null;
    }
  };
  return {
    title: str(i.Title),
    author: str(i.Author),
    subject: str(i.Subject),
  };
}

async function extractRawText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    let meta = { title: null, author: null, subject: null };
    try {
      const infoResult = await parser.getInfo();
      meta = pdfInfoToJson(infoResult);
    } catch {
      /* optional metadata */
    }
    return {
      text: textResult.text ?? "",
      numpages: textResult.total,
      meta,
    };
  } finally {
    await parser.destroy();
  }
}

function normalizeText(raw) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ");
}

/**
 * Build a flexible regex for a field label.
 * Handles things like "Age/ DOB", "Mobility (limited/walking)",
 * "Stairs/Lifts" by allowing flexible whitespace around slashes and parens.
 */
function buildFlexLabelPattern(label) {
  const escaped = escapeRegex(label);
  return escaped
    .replace(/\\\//g, "\\s*/\\s*")
    .replace(/\\\(/g, "\\s*\\(\\s*")
    .replace(/\\\)/g, "\\s*\\)\\s*");
}

/**
 * Locate every known field label and every section header in the text,
 * returning their positions for index-based value extraction.
 */
function findFieldPositions(text) {
  const positions = [];

  for (const field of ALEC_STROKE_FIELDS) {
    const flexLabel = buildFlexLabelPattern(field.label);
    const pattern = new RegExp(`${flexLabel}\\s*:\\s*`, "i");
    const match = text.match(pattern);

    if (match && match.index != null) {
      positions.push({
        field,
        matchStart: match.index,
        valueStart: match.index + match[0].length,
        isHeader: false,
      });
    } else {
      positions.push({
        field,
        matchStart: -1,
        valueStart: -1,
        isHeader: false,
      });
    }
  }

  for (const [key, label] of Object.entries(SECTIONS)) {
    const pattern = new RegExp(escapeRegex(label), "i");
    const match = text.match(pattern);
    if (match && match.index != null) {
      positions.push({
        field: { key: `__section_${key}`, label, section: key, required: false },
        matchStart: match.index,
        valueStart: -1,
        isHeader: true,
      });
    }
  }

  return positions;
}

function parseAlecFields(rawText) {
  const text = normalizeText(rawText);
  const allPositions = findFieldPositions(text);

  const sortedFound = allPositions
    .filter((p) => p.matchStart >= 0)
    .sort((a, b) => a.matchStart - b.matchStart);

  const fields = {};
  const missingRequired = [];

  const notFound = allPositions.filter(
    (p) => p.matchStart < 0 && !p.isHeader
  );
  for (const pos of notFound) {
    if (pos.field.required) {
      missingRequired.push({
        key: pos.field.key,
        label: pos.field.label,
        section: pos.field.section,
      });
    }
  }

  for (let i = 0; i < sortedFound.length; i++) {
    const pos = sortedFound[i];
    if (pos.isHeader || pos.valueStart < 0) continue;

    const nextPos = sortedFound[i + 1];
    const endIdx = nextPos ? nextPos.matchStart : text.length;
    const rawValue = text.substring(pos.valueStart, endIdx).trim();

    const cleaned = rawValue
      .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
      .replace(/\n{2,}/g, "\n")
      .trim();

    if (cleaned.length > 0) {
      fields[pos.field.key] = {
        label: pos.field.label,
        value: cleaned,
        section: pos.field.section,
      };
    } else if (pos.field.required) {
      missingRequired.push({
        key: pos.field.key,
        label: pos.field.label,
        section: pos.field.section,
      });
    }
  }

  return { fields, missingRequired };
}

function detectFormType(rawText) {
  const lower = rawText.toLowerCase();
  if (lower.includes("alec") && lower.includes("screening form")) {
    return "alec_screening";
  }
  return null;
}

async function parseAlecPdf(buffer) {
  const raw = await extractRawText(buffer);

  const formType = detectFormType(raw.text);
  if (formType !== "alec_screening") {
    return {
      rawText: raw.text,
      numpages: raw.numpages,
      meta: raw.meta,
      fields: {},
      missingRequired: [],
      isValid: false,
      formDetected: false,
      error:
        "This does not appear to be a valid ALEC Screening Form. " +
        "Ensure the PDF contains the header 'ALEC Service – Screening Form'.",
    };
  }

  const parsed = parseAlecFields(raw.text);

  return {
    rawText: raw.text,
    numpages: raw.numpages,
    meta: raw.meta,
    fields: parsed.fields,
    missingRequired: parsed.missingRequired,
    isValid: parsed.missingRequired.length === 0,
    formDetected: true,
    error: null,
  };
}

module.exports = { parseAlecPdf, extractRawText };
