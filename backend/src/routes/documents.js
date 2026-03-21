const express = require("express");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const {
  insertDocument,
  getDocumentById,
  listDocuments,
  deleteDocumentById,
} = require("../db");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const ok =
      file.mimetype === "application/pdf" ||
      name.endsWith(".pdf");
    cb(null, ok);
  },
});

const router = express.Router();

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

async function extractFromPdfBuffer(buffer) {
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

router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error:
          "No PDF received. Send multipart/form-data with field name \"file\".",
      });
    }

    const extracted = await extractFromPdfBuffer(req.file.buffer);
    const parsedJson = {
      numpages: extracted.numpages,
      meta: extracted.meta,
      fields: {},
    };

    const id = insertDocument({
      originalFilename: req.file.originalname || "upload.pdf",
      mimeType: req.file.mimetype,
      pageCount: extracted.numpages,
      rawText: extracted.text,
      parsedJson,
    });

    const doc = getDocumentById(id);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

router.get("/", (req, res) => {
  const limit = req.query.limit;
  res.json({ documents: listDocuments(limit) });
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
