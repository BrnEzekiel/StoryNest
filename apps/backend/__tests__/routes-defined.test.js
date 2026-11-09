// Guard: admin routes call requireRole("ADMIN") at registration time, so a
// missing factory crashes the whole backend at boot (production outage).
// Assert the factory exists and every call site names a real Role value.
// Run: npm test -- routes-defined.test.js   (from apps/backend)
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("admin role guard", () => {
  const dir = path.join(__dirname, "..");
  const src = fs.readFileSync(path.join(dir, "app.runtime.js"), "utf8");
  const schema = fs.readFileSync(path.join(dir, "prisma", "schema.prisma"), "utf8");

  test("requireRole factory is defined", () => {
    assert.match(src, /const requireRole = \(role\) =>/);
  });

  test("every requireRole call names a Role enum value", () => {
    const enumBlock = schema.match(/enum Role \{([^}]*)\}/)[1];
    const roles = enumBlock.split(/\s+/).filter((w) => /^[A-Z_]+$/.test(w));
    assert.ok(roles.length > 0, "no Role values parsed from schema");
    const calls = [...src.matchAll(/requireRole\("([A-Z_]+)"\)/g)].map((m) => m[1]);
    assert.ok(calls.length > 0, "no requireRole call sites found");
    for (const role of calls) {
      assert.ok(roles.includes(role), `requireRole("${role}") is not a Role enum value (${roles})`);
    }
  });
});
