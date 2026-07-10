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

// Warm the DB (creates + seeds data/db.json on first boot).
db.load();

app.get("/api/health", (req, res) => res.json({ ok: true, time: Date.now() }));

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/entries", entryRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/summary", summaryRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Spike Creations backend listening on http://localhost:${PORT}`);
});
