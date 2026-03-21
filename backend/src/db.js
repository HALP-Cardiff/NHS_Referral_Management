const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "referrals.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_filename TEXT NOT NULL,
    mime_type TEXT,
    page_count INTEGER,
    raw_text TEXT,
    parsed_json TEXT,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function mapRow(row, { fullText = true } = {}) {
  let parsed_json = null;
  if (row.parsed_json) {
    try {
      parsed_json = JSON.parse(row.parsed_json);
    } catch {
      parsed_json = null;
    }
  }
  return {
    id: row.id,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    page_count: row.page_count,
    raw_text: fullText ? row.raw_text : undefined,
    text_excerpt: row.text_excerpt ?? undefined,
    parsed_json,
    uploaded_at: row.uploaded_at,
  };
}

function insertDocument({
  originalFilename,
  mimeType,
  pageCount,
  rawText,
  parsedJson,
}) {
  const stmt = db.prepare(`
    INSERT INTO documents (original_filename, mime_type, page_count, raw_text, parsed_json)
    VALUES (@originalFilename, @mimeType, @pageCount, @rawText, @parsedJson)
  `);
  const info = stmt.run({
    originalFilename,
    mimeType: mimeType ?? null,
    pageCount: pageCount ?? null,
    rawText: rawText ?? null,
    parsedJson:
      parsedJson !== undefined && parsedJson !== null
        ? JSON.stringify(parsedJson)
        : null,
  });
  return Number(info.lastInsertRowid);
}

function getDocumentById(id) {
  const row = db
    .prepare(`SELECT * FROM documents WHERE id = ?`)
    .get(Number(id));
  if (!row) return null;
  return mapRow(row, { fullText: true });
}

function listDocuments(limit = 50) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const rows = db
    .prepare(
      `
    SELECT
      id,
      original_filename,
      mime_type,
      page_count,
      uploaded_at,
      substr(COALESCE(raw_text, ''), 1, 320) AS text_excerpt,
      parsed_json
    FROM documents
    ORDER BY id DESC
    LIMIT ?
  `
    )
    .all(capped);
  return rows.map((row) => mapRow(row, { fullText: false }));
}

module.exports = {
  db,
  insertDocument,
  getDocumentById,
  listDocuments,
};
