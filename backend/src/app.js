const express = require("express");
const cors = require("cors");

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

module.exports = app;
