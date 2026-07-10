const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const { DEPARTMENTS, TIME_UNIT_DEPTS, canSubmitGenericEntry } = require("../data");

const router = express.Router();

const VALID_DEPT_IDS = new Set(DEPARTMENTS.map(d => d.id));

// GET /api/entries?department=CUTTING&today=true
router.get("/", requireAuth, (req, res) => {
  const { entries } = db.load();
  let rows = entries;

  if (req.query.department && req.query.department !== "all") {
    rows = rows.filter(e => e.department === req.query.department);
  }
  if (req.query.today === "true") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const startOfDay = d.getTime();
    rows = rows.filter(e => e.createdAt >= startOfDay);
  }

  rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
  res.json({ entries: rows });
});

// POST /api/entries
// Body: { task, quantity, unit, timeTakenMinutes, line, worker, remarks,
//         styleNumber, finishingDate, department? }
// `department` may only be set explicitly by admins; everyone else logs
// against their own department (and only if their department keeps a
// generic log — see NO_GENERIC_LOG_DEPTS).
router.post("/", requireAuth, (req, res) => {
  const state = db.load();
  const body = req.body || {};

  if (!canSubmitGenericEntry(req.user)) {
    return res.status(403).json({
      error: `${req.user.department} does not keep a generic daily log — use the relevant Section instead.`,
    });
  }

  let department = req.user.department;
  if (req.user.isAdmin && body.department) {
    if (!VALID_DEPT_IDS.has(body.department)) {
      return res.status(400).json({ error: "Unknown department." });
    }
    department = body.department;
  }
  if (!VALID_DEPT_IDS.has(department)) {
    return res.status(400).json({ error: "Your account has no floor department to log against." });
  }

  const task = String(body.task || "").trim();
  const quantity = Number(body.quantity);
  const worker = String(body.worker || "").trim();

  if (!task || !worker || !quantity || Number.isNaN(quantity)) {
    return res.status(400).json({ error: "Please fill in task, quantity, and worker." });
  }

  // Time is expected pre-converted to minutes (mirrors the frontend's own
  // mins/hrs/days -> minutes conversion for TIME_UNIT_DEPTS). If a raw
  // timeTaken + timeUnit pair is sent instead, convert it here as a fallback.
  let timeTakenMinutes = Number(body.timeTakenMinutes);
  if (Number.isNaN(timeTakenMinutes)) {
    const raw = Number(body.timeTaken) || 0;
    const unit = body.timeUnit || "mins";
    if (TIME_UNIT_DEPTS.includes(department) && unit === "hrs") timeTakenMinutes = raw * 60;
    else if (TIME_UNIT_DEPTS.includes(department) && unit === "days") timeTakenMinutes = raw * 60 * 24;
    else timeTakenMinutes = raw;
  }
  timeTakenMinutes = Math.round(timeTakenMinutes) || 0;

  const entry = {
    id: state.seq.entries++,
    department,
    task,
    quantity,
    unit: body.unit || "pcs",
    timeTakenMinutes,
    line: body.line || "-",
    worker,
    remarks: String(body.remarks || "").trim(),
    styleNumber: String(body.styleNumber || "").trim(),
    finishingDate: body.finishingDate || "",
    createdBy: req.user.username,
    createdAt: Date.now(),
  };

  state.entries.push(entry);
  db.persist().then(() => res.status(201).json({ entry }));
});

module.exports = router;
