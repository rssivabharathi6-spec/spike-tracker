const express = require("express");
const { requireAuth } = require("../auth");
const {
  DEPARTMENTS,
  EXEC_DEPARTMENTS,
  NO_GENERIC_LOG_DEPTS,
  TIME_UNIT_DEPTS,
  LINES,
  UNITS,
} = require("../data");

const router = express.Router();

// GET /api/departments -> static config the frontend needs to render forms/tabs
router.get("/", requireAuth, (req, res) => {
  res.json({
    departments: DEPARTMENTS,
    execDepartments: EXEC_DEPARTMENTS,
    noGenericLogDepts: NO_GENERIC_LOG_DEPTS,
    timeUnitDepts: TIME_UNIT_DEPTS,
    lines: LINES,
    units: UNITS,
  });
});

module.exports = router;
