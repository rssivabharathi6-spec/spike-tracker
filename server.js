/* ==========================================================================
   SPIKE CREATIONS — BACKEND (single file)
   Everything the server needs — domain data, storage, auth, and every
   API route — lives in this one file on purpose, so future updates only
   ever require replacing two files: server.js (this) and public/index.html.
   ========================================================================== */

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const ExcelJS = require("exceljs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} = require("docx");

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "12h";

/* ==========================================================================
   1. DOMAIN DATA — departments, sections, demo accounts, permission rules.
   Ported 1:1 from the original spike-creations-tracker.html so behavior
   stays identical. public/index.html keeps its own copy of SECTIONS for
   rendering forms — if you add a section here, add it there too.
   ========================================================================== */

const DEPARTMENTS = [
  { id: "PRODUCTION",    code: "PRD", label: "Production" },
  { id: "CUTTING",       code: "CUT", label: "Cutting" },
  { id: "QUALITY",       code: "QC",  label: "Quality" },
  { id: "PLANNING",      code: "PLN", label: "Planning" },
  { id: "MERCHANDISE",   code: "MER", label: "Merchandise" },
  { id: "HR",            code: "HR",  label: "HR" },
  { id: "ACCOUNTS",      code: "ACC", label: "Accounts" },
  { id: "ADMIN",         code: "ADM", label: "Admin" },
  { id: "DOCUMENTATION", code: "DOC", label: "Documentation" },
  { id: "FABRIC",        code: "FAB", label: "Fabric" },
  { id: "IRONING",       code: "IRN", label: "Ironing" },
  { id: "PACKAGING",     code: "PKG", label: "Packaging" },
  { id: "STORE",         code: "STR", label: "Store" },
  { id: "FEEDING",       code: "FED", label: "Feeding" },
  { id: "SAMPLING",      code: "SMP", label: "Sampling" },
  { id: "ERP",           code: "ERP", label: "ERP Data Entry" },
];

const EXEC_DEPARTMENTS = [
  { id: "MD", code: "MD", label: "Managing Director" },
];

// Plaintext passwords here ONLY as the seed source — they're hashed with
// bcrypt the first time the DB is initialized (see buildFreshDB below).
// The plaintext values are never stored.
const USERS_SEED = [
  { username: "admin",       password: "admin123",        fullName: "Factory Admin",   department: "ADMIN",       isAdmin: true },
  { username: "MD",          password: "Spike Creations", fullName: "Managing Director", department: "MD",       isAdmin: true },
  { username: "production1", password: "pass123",  fullName: "R. Kumar",     department: "PRODUCTION",    isAdmin: false },
  { username: "cutting1",    password: "pass123",  fullName: "S. Devi",      department: "CUTTING",       isAdmin: false },
  { username: "quality1",    password: "pass123",  fullName: "M. Iqbal",     department: "QUALITY",       isAdmin: false },
  { username: "planning1",   password: "pass123",  fullName: "A. Nair",      department: "PLANNING",      isAdmin: false },
  { username: "merch1",      password: "pass123",  fullName: "P. Shah",      department: "MERCHANDISE",   isAdmin: false },
  { username: "hr1",         password: "pass123",  fullName: "K. Reddy",     department: "HR",            isAdmin: false },
  { username: "accounts1",   password: "pass123",  fullName: "V. Rao",       department: "ACCOUNTS",      isAdmin: false },
  { username: "docs1",       password: "pass123",  fullName: "T. Singh",     department: "DOCUMENTATION", isAdmin: false },
  { username: "fabric1",     password: "pass123",  fullName: "J. Menon",     department: "FABRIC",        isAdmin: false },
  { username: "ironing1",    password: "pass123",  fullName: "L. Bora",      department: "IRONING",       isAdmin: false },
  { username: "packaging1",  password: "pass123",  fullName: "N. Yadav",     department: "PACKAGING",     isAdmin: false },
  { username: "store1",      password: "pass123",  fullName: "D. Ghosh",     department: "STORE",         isAdmin: false },
  { username: "feeding1",    password: "pass123",  fullName: "O. Fernandes", department: "FEEDING",       isAdmin: false },
  { username: "sampling1",   password: "pass123",  fullName: "E. Pillai",    department: "SAMPLING",      isAdmin: false },
  { username: "erp1",        password: "pass123",  fullName: "H. Verma",     department: "ERP",           isAdmin: false },
];

// Departments that no longer keep a generic daily-work log — their
// tracking lives entirely inside the named cross-department Sections.
const NO_GENERIC_LOG_DEPTS = ["MERCHANDISE", "HR", "ACCOUNTS", "DOCUMENTATION"];

// Departments that log "time taken" in mixed mins/hrs/days.
const TIME_UNIT_DEPTS = ["PRODUCTION", "CUTTING", "QUALITY"];

const LINES = ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"];
const UNITS = ["pcs", "mtr", "kg", "sets", "invoice", "style", "shipment", "workers", "lines", "bundles"];

const ALL_FLOOR_DEPT_IDS = DEPARTMENTS.map(d => d.id);

const SECTIONS = [
  {
    id: "BUYER_COMM_COSTING",
    title: "Buyer Communication & Costing",
    depts: ["MERCHANDISE", "MD"],
    fillDepts: ["MERCHANDISE"],
    fields: [
      { key: "buyerName", label: "Buyer Name", type: "text", required: true },
      { key: "styleOrderRef", label: "Style / Order Ref", type: "text" },
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "costingStatus", label: "Costing Status", type: "select", options: ["Draft", "Sent to Buyer", "Under Negotiation", "Approved", "Rejected"] },
      { key: "followUpDate", label: "Follow-up Date", type: "date" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "SAMPLE_DEV",
    title: "Sample Development Process",
    depts: ["SAMPLING", "MERCHANDISE", "QUALITY", "MD"],
    fillDepts: ["SAMPLING"],
    fields: [
      { key: "styleSampleRef", label: "Style / Sample Ref", type: "text", required: true },
      { key: "buyerName", label: "Buyer", type: "text" },
      { key: "sampleType", label: "Sample Type", type: "select", options: ["Proto Sample", "Fit Sample", "PP Sample", "Size Set", "Salesman Sample", "Photoshoot Sample"] },
      { key: "sampleStage", label: "Sample Stage", type: "select", options: ["In Development", "Sent to Buyer", "Approved", "Rejected", "Revision Requested"] },
      { key: "fabricStatus", label: "Fabric Status", type: "select", options: ["Pending", "Sourced", "In-house"] },
      { key: "trimStatus", label: "Trim Status", type: "select", options: ["Pending", "Sourced", "In-house"] },
      { key: "submissionDate", label: "Submission Date", type: "date" },
      { key: "buyerComments", label: "Buyer Comments", type: "textarea" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "MATERIAL_SOURCING",
    title: "Material Sourcing",
    depts: ["FABRIC", "MERCHANDISE", "QUALITY", "SAMPLING", "MD"],
    fillDepts: ["FABRIC"],
    fields: [
      { key: "materialName", label: "Material / Fabric Name", type: "text", required: true },
      { key: "supplier", label: "Supplier", type: "text" },
      { key: "styleOrderRef", label: "Style / Order Ref", type: "text" },
      { key: "sourcingStatus", label: "Sourcing Status", type: "select", options: ["Requested", "Ordered", "In Transit", "Received", "Delayed"] },
      { key: "expectedDate", label: "Expected Date", type: "date" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "QUALITY_LAB_APPROVALS",
    title: "Quality & Lab Approvals",
    depts: ["MERCHANDISE", "SAMPLING", "PRODUCTION", "QUALITY", "FABRIC", "CUTTING", "MD"],
    fillDepts: ["QUALITY"],
    fields: [
      { key: "styleOrderRef", label: "Style / Order Ref", type: "text", required: true },
      { key: "testType", label: "Test / Inspection Type", type: "text" },
      { key: "labName", label: "Lab Name (if external)", type: "text" },
      { key: "approvalStatus", label: "Approval Status", type: "select", options: ["Submitted", "Pending", "Approved", "Rejected", "Retest Required"] },
      { key: "testDate", label: "Test Date", type: "date" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "PRODUCTION_TIMELINE",
    title: "Production & Timeline Management",
    depts: ["MERCHANDISE", "PRODUCTION", "PLANNING", "QUALITY", "PACKAGING", "HR", "DOCUMENTATION", "ACCOUNTS", "MD"],
    fillDepts: ["PRODUCTION"],
    fields: [
      { key: "styleOrderRef", label: "Style / Order Ref", type: "text", required: true },
      { key: "line", label: "Line", type: "select", options: ["-", ...LINES] },
      { key: "plannedStartDate", label: "Planned Start Date", type: "date" },
      { key: "plannedEndDate", label: "Planned End Date", type: "date" },
      { key: "currentStatus", label: "Current Status", type: "select", options: ["On Track", "Delayed", "Completed", "At Risk"] },
      { key: "delayReason", label: "Delay Reason (if any)", type: "text" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "SHIPPING_DOCS",
    title: "Shipping & Documentation",
    depts: ["MERCHANDISE", "ADMIN", "DOCUMENTATION", "QUALITY", "PLANNING", "MD"],
    fillDepts: ["DOCUMENTATION"],
    fields: [
      { key: "styleOrderRef", label: "Style / Order Ref", type: "text", required: true },
      { key: "shipmentRef", label: "Shipment / Invoice No.", type: "text" },
      { key: "shippingMode", label: "Shipping Mode", type: "select", options: ["Sea", "Air", "Road", "Courier"] },
      { key: "etd", label: "ETD", type: "date" },
      { key: "eta", label: "ETA", type: "date" },
      { key: "docStatus", label: "Document Status", type: "select", options: ["Pending", "Prepared", "Submitted to Buyer", "Cleared"] },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "MANPOWER_PLANNING",
    title: "Manpower Planning & Recruitment",
    depts: [...ALL_FLOOR_DEPT_IDS, "MD"],
    fillDepts: ["HR"],
    fields: [
      { key: "positionTitle", label: "Position / Role", type: "text", required: true },
      { key: "departmentNeeded", label: "Department Needed", type: "select", options: DEPARTMENTS.map(d => d.label) },
      { key: "headcount", label: "Headcount", type: "number" },
      { key: "recruitmentStatus", label: "Recruitment Status", type: "select", options: ["Open", "Interviewing", "Offer Extended", "Hired", "Closed"] },
      { key: "targetDate", label: "Target Date", type: "date" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "ACCOUNTS_PAYABLE",
    title: "Accounts Payable",
    depts: ["ACCOUNTS", "HR", "ADMIN", "PLANNING", "MD"],
    fillDepts: ["ACCOUNTS"],
    fields: [
      { key: "vendorName", label: "Vendor / Supplier Name", type: "text", required: true },
      { key: "invoiceRef", label: "Invoice / Bill No.", type: "text" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "dueDate", label: "Due Date", type: "date" },
      { key: "paymentStatus", label: "Payment Status", type: "select", options: ["Pending", "Approved", "Paid", "Overdue"] },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "ACCOUNTS_RECEIVABLE",
    title: "Accounts Receivable",
    depts: ["ACCOUNTS", "HR", "ADMIN", "PLANNING", "MD"],
    fillDepts: ["ACCOUNTS"],
    fields: [
      { key: "buyerName", label: "Buyer / Customer Name", type: "text", required: true },
      { key: "invoiceRef", label: "Invoice No.", type: "text" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "dueDate", label: "Due Date", type: "date" },
      { key: "paymentStatus", label: "Payment Status", type: "select", options: ["Pending", "Partially Received", "Received", "Overdue"] },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "FINANCIAL_REPORTING",
    title: "Financial Reporting",
    depts: ["ACCOUNTS", "HR", "ADMIN", "PLANNING", "MD"],
    fillDepts: ["ACCOUNTS"],
    fields: [
      { key: "reportTitle", label: "Report Title", type: "text", required: true },
      { key: "reportPeriod", label: "Period", type: "text" },
      { key: "reportType", label: "Report Type", type: "select", options: ["P&L", "Cash Flow", "Balance Sheet", "Cost Analysis", "Other"] },
      { key: "preparedDate", label: "Prepared Date", type: "date" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "EXPORT_SHIPPING_DOCS",
    title: "Export & Shipping Documentation",
    depts: ["DOCUMENTATION", "ADMIN", "MERCHANDISE", "PLANNING", "QUALITY", "MD"],
    fillDepts: ["DOCUMENTATION"],
    fields: [
      { key: "styleOrderRef", label: "Style / Order Ref", type: "text", required: true },
      { key: "documentType", label: "Document Type", type: "select", options: ["Commercial Invoice", "Packing List", "Certificate of Origin", "Bill of Lading", "GSP Certificate", "Other"] },
      { key: "buyerName", label: "Buyer", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Prepared", "Submitted", "Approved"] },
      { key: "submissionDate", label: "Submission Date", type: "date" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "TNA_SCHEDULE",
    title: "T&A Schedule",
    depts: ["MERCHANDISE", "MD"],
    fillDepts: ["MERCHANDISE"],
    fields: [
      { key: "styleOrderRef", label: "Style / Order Ref", type: "text", required: true },
      { key: "buyerName", label: "Buyer Name", type: "text" },
      { key: "orderConfirmationDate", label: "Order Confirmation Date", type: "date" },
      { key: "fabricBookingDate", label: "Fabric Booking Date", type: "date" },
      { key: "sampleApprovalDate", label: "Sample Approval Date", type: "date" },
      { key: "ppMeetingDate", label: "PP Meeting Date", type: "date" },
      { key: "cuttingStartDate", label: "Cutting Start Date", type: "date" },
      { key: "sewingStartDate", label: "Sewing Start Date", type: "date" },
      { key: "exFactoryDate", label: "Ex-Factory Date", type: "date" },
      { key: "shipmentDate", label: "Shipment Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["On Track", "Delayed", "Completed", "At Risk"] },
      { key: "attachment", label: "T&A Schedule File (image or PDF)", type: "file" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    id: "PLANNING_SCHEDULE",
    title: "Planning Schedule",
    depts: ["PLANNING", "MD"],
    fillDepts: ["PLANNING"],
    fields: [
      { key: "styleOrderRef", label: "Style / Order Ref", type: "text", required: true },
      { key: "line", label: "Line", type: "select", options: ["-", ...LINES] },
      { key: "scheduledStartDate", label: "Scheduled Start Date", type: "date" },
      { key: "scheduledEndDate", label: "Scheduled End Date", type: "date" },
      { key: "priority", label: "Priority", type: "select", options: ["High", "Medium", "Low"] },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
];

function sectionMeta(id) {
  return SECTIONS.find(s => s.id === id);
}

// Planning has explicit access to every section, regardless of that
// section's own `depts` list — deliberate, per how Planning's role was
// defined in the original app.
function accessibleSections(user) {
  if (user.department === "PLANNING") return SECTIONS;
  return SECTIONS.filter(s => s.depts.includes(user.department));
}

// Planning can submit to every section regardless of fillDepts.
// Everyone else can only submit if their department is explicitly
// listed in that section's fillDepts.
function canFillSection(user, section) {
  return user.department === "PLANNING" || section.fillDepts.includes(user.department);
}

function canSubmitGenericEntry(user) {
  if (user.isAdmin) return true;
  return !NO_GENERIC_LOG_DEPTS.includes(user.department);
}

/* ==========================================================================
   2. STORAGE — a small JSON-file "database" with a write queue.
   No native dependencies, so `npm install` works anywhere with no compiler.
   On hosts with an ephemeral filesystem (e.g. Render's free tier) this
   folder gets wiped on redeploy — see README for the persistent-disk note.
   ========================================================================== */

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function seedEntries() {
  const now = Date.now();
  const rows = [
    { department: "CUTTING", task: "Fabric layer cutting — Style SC-204 Denim Jacket", quantity: 320, unit: "pcs", timeTakenMinutes: 180, line: "Line 1", worker: "S. Devi", remarks: "2 rolls short, requested from store", styleNumber: "SC-204" },
    { department: "PRODUCTION", task: "Stitching — Sleeve attach, Style SC-204", quantity: 450, unit: "pcs", timeTakenMinutes: 240, line: "Line 2", worker: "R. Kumar", remarks: "On target for EOD", styleNumber: "SC-204" },
    { department: "QUALITY", task: "AQL inspection — Style SC-198 Shirts", quantity: 600, unit: "pcs", timeTakenMinutes: 150, line: "Line 3", worker: "M. Iqbal", remarks: "12 pcs rejected, rework sent back", styleNumber: "SC-198" },
    { department: "IRONING", task: "Steam press — Style SC-198", quantity: 580, unit: "pcs", timeTakenMinutes: 200, line: "Line 3", worker: "L. Bora", remarks: "", styleNumber: "SC-198" },
    { department: "PACKAGING", task: "Poly bagging + cartoning — Style SC-190", quantity: 1000, unit: "pcs", timeTakenMinutes: 210, line: "Line 4", worker: "N. Yadav", remarks: "Ready for dispatch tomorrow", styleNumber: "SC-190" },
    { department: "FABRIC", task: "Fabric inspection — Denim Lot #88", quantity: 1200, unit: "mtr", timeTakenMinutes: 90, line: "-", worker: "J. Menon", remarks: "2% defect rate, within tolerance", styleNumber: "" },
    { department: "STORE", task: "Trims issued to Line 1 & 2", quantity: 5000, unit: "pcs", timeTakenMinutes: 60, line: "-", worker: "D. Ghosh", remarks: "Buttons + zippers for SC-204", styleNumber: "SC-204" },
    { department: "PLANNING", task: "Line plan updated — next 3 days", quantity: 3, unit: "lines", timeTakenMinutes: 45, line: "-", worker: "A. Nair", remarks: "SC-204 prioritized for shipment", styleNumber: "" },
    { department: "SAMPLING", task: "Proto sample stitched — Style SC-215", quantity: 2, unit: "pcs", timeTakenMinutes: 300, line: "-", worker: "E. Pillai", remarks: "For buyer review Friday", styleNumber: "SC-215" },
  ];
  return rows.map((r, i) => ({
    id: i + 1,
    ...r,
    finishingDate: "",
    createdBy: "seed",
    createdAt: now - i * 1000 * 60 * 17,
  }));
}

function seedSectionEntries() {
  const now = Date.now();
  const rows = [
    { sectionId: "BUYER_COMM_COSTING", department: "MERCHANDISE", createdBy: "seed",
      values: { buyerName: "H&M", styleOrderRef: "SC-210", subject: "Costing sheet sent for Fall 26 order", costingStatus: "Sent to Buyer", followUpDate: "2026-07-10", remarks: "Awaiting buyer confirmation" } },
    { sectionId: "SAMPLE_DEV", department: "SAMPLING", createdBy: "seed",
      values: { styleSampleRef: "SC-215", buyerName: "Zara", sampleType: "PP Sample", sampleStage: "Sent to Buyer", fabricStatus: "In-house", trimStatus: "Sourced", submissionDate: "2026-07-05", buyerComments: "", remarks: "For buyer review Friday" } },
    { sectionId: "MATERIAL_SOURCING", department: "FABRIC", createdBy: "seed",
      values: { materialName: "Denim Lot #88", supplier: "Arvind Mills", styleOrderRef: "SC-204", sourcingStatus: "Received", expectedDate: "2026-07-01", remarks: "2% defect rate, within tolerance" } },
    { sectionId: "MANPOWER_PLANNING", department: "HR", createdBy: "seed",
      values: { positionTitle: "Senior Machine Operator", departmentNeeded: "Production", headcount: 3, recruitmentStatus: "Interviewing", targetDate: "2026-07-20", remarks: "Line 2 expansion" } },
    { sectionId: "ACCOUNTS_PAYABLE", department: "ACCOUNTS", createdBy: "seed",
      values: { vendorName: "Arvind Mills", invoiceRef: "INV-8842", amount: 420000, dueDate: "2026-07-15", paymentStatus: "Approved", remarks: "Fabric supplier payment" } },
  ];
  return rows.map((r, i) => ({
    id: i + 1,
    ...r,
    createdAt: now - i * 1000 * 60 * 23,
  }));
}

function buildFreshDB() {
  const users = USERS_SEED.map(u => ({
    username: u.username,
    passwordHash: bcrypt.hashSync(u.password, 10),
    fullName: u.fullName,
    department: u.department,
    isAdmin: u.isAdmin,
  }));
  return {
    users,
    entries: seedEntries(),
    sectionEntries: seedSectionEntries(),
    seq: {
      entries: seedEntries().length + 1,
      sectionEntries: seedSectionEntries().length + 1,
    },
  };
}

let dbCache = null;
let writeChain = Promise.resolve();

function dbLoad() {
  if (dbCache) return dbCache;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    dbCache = buildFreshDB();
    dbPersist();
  } else {
    dbCache = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  }
  return dbCache;
}

function dbPersist() {
  // Serialize writes so concurrent requests can't interleave and corrupt the file.
  writeChain = writeChain.then(
    () =>
      new Promise((resolve, reject) => {
        const tmpFile = DB_FILE + ".tmp";
        fs.writeFile(tmpFile, JSON.stringify(dbCache, null, 2), err => {
          if (err) return reject(err);
          fs.rename(tmpFile, DB_FILE, err2 => (err2 ? reject(err2) : resolve()));
        });
      })
  );
  return writeChain;
}

/* ==========================================================================
   3. AUTH — JWT issue/verify + middleware.
   ========================================================================== */

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

/* ==========================================================================
   4. FILE UPLOADS — for section fields of type "file" (e.g. T&A Schedule
   attachment). Saved to disk under ./uploads and served statically at
   /uploads. Same ephemeral-filesystem caveat as the JSON database applies.
   ========================================================================== */

const UPLOAD_DIR = path.join(__dirname, "uploads");
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

/* ==========================================================================
   5. EXPORTS — single-entry and full-report downloads as Word (.docx) and
   Excel (.xlsx). Anyone who can already *see* an entry (per the existing
   view-permission rules above) can download that one entry. The combined
   "every department, one file" report is admin/MD only — see requireAdmin
   on the /api/export/all route below.
   ========================================================================== */

const BRAND_AMBER = "D98E3F";
const BRAND_DARK = "1C1B19";

function fmtDateTime(ms) {
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function fmtMinutes(mins) {
  mins = Number(mins) || 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return `${h}h ${m}m (${mins} min)`;
}
function safeSheetName(name) {
  return String(name).replace(/[\\/*?:[\]]/g, "").slice(0, 31) || "Sheet";
}
function safeFileName(name) {
  return String(name).replace(/[^a-z0-9\-_. ]/gi, "").trim().replace(/\s+/g, "_");
}
function sendXlsx(res, filename, workbook) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(filename)}"`);
  return workbook.xlsx.write(res).then(() => res.end());
}
async function sendDocx(res, filename, doc) {
  const buffer = await Packer.toBuffer(doc);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(filename)}"`);
  res.send(buffer);
}

function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Spike Creations Tracker";
  wb.created = new Date();
  return wb;
}
function styleHeaderRow(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell(c => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND_DARK } };
    c.alignment = { vertical: "middle" };
  });
}

// ---- Generic ("Factory Feed") entries -> worksheet / table rows ----

const GENERIC_COLUMNS = [
  { header: "Dept", key: "department", width: 14 },
  { header: "Task", key: "task", width: 40 },
  { header: "Qty", key: "quantity", width: 10 },
  { header: "Unit", key: "unit", width: 10 },
  { header: "Time Taken", key: "timeTakenLabel", width: 16 },
  { header: "Line", key: "line", width: 10 },
  { header: "Style / PO", key: "styleNumber", width: 14 },
  { header: "Finishing Date", key: "finishingDate", width: 16 },
  { header: "Worker", key: "worker", width: 18 },
  { header: "Remarks", key: "remarks", width: 30 },
  { header: "Attachment", key: "attachment", width: 22 },
  { header: "Entered By", key: "createdBy", width: 14 },
  { header: "Logged At", key: "createdAtLabel", width: 20 },
];

function genericEntryRow(e) {
  return {
    department: deptLabelOf(e.department),
    task: e.task,
    quantity: e.quantity,
    unit: e.unit,
    timeTakenLabel: fmtMinutes(e.timeTakenMinutes),
    line: e.line && e.line !== "-" ? e.line : "",
    styleNumber: e.styleNumber || "",
    finishingDate: e.finishingDate || "",
    worker: e.worker,
    remarks: e.remarks || "",
    attachment: e.attachment && e.attachment.originalName ? e.attachment.originalName : "",
    createdBy: e.createdBy,
    createdAtLabel: fmtDateTime(e.createdAt),
  };
}
function deptLabelOf(id) {
  const d = DEPARTMENTS.find(x => x.id === id) || EXEC_DEPARTMENTS.find(x => x.id === id);
  return d ? d.label : id;
}

function addGenericSheet(workbook, sheetName, entries) {
  const ws = workbook.addWorksheet(safeSheetName(sheetName));
  ws.columns = GENERIC_COLUMNS;
  styleHeaderRow(ws.getRow(1));
  entries.forEach(e => ws.addRow(genericEntryRow(e)));
  ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + GENERIC_COLUMNS.length)}1` };
  return ws;
}

// ---- Section entries -> worksheet / table rows (columns are dynamic,
// driven by that section's own field list) ----

function sectionValueLabel(field, entry) {
  const v = entry.values ? entry.values[field.key] : undefined;
  if (field.type === "file") return v && v.originalName ? v.originalName : "";
  return v === undefined || v === null ? "" : String(v);
}

function addSectionSheet(workbook, section, entries) {
  // Sections that already declare their own typed "file" field show it via
  // that field's column below; everyone else gets the universal optional
  // "Attachment" column instead (see the /sections/:id/entries route).
  const hasOwnFileField = section.fields.some(f => f.type === "file");
  const ws = workbook.addWorksheet(safeSheetName(section.title));
  const columns = [
    { header: "Dept", key: "department", width: 14 },
    ...section.fields.map(f => ({ header: f.label, key: f.key, width: 22 })),
    ...(hasOwnFileField ? [] : [{ header: "Attachment", key: "attachment", width: 22 }]),
    { header: "Entered By", key: "createdBy", width: 14 },
    { header: "Logged At", key: "createdAtLabel", width: 20 },
  ];
  ws.columns = columns;
  styleHeaderRow(ws.getRow(1));
  entries.forEach(e => {
    const row = { department: deptLabelOf(e.department), createdBy: e.createdBy, createdAtLabel: fmtDateTime(e.createdAt) };
    section.fields.forEach(f => { row[f.key] = sectionValueLabel(f, e); });
    if (!hasOwnFileField) row.attachment = e.attachment && e.attachment.originalName ? e.attachment.originalName : "";
    ws.addRow(row);
  });
  ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + columns.length)}1` };
  return ws;
}

// ---- Word (.docx) building blocks ----
// Widths are all in DXA (twentieths of a point), never PERCENTAGE — percentage
// table/cell widths render fine in Word but break in Google Docs, so we use
// the same fixed-width approach the docx skill recommends: a page content
// width of 9360 DXA (US Letter, 1" margins), with columnWidths on the table
// summing to that and matching per-cell widths.

const PAGE_SIZE_DXA = { width: 12240, height: 15840 }; // US Letter
const PAGE_MARGIN_DXA = { top: 1440, bottom: 1440, left: 1440, right: 1440 };
const TABLE_WIDTH_DXA = 9360;
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" };
const CELL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER };
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

function docPageProps() {
  return { page: { size: PAGE_SIZE_DXA, margin: PAGE_MARGIN_DXA } };
}
function docTitle(text) {
  return new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 120 }, children: [new TextRun({ text, bold: true, color: BRAND_AMBER })] });
}
function docSubtitle(text) {
  return new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text, italics: true, color: "666666" })] });
}
function docHeading(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 }, children: [new TextRun({ text, bold: true })] });
}
function kvCell(text, colWidth, isLabel) {
  return new TableCell({
    width: { size: colWidth, type: WidthType.DXA },
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    shading: isLabel ? { type: ShadingType.CLEAR, fill: "F2EDE4" } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: !!isLabel })] })],
  });
}
function kvTable(pairs) {
  const labelW = Math.round(TABLE_WIDTH_DXA * 0.3);
  const valueW = TABLE_WIDTH_DXA - labelW;
  return new Table({
    width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [labelW, valueW],
    rows: pairs.map(([label, value]) => new TableRow({
      children: [kvCell(label, labelW, true), kvCell(String(value ?? "—"), valueW, false)],
    })),
  });
}
function docDataTable(headers, rows) {
  const n = headers.length;
  const base = Math.floor(TABLE_WIDTH_DXA / n);
  const colWidths = headers.map((_, i) => (i === n - 1 ? TABLE_WIDTH_DXA - base * (n - 1) : base));
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.DXA },
      borders: CELL_BORDERS,
      margins: CELL_MARGINS,
      shading: { type: ShadingType.CLEAR, fill: BRAND_DARK },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })] })],
    })),
  });
  const bodyRows = rows.map(r => new TableRow({
    children: r.map((v, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.DXA },
      borders: CELL_BORDERS,
      margins: CELL_MARGINS,
      children: [new Paragraph({ children: [new TextRun({ text: String(v ?? "") })] })],
    })),
  }));
  return new Table({ width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA }, columnWidths: colWidths, rows: [headerRow, ...bodyRows] });
}

function buildGenericEntryDoc(entry) {
  return new Document({
    sections: [{
      properties: docPageProps(),
      children: [
        docTitle("Spike Creations — Entry Report"),
        docSubtitle(`Generated ${fmtDateTime(Date.now())}`),
        docHeading(deptLabelOf(entry.department) + " — " + entry.task),
        kvTable([
          ["Department", deptLabelOf(entry.department)],
          ["Task / Activity", entry.task],
          ["Quantity", `${entry.quantity} ${entry.unit}`],
          ["Time Taken", fmtMinutes(entry.timeTakenMinutes)],
          ["Line", entry.line && entry.line !== "-" ? entry.line : "N/A"],
          ["Style / PO Number", entry.styleNumber || "N/A"],
          ["Finishing Date", entry.finishingDate || "N/A"],
          ["Worker / Assigned To", entry.worker],
          ["Remarks", entry.remarks || "—"],
          ["Attachment", entry.attachment && entry.attachment.originalName ? entry.attachment.originalName : "None"],
          ["Entered By", entry.createdBy],
          ["Logged At", fmtDateTime(entry.createdAt)],
        ]),
      ],
    }],
  });
}

function buildSectionEntryDoc(entry, section) {
  const pairs = [["Department", deptLabelOf(entry.department)]];
  section.fields.forEach(f => pairs.push([f.label, sectionValueLabel(f, entry) || "—"]));
  if (!section.fields.some(f => f.type === "file")) {
    pairs.push(["Attachment", entry.attachment && entry.attachment.originalName ? entry.attachment.originalName : "None"]);
  }
  pairs.push(["Entered By", entry.createdBy], ["Logged At", fmtDateTime(entry.createdAt)]);
  return new Document({
    sections: [{
      properties: docPageProps(),
      children: [
        docTitle("Spike Creations — Entry Report"),
        docSubtitle(`Generated ${fmtDateTime(Date.now())}`),
        docHeading(section.title),
        kvTable(pairs),
      ],
    }],
  });
}

function buildFullReportDoc({ entries, sectionEntries }) {
  const children = [
    docTitle("Spike Creations — Full Activity Report"),
    docSubtitle(`All departments · Generated ${fmtDateTime(Date.now())}`),
  ];

  children.push(docHeading("Factory Feed — All Departments"));
  if (entries.length) {
    children.push(docDataTable(
      ["Dept", "Task", "Qty", "Unit", "Time", "Worker", "Style", "Remarks", "Attachment", "Logged At"],
      entries.map(e => [
        deptLabelOf(e.department), e.task, e.quantity, e.unit, fmtMinutes(e.timeTakenMinutes),
        e.worker, e.styleNumber || "", e.remarks || "",
        e.attachment && e.attachment.originalName ? e.attachment.originalName : "",
        fmtDateTime(e.createdAt),
      ])
    ));
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: "No entries.", italics: true })] }));
  }

  SECTIONS.forEach(section => {
    const rows = sectionEntries.filter(e => e.sectionId === section.id);
    if (!rows.length) return;
    children.push(docHeading(section.title));
    const hasOwnFileField = section.fields.some(f => f.type === "file");
    const headers = ["Dept", ...section.fields.map(f => f.label), ...(hasOwnFileField ? [] : ["Attachment"]), "Logged At"];
    const tableRows = rows.map(e => [
      deptLabelOf(e.department),
      ...section.fields.map(f => sectionValueLabel(f, e)),
      ...(hasOwnFileField ? [] : [e.attachment && e.attachment.originalName ? e.attachment.originalName : ""]),
      fmtDateTime(e.createdAt),
    ]);
    children.push(docDataTable(headers, tableRows));
  });

  return new Document({ sections: [{ properties: docPageProps(), children }] });
}

/* ==========================================================================
   6. APP + ROUTES
   ========================================================================== */

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

// Warm the DB (creates + seeds data/db.json on first boot).
dbLoad();

app.get("/api/health", (req, res) => res.json({ ok: true, time: Date.now() }));

// ---- Auth ----

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const { users } = dbLoad();
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

// No auth required (there's no session yet) — lets the sign-in screen show
// "Signing in as: <name>" as soon as a recognized username is typed, before
// the password is even entered. Deliberately returns only a display name +
// department, never anything password-related, and a bare `{ found: false }`
// (not a 404/error) for unknown usernames so the login form can treat it as
// a normal "nothing to preview yet" case.
app.get("/api/auth/whois", (req, res) => {
  const username = String(req.query.username || "").trim();
  if (!username) return res.json({ found: false });

  const { users } = dbLoad();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.json({ found: false });

  res.json({ found: true, fullName: user.fullName, department: deptLabelOf(user.department) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const sections = accessibleSections(req.user).map(s => s.id);
  res.json({ user: req.user, accessibleSectionIds: sections });
});

// ---- Departments / static config ----

app.get("/api/departments", requireAuth, (req, res) => {
  res.json({
    departments: DEPARTMENTS,
    execDepartments: EXEC_DEPARTMENTS,
    noGenericLogDepts: NO_GENERIC_LOG_DEPTS,
    timeUnitDepts: TIME_UNIT_DEPTS,
    lines: LINES,
    units: UNITS,
  });
});

// ---- Entries (Factory Feed) ----

const VALID_DEPT_IDS = new Set(DEPARTMENTS.map(d => d.id));

app.get("/api/entries", requireAuth, (req, res) => {
  const { entries } = dbLoad();
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

// Download a single Factory Feed entry as Word or Excel. The feed itself has
// no per-department view restriction (every logged-in user can see every
// entry), so downloading one follows the same rule: any authenticated user.
app.get("/api/entries/:id/export", requireAuth, async (req, res) => {
  const format = String(req.query.format || "xlsx").toLowerCase();
  if (format !== "xlsx" && format !== "docx") {
    return res.status(400).json({ error: "format must be 'xlsx' or 'docx'." });
  }
  const { entries } = dbLoad();
  const entry = entries.find(e => e.id === Number(req.params.id));
  if (!entry) return res.status(404).json({ error: "Entry not found." });

  const base = `Entry_${entry.id}_${safeFileName(deptLabelOf(entry.department))}`;
  try {
    if (format === "xlsx") {
      const workbook = newWorkbook();
      addGenericSheet(workbook, "Entry", [entry]);
      await sendXlsx(res, `${base}.xlsx`, workbook);
    } else {
      await sendDocx(res, `${base}.docx`, buildGenericEntryDoc(entry));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't generate the file." });
  }
});

// upload.any() is a no-op for plain JSON submissions (it only kicks in for
// multipart/form-data), so this route keeps working for JSON clients while
// also accepting an optional "attachment" file (image or PDF) from the form.
app.post("/api/entries", requireAuth, upload.any(), (req, res) => {
  const state = dbLoad();
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

  let timeTakenMinutes = Number(body.timeTakenMinutes);
  if (Number.isNaN(timeTakenMinutes)) {
    const raw = Number(body.timeTaken) || 0;
    const unit = body.timeUnit || "mins";
    if (TIME_UNIT_DEPTS.includes(department) && unit === "hrs") timeTakenMinutes = raw * 60;
    else if (TIME_UNIT_DEPTS.includes(department) && unit === "days") timeTakenMinutes = raw * 60 * 24;
    else timeTakenMinutes = raw;
  }
  timeTakenMinutes = Math.round(timeTakenMinutes) || 0;

  // Optional attachment (image or PDF) — same upload pipeline/validation as
  // Section file fields, just stored at the top level of a generic entry.
  const uploadedAttachment = (req.files || []).find(f => f.fieldname === "attachment");
  const attachment = uploadedAttachment ? {
    originalName: uploadedAttachment.originalname,
    url: `/uploads/${uploadedAttachment.filename}`,
    mimeType: uploadedAttachment.mimetype,
    size: uploadedAttachment.size,
  } : null;

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
    attachment,
    createdBy: req.user.username,
    createdAt: Date.now(),
  };

  state.entries.push(entry);
  dbPersist().then(() => res.status(201).json({ entry }));
});

// ---- Sections (cross-department workflows) ----

function canViewSection(user, section) {
  return user.department === "PLANNING" || section.depts.includes(user.department);
}

app.get("/api/sections", requireAuth, (req, res) => {
  const sections = accessibleSections(req.user).map(s => ({
    id: s.id,
    title: s.title,
    fields: s.fields,
    canFill: canFillSection(req.user, s),
  }));
  res.json({ sections });
});

app.get("/api/sections/:id/entries", requireAuth, (req, res) => {
  const section = sectionMeta(req.params.id);
  if (!section) return res.status(404).json({ error: "Unknown section." });
  if (!canViewSection(req.user, section)) {
    return res.status(403).json({ error: "You don't have access to this section." });
  }

  const { sectionEntries } = dbLoad();
  const rows = sectionEntries
    .filter(e => e.sectionId === section.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ entries: rows });
});

// Download a single Section entry as Word or Excel — same view permission
// as browsing that section (canViewSection).
app.get("/api/sections/:id/entries/:entryId/export", requireAuth, async (req, res) => {
  const section = sectionMeta(req.params.id);
  if (!section) return res.status(404).json({ error: "Unknown section." });
  if (!canViewSection(req.user, section)) {
    return res.status(403).json({ error: "You don't have access to this section." });
  }
  const format = String(req.query.format || "xlsx").toLowerCase();
  if (format !== "xlsx" && format !== "docx") {
    return res.status(400).json({ error: "format must be 'xlsx' or 'docx'." });
  }

  const { sectionEntries } = dbLoad();
  const entry = sectionEntries.find(e => e.id === Number(req.params.entryId) && e.sectionId === section.id);
  if (!entry) return res.status(404).json({ error: "Entry not found." });

  const base = `Entry_${entry.id}_${safeFileName(section.title)}`;
  try {
    if (format === "xlsx") {
      const workbook = newWorkbook();
      addSectionSheet(workbook, section, [entry]);
      await sendXlsx(res, `${base}.xlsx`, workbook);
    } else {
      await sendDocx(res, `${base}.docx`, buildSectionEntryDoc(entry, section));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't generate the file." });
  }
});

// Plain sections:  JSON body { values: { ...fieldKey: value } }
// Sections with a "file" field: multipart/form-data — the file itself under
// its field key (e.g. "attachment"), plus every other field JSON-encoded
// under a "valuesJson" part (see public/index.html's submit handler).
// upload.any() is a no-op and leaves req.body untouched when the request
// isn't multipart, so this route serves both cases.
app.post("/api/sections/:id/entries", requireAuth, upload.any(), (req, res) => {
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

  // Universal optional attachment (image or PDF) for every section — except
  // ones that already declare their own typed "file" field (e.g. T&A
  // Schedule), which keeps using that field instead so there's only ever
  // one upload control per form. Sent under the fixed field name
  // "sectionAttachment" so it never collides with a section's own file key.
  let attachment = null;
  if (!section.fields.some(f => f.type === "file")) {
    const uploaded = (req.files || []).find(file => file.fieldname === "sectionAttachment");
    if (uploaded) {
      attachment = {
        originalName: uploaded.originalname,
        url: `/uploads/${uploaded.filename}`,
        mimeType: uploaded.mimetype,
        size: uploaded.size,
      };
    }
  }

  const state = dbLoad();
  const entry = {
    id: state.seq.sectionEntries++,
    sectionId: section.id,
    department: req.user.department,
    createdBy: req.user.username,
    createdAt: Date.now(),
    values,
    attachment,
  };
  state.sectionEntries.push(entry);
  dbPersist().then(() => res.status(201).json({ entry }));
});

// ---- Admin dashboard ----

app.get("/api/summary/today", requireAuth, requireAdmin, (req, res) => {
  const { entries } = dbLoad();

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

// Full report — every department, every section, one click. Admin/MD only
// (both accounts carry isAdmin: true). Optional ?today=true restricts the
// Factory Feed + section entries to entries logged today, matching the
// dashboard's "today" scope; omit it (default) to export everything on file.
app.get("/api/export/all", requireAuth, requireAdmin, async (req, res) => {
  const format = String(req.query.format || "xlsx").toLowerCase();
  if (format !== "xlsx" && format !== "docx") {
    return res.status(400).json({ error: "format must be 'xlsx' or 'docx'." });
  }

  const { entries: allEntries, sectionEntries: allSectionEntries } = dbLoad();
  let entries = [...allEntries].sort((a, b) => b.createdAt - a.createdAt);
  let sectionEntries = [...allSectionEntries].sort((a, b) => b.createdAt - a.createdAt);

  if (req.query.today === "true") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const startOfDay = d.getTime();
    entries = entries.filter(e => e.createdAt >= startOfDay);
    sectionEntries = sectionEntries.filter(e => e.createdAt >= startOfDay);
  }

  const scopeLabel = req.query.today === "true" ? "Today" : "All_Time";
  const base = `Spike_Creations_Full_Report_${scopeLabel}_${new Date().toISOString().slice(0, 10)}`;

  try {
    if (format === "xlsx") {
      const workbook = newWorkbook();

      const summarySheet = workbook.addWorksheet("Summary");
      summarySheet.columns = [
        { header: "Department", key: "label", width: 22 },
        { header: "Entries", key: "count", width: 12 },
        { header: "Time Logged", key: "timeLabel", width: 18 },
      ];
      styleHeaderRow(summarySheet.getRow(1));
      DEPARTMENTS.forEach(dep => {
        const rows = entries.filter(e => e.department === dep.id);
        const minutes = rows.reduce((s, e) => s + (e.timeTakenMinutes || 0), 0);
        summarySheet.addRow({ label: dep.label, count: rows.length, timeLabel: fmtMinutes(minutes) });
      });

      addGenericSheet(workbook, "Factory Feed", entries);

      SECTIONS.forEach(section => {
        const rows = sectionEntries.filter(e => e.sectionId === section.id);
        if (rows.length) addSectionSheet(workbook, section, rows);
      });

      await sendXlsx(res, `${base}.xlsx`, workbook);
    } else {
      await sendDocx(res, `${base}.docx`, buildFullReportDoc({ entries, sectionEntries }));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't generate the report." });
  }
});

// ---- Fallback error handler ----
// Multer (file upload) errors — wrong file type, file too large — arrive
// here with a useful .message; pass it through instead of a generic 500.
app.use((err, req, res, next) => {
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Spike Creations backend listening on http://localhost:${PORT}`);
});
