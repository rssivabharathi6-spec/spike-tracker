const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { signToken, requireAuth } = require("../auth");
const { accessibleSections } = require("../data");

const router = express.Router();

// POST /api/auth/login  { username, password } -> { token, user }
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const { users } = db.load();
  const user = users.find(u => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  const publicUser = {
    username: user.username,
    fullName: user.fullName,
    department: user.department,
    isAdmin: user.isAdmin,
  };
  const token = signToken(publicUser);
  res.json({ token, user: publicUser });
});

// GET /api/auth/me -> current session's user + which sections they can see/fill
router.get("/me", requireAuth, (req, res) => {
  const sections = accessibleSections(req.user).map(s => s.id);
  res.json({ user: req.user, accessibleSectionIds: sections });
});

module.exports = router;
