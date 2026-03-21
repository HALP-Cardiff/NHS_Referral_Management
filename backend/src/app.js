const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { router: documentsRouter } = require("./routes/documents");

const app = express();

const defaultOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin
      ? corsOrigin.split(",").map((s) => s.trim())
      : defaultOrigins,
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api", (req, res) => {
  res.json({ message: "NHS Referral Management API" });
});

app.use("/api/documents", documentsRouter);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large (maximum 20 MB)" });
    }
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  const status = Number(err.statusCode) || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
  });
});

module.exports = app;
