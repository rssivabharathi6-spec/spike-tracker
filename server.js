require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const db = require("./src/db");
const authRoutes = require("./src/routes/auth");
const departmentRoutes = require("./src/routes/departments");
const entryRoutes = require("./src/routes/entries");
const sectionRoutes = require("./src/routes/sections");
const summaryRoutes = require("./src/routes/summary");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
// Uploaded T&A schedule files (images/PDFs) — see src/routes/sections.js
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Warm the DB (creates + seeds data/db.json on first boot).
db.load();

app.get("/api/health", (req, res) => res.json({ ok: true, time: Date.now() }));

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/entries", entryRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/summary", summaryRoutes);

// Fallback error handler. Multer (file upload) errors — wrong file type,
// file too large — arrive here with a useful .message; pass it through
// instead of masking it with a generic 500.
app.use((err, req, res, next) => {
  console.error(err);
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Spike Creations backend listening on http://localhost:${PORT}`);
});
