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

const documentColumns = db.prepare(`PRAGMA table_info(documents)`).all();
const documentColumnNames = new Set(documentColumns.map((c) => c.name));
if (!documentColumnNames.has("video_original_filename")) {
  db.exec(`ALTER TABLE documents ADD COLUMN video_original_filename TEXT`);
}
if (!documentColumnNames.has("video_mime_type")) {
  db.exec(`ALTER TABLE documents ADD COLUMN video_mime_type TEXT`);
}
if (!documentColumnNames.has("video_storage_path")) {
  db.exec(`ALTER TABLE documents ADD COLUMN video_storage_path TEXT`);
}
if (!documentColumnNames.has("analysis_json")) {
  db.exec(`ALTER TABLE documents ADD COLUMN analysis_json TEXT`);
}

function tryParseJson(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function mapRow(row, { fullText = true } = {}) {
  const has_video = Boolean(row.video_storage_path);
  return {
    id: row.id,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    page_count: row.page_count,
    raw_text: fullText ? row.raw_text : undefined,
    text_excerpt: row.text_excerpt ?? undefined,
    parsed_json: tryParseJson(row.parsed_json),
    analysis_json: tryParseJson(row.analysis_json),
    uploaded_at: row.uploaded_at,
    has_video,
    video_original_filename: row.video_original_filename ?? null,
    video_mime_type: row.video_mime_type ?? null,
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

function setDocumentVideo(
  id,
  { originalFilename, mimeType, storageFilename }
) {
  db.prepare(
    `
    UPDATE documents
    SET video_original_filename = @originalFilename,
        video_mime_type = @mimeType,
        video_storage_path = @storageFilename
    WHERE id = @id
  `
  ).run({
    id: Number(id),
    originalFilename: originalFilename ?? null,
    mimeType: mimeType ?? null,
    storageFilename: storageFilename ?? null,
  });
}

function getDocumentById(id) {
  const row = db
    .prepare(`SELECT * FROM documents WHERE id = ?`)
    .get(Number(id));
  if (!row) return null;
  return mapRow(row, { fullText: true });
}

function getVideoStoragePath(id) {
  const row = db
    .prepare(`SELECT video_storage_path FROM documents WHERE id = ?`)
    .get(Number(id));
  return row?.video_storage_path ?? null;
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
      parsed_json,
      analysis_json,
      video_storage_path,
      video_original_filename,
      video_mime_type
    FROM documents
    ORDER BY id DESC
    LIMIT ?
  `
    )
    .all(capped);
  return rows.map((row) => mapRow(row, { fullText: false }));
}

function deleteDocumentById(id) {
  const nid = Number(id);
  const row = db
    .prepare(`SELECT video_storage_path FROM documents WHERE id = ?`)
    .get(nid);
  const info = db.prepare(`DELETE FROM documents WHERE id = ?`).run(nid);
  if (info.changes > 0 && row?.video_storage_path) {
    const videoPath = path.join(dataDir, "videos", row.video_storage_path);
    try {
      fs.unlinkSync(videoPath);
    } catch {
      /* file may already be missing */
    }
  }
  return info.changes > 0;
}

function setDocumentAnalysis(id, analysisObj) {
  db.prepare(`UPDATE documents SET analysis_json = @json WHERE id = @id`).run({
    id: Number(id),
    json: JSON.stringify(analysisObj),
  });
}

module.exports = {
  db,
  insertDocument,
  setDocumentVideo,
  setDocumentAnalysis,
  getDocumentById,
  getVideoStoragePath,
  listDocuments,
  deleteDocumentById,
};
