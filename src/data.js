/* ==========================================================
   Shared domain config — ported 1:1 from spike-creations-tracker.html
   so the backend enforces exactly the same departments, sections,
   and permission rules as the frontend UI expects.
========================================================== */

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

// Plaintext passwords here ONLY because this mirrors the original demo
// seed list. They are hashed with bcrypt the first time the DB is
// initialized (see db.js) — the plaintext values below are never stored.
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

const STATUS_OPTIONS = ["Pending", "In Progress", "Completed", "On Hold", "Cancelled"];

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

function deptMeta(id) {
  return DEPARTMENTS.find(d => d.id === id) || EXEC_DEPARTMENTS.find(d => d.id === id) || { id, code: id, label: id };
}

function sectionMeta(id) {
  return SECTIONS.find(s => s.id === id);
}

// Planning has explicit access to every section, regardless of that
// section's own `depts` list — deliberate, per how Planning's role
// was defined in the original app.
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
  // Admin/MD accounts aren't tied to a floor department's daily log.
  if (user.isAdmin) return true;
  return !NO_GENERIC_LOG_DEPTS.includes(user.department);
}

module.exports = {
  DEPARTMENTS,
  EXEC_DEPARTMENTS,
  USERS_SEED,
  NO_GENERIC_LOG_DEPTS,
  TIME_UNIT_DEPTS,
  LINES,
  UNITS,
  ALL_FLOOR_DEPT_IDS,
  STATUS_OPTIONS,
  SECTIONS,
  deptMeta,
  sectionMeta,
  accessibleSections,
  canFillSection,
  canSubmitGenericEntry,
};
