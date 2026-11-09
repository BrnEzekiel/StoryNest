// Guard: app.js executes b64_*.txt, not app.runtime.js — the parts must
// decode byte-identical to the source or production runs stale code.
// Regen with: node regen-parts.js   (from apps/backend)
// Run: npm test -- parts-fresh.test.js   (from apps/backend)
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("backend packaging", () => {
  test("b64 parts decode byte-identical to app.runtime.js", () => {
    const dir = path.join(__dirname, "..");
    const src = fs.readFileSync(path.join(dir, "app.runtime.js"), "utf8");
    let joined = "";
    for (let i = 0; ; i++) {
      const part = path.join(dir, `b64_${i}.txt`);
      if (!fs.existsSync(part)) break;
      joined += fs.readFileSync(part, "utf8").trim();
    }
    assert.ok(joined.length > 0, "no b64 parts found");
    assert.equal(Buffer.from(joined, "base64").toString("utf8"), src);
  });
});
