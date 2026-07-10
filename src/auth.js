const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "12h";

function signToken(user) {
  return jwt.sign(
    {
      username: user.username,
      fullName: user.fullName,
      department: user.department,
      isAdmin: !!user.isAdmin,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

module.exports = { signToken, requireAuth, requireAdmin, JWT_SECRET };
