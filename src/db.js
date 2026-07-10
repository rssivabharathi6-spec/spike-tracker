const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { USERS_SEED } = require("./data");

const DATA_DIR = path.join(__dirname, "..", "data");
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

let cache = null;
let writeChain = Promise.resolve();

function load() {
  if (cache) return cache;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    cache = buildFreshDB();
    persist();
  } else {
    cache = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  }
  return cache;
}

function persist() {
  // Serialize writes so concurrent requests can't interleave and corrupt the file.
  writeChain = writeChain.then(
    () =>
      new Promise((resolve, reject) => {
        const tmpFile = DB_FILE + ".tmp";
        fs.writeFile(tmpFile, JSON.stringify(cache, null, 2), err => {
          if (err) return reject(err);
          fs.rename(tmpFile, DB_FILE, err2 => (err2 ? reject(err2) : resolve()));
        });
      })
  );
  return writeChain;
}

function resetToSeed() {
  cache = buildFreshDB();
  return persist();
}

module.exports = { load, persist, resetToSeed, DB_FILE };
