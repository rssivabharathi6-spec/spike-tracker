const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const { sectionMeta, accessibleSections, canFillSection } = require("../data");

const router = express.Router();

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

// POST /api/sections/:id/entries  Body: { values: { ...fieldKey: value } }
router.post("/:id/entries", requireAuth, (req, res) => {
  const section = sectionMeta(req.params.id);
  if (!section) return res.status(404).json({ error: "Unknown section." });
  if (!canFillSection(req.user, section)) {
    return res.status(403).json({ error: "Your department can't submit entries to this section." });
  }

  const rawValues = (req.body && req.body.values) || {};
  const values = {};
  let missingRequired = false;

  section.fields.forEach(f => {
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
