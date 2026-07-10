const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { requireAuth } = require("../auth");
const { sectionMeta, accessibleSections, canFillSection } = require("../data");

const router = express.Router();

// Files (T&A schedule attachments, etc.) are saved to disk under
// <project root>/uploads and served statically from /uploads (see server.js).
// NOTE: on hosts with an ephemeral filesystem (e.g. Render's free tier)
// this folder gets wiped on redeploy, same caveat as data/db.json — see README.
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, unique);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only image or PDF files are allowed."));
    }
    cb(null, true);
  },
});

function canViewSection(user, section) {
  return user.department === "PLANNING" || section.depts.includes(user.department);
}

// GET /api/sections -> sections this user can see, with a canFill flag
router.get("/", requireAuth, (req, res) => {
  const sections = accessibleSections(req.user).map(s => ({
    id: s.id,
    title: s.title,
    fields: s.fields,
    canFill: canFillSection(req.user, s),
  }));
  res.json({ sections });
});

// GET /api/sections/:id/entries
router.get("/:id/entries", requireAuth, (req, res) => {
  const section = sectionMeta(req.params.id);
  if (!section) return res.status(404).json({ error: "Unknown section." });
  if (!canViewSection(req.user, section)) {
    return res.status(403).json({ error: "You don't have access to this section." });
  }

  const { sectionEntries } = db.load();
  const rows = sectionEntries
    .filter(e => e.sectionId === section.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ entries: rows });
});

// POST /api/sections/:id/entries
// Plain sections:  JSON body { values: { ...fieldKey: value } }
// Sections with a "file" field: multipart/form-data — the file itself under
// its field key (e.g. "attachment"), plus every other field JSON-encoded
// under a "valuesJson" part (see public/index.html's submit handler).
// upload.any() is a no-op and leaves req.body untouched when the request
// isn't multipart, so this route serves both cases.
router.post("/:id/entries", requireAuth, upload.any(), (req, res) => {
  const section = sectionMeta(req.params.id);
  if (!section) return res.status(404).json({ error: "Unknown section." });
  if (!canFillSection(req.user, section)) {
    return res.status(403).json({ error: "Your department can't submit entries to this section." });
  }

  let rawValues = {};
  if (req.is("multipart/form-data")) {
    try {
      rawValues = req.body.valuesJson ? JSON.parse(req.body.valuesJson) : {};
    } catch (e) {
      return res.status(400).json({ error: "Malformed form data." });
    }
  } else {
    rawValues = (req.body && req.body.values) || {};
  }

  const values = {};
  let missingRequired = false;

  section.fields.forEach(f => {
    if (f.type === "file") {
      const uploaded = (req.files || []).find(file => file.fieldname === f.key);
      if (uploaded) {
        values[f.key] = {
          originalName: uploaded.originalname,
          url: `/uploads/${uploaded.filename}`,
          mimeType: uploaded.mimetype,
          size: uploaded.size,
        };
      } else {
        values[f.key] = null;
      }
      if (f.required && !values[f.key]) missingRequired = true;
      return;
    }
    const val = rawValues[f.key] !== undefined && rawValues[f.key] !== null ? String(rawValues[f.key]).trim() : "";
    if (f.required && !val) missingRequired = true;
    values[f.key] = val;
  });

  if (missingRequired) {
    return res.status(400).json({ error: "Please fill in all required fields." });
  }

  const state = db.load();
  const entry = {
    id: state.seq.sectionEntries++,
    sectionId: section.id,
    department: req.user.department,
    createdBy: req.user.username,
    createdAt: Date.now(),
    values,
  };
  state.sectionEntries.push(entry);
  db.persist().then(() => res.status(201).json({ entry }));
});

module.exports = router;
