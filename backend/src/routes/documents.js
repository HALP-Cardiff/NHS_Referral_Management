const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { parseAlecPdf } = require("../services/pdfParser");
const {
  insertDocument,
  setDocumentVideo,
  setDocumentAnalysis,
  getDocumentById,
  getVideoStoragePath,
  listDocuments,
  deleteDocumentById,
} = require("../db");
const { analyseReferral } = require("../services/geminiService");

const PDF_MAX_BYTES = 20 * 1024 * 1024;
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
const UPLOAD_MAX_BYTES = Math.max(PDF_MAX_BYTES, VIDEO_MAX_BYTES);

const dataDir = path.join(__dirname, "..", "data");
const videosDir = path.join(dataDir, "videos");

function videoExtFromMime(mime) {
  const m = (mime || "").toLowerCase();
  if (m === "video/mp4") return "mp4";
  if (m === "video/webm") return "webm";
  if (m === "video/quicktime") return "mov";
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "file") {
      const name = (file.originalname || "").toLowerCase();
      const ok =
        file.mimetype === "application/pdf" || name.endsWith(".pdf");
      return cb(null, ok);
    }
    if (file.fieldname === "video") {
      const ok = videoExtFromMime(file.mimetype) != null;
      return cb(null, ok);
    }
    return cb(null, false);
  },
});

const router = express.Router();

router.post(
  "/",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res, next) => {
    let newId = null;
    let videoDiskPath = null;
    try {
      const pdfFile = req.files?.file?.[0];
      const videoFile = req.files?.video?.[0];

      if (videoFile && !pdfFile) {
        return res.status(400).json({
          error:
            'A video cannot be uploaded without a PDF. Include a PDF in the same request (field "file").',
        });
      }

      if (!pdfFile) {
        return res.status(400).json({
          error:
            'No PDF received. Send multipart/form-data with field name "file".',
        });
      }

      if (pdfFile.size > PDF_MAX_BYTES) {
        return res.status(400).json({
          error: `PDF too large (maximum ${PDF_MAX_BYTES / (1024 * 1024)} MB)`,
        });
      }

      if (videoFile && videoFile.size > VIDEO_MAX_BYTES) {
        return res.status(400).json({
          error: `Video too large (maximum ${VIDEO_MAX_BYTES / (1024 * 1024)} MB)`,
        });
      }

      const parsed = await parseAlecPdf(pdfFile.buffer);

      if (!parsed.formDetected) {
        return res.status(400).json({ error: parsed.error });
      }

      if (!parsed.isValid) {
        return res.status(400).json({
          error: "Required fields missing from the ALEC Screening Form",
          missing_fields: parsed.missingRequired,
          partial_result: {
            fields: parsed.fields,
            meta: parsed.meta,
            numpages: parsed.numpages,
          },
        });
      }

      const parsedJson = {
        numpages: parsed.numpages,
        meta: parsed.meta,
        fields: parsed.fields,
        isValid: true,
      };

      newId = insertDocument({
        originalFilename: pdfFile.originalname || "upload.pdf",
        mimeType: pdfFile.mimetype,
        pageCount: parsed.numpages,
        rawText: parsed.rawText,
        parsedJson,
      });

      if (videoFile) {
        const ext = videoExtFromMime(videoFile.mimetype);
        if (!ext) {
          deleteDocumentById(newId);
          newId = null;
          return res.status(400).json({ error: "Unsupported video type" });
        }
        fs.mkdirSync(videosDir, { recursive: true });
        const storageFilename = `${newId}.${ext}`;
        videoDiskPath = path.join(videosDir, storageFilename);
        fs.writeFileSync(videoDiskPath, videoFile.buffer);
        setDocumentVideo(newId, {
          originalFilename: videoFile.originalname || `video.${ext}`,
          mimeType: videoFile.mimetype,
          storageFilename,
        });
      }

      const doc = getDocumentById(newId);
      res.status(201).json(doc);
    } catch (err) {
      if (videoDiskPath) {
        try {
          fs.unlinkSync(videoDiskPath);
        } catch {
          /* ignore */
        }
      }
      if (newId != null) {
        try {
          deleteDocumentById(newId);
        } catch {
          /* ignore */
        }
      }
      next(err);
    }
  }
);

router.get("/", (req, res) => {
  const limit = req.query.limit;
  res.json({ documents: listDocuments(limit) });
});

router.post("/:id/analyse", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid document id" });
    }
    const doc = getDocumentById(id);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    if (!doc.parsed_json?.fields || Object.keys(doc.parsed_json.fields).length === 0) {
      return res.status(400).json({ error: "No parsed fields available for analysis" });
    }

    const analysis = await analyseReferral(doc.parsed_json.fields);
    setDocumentAnalysis(id, analysis);

    const updated = getDocumentById(id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/video", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid document id" });
  }
  const doc = getDocumentById(id);
  if (!doc || !doc.has_video) {
    return res.status(404).json({ error: "Video not found" });
  }
  const relative = getVideoStoragePath(id);
  if (!relative) {
    return res.status(404).json({ error: "Video not found" });
  }
  const abs = path.join(videosDir, relative);
  if (!fs.existsSync(abs)) {
    return res.status(404).json({ error: "Video file missing" });
  }
  res.setHeader(
    "Content-Type",
    doc.video_mime_type || "application/octet-stream"
  );
  res.setHeader("Content-Disposition", "inline");
  res.sendFile(path.resolve(abs));
});

router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid document id" });
  }
  const doc = getDocumentById(id);
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }
  res.json(doc);
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid document id" });
  }

  const deleted = deleteDocumentById(id);
  if (!deleted) {
    return res.status(404).json({ error: "Document not found" });
  }

  return res.status(204).send();
});

module.exports = { router, upload };
