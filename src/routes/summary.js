const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../auth");
const { DEPARTMENTS } = require("../data");

const router = express.Router();

// GET /api/summary/today -> admin dashboard numbers
router.get("/today", requireAuth, requireAdmin, (req, res) => {
  const { entries } = db.load();

  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const startOfDay = d.getTime();
  const todayEntries = entries.filter(e => e.createdAt >= startOfDay);

  const totalMinutes = todayEntries.reduce((sum, e) => sum + (e.timeTakenMinutes || 0), 0);

  const byDept = DEPARTMENTS.map(dep => {
    const rows = todayEntries.filter(e => e.department === dep.id);
    const minutes = rows.reduce((sum, e) => sum + (e.timeTakenMinutes || 0), 0);
    return { department: dep.id, code: dep.code, label: dep.label, count: rows.length, minutes };
  });

  const activeDepts = byDept.filter(d => d.count > 0).length;

  res.json({
    entriesToday: todayEntries.length,
    activeDepts,
    totalDepts: DEPARTMENTS.length,
    hoursLogged: Math.round(totalMinutes / 60),
    byDept,
  });
});

module.exports = router;
