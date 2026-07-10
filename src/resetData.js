const { resetToSeed, DB_FILE } = require("./db");

resetToSeed().then(() => {
  console.log(`Database reset to seed data at ${DB_FILE}`);
  process.exit(0);
});
