const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const requiredFiles = [
  "server.js",
  "src/routes/admin.js",
  "src/routes/auth.js",
  "src/routes/students.js",
  ".github/workflows/ci.yml",
  "eslint.config.cjs",
];

test("critical project files exist", () => {
  for (const filePath of requiredFiles) {
    assert.equal(fs.existsSync(filePath), true, `Missing required file: ${filePath}`);
  }
});
