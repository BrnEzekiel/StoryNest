// Regression: typo'd freemail domains (gmaill.com etc.) must be rejected with a
// "did you mean" hint instead of silently swallowing the OTP email.
// Integration test: boots the real backend on port 5058 and uses the dev DB
// from apps/backend/.env. Cleans up its rows.
// Run: npm test --workspace=apps/backend   (needs network for Neon + Redis)
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const backendDir = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(backendDir, ".env") });
const { PrismaClient } = require("@prisma/client");

const PORT = 5058;
const BASE = `http://localhost:${PORT}`;
const tag = `ty${Date.now()}`;
const typoEmail = `${tag}@gmaill.com`;
const fixedEmail = `${tag}@gmail.com`;

let server;
let prisma;

async function waitForHealth() {
  const deadline = Date.now() + 90000;
  for (;;) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {}
    if (Date.now() > deadline) throw new Error("backend did not come up on " + PORT);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function post(p, body) {
  const r = await fetch(`${BASE}${p}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

before(async () => {
  prisma = new PrismaClient();
  server = spawn("node", ["index.js"], {
    cwd: backendDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
    windowsHide: true,
  });
  await waitForHealth();
});

after(async () => {
  if (server && !server.killed) server.kill();
  if (prisma) {
    await prisma.user.deleteMany({ where: { email: { in: [typoEmail, fixedEmail] } } });
    await prisma.$disconnect();
  }
});

describe("email typo guard", () => {
  it("initiate rejects gmaill.com with a gmail.com suggestion", async () => {
    const { status, data } = await post("/auth/otp/initiate", { email: typoEmail, dob: "2000-01-01" });
    assert.equal(status, 400, JSON.stringify(data));
    assert.equal(data.suggestion, fixedEmail, JSON.stringify(data));
    assert.match(data.error || "", /did you mean/i, JSON.stringify(data));
  });

  it("forgot rejects gmaill.com with a gmail.com suggestion", async () => {
    const { status, data } = await post("/auth/password/forgot", { email: typoEmail });
    assert.equal(status, 400, JSON.stringify(data));
    assert.equal(data.suggestion, fixedEmail, JSON.stringify(data));
  });

  it("creates no user row for the typo'd address", async () => {
    const row = await prisma.user.findUnique({ where: { email: typoEmail } });
    assert.equal(row, null, "typo'd email must not create a row");
  });

  it("still accepts the corrected domain", async () => {
    const { status, data } = await post("/auth/otp/initiate", { email: fixedEmail, dob: "2000-01-01" });
    assert.equal(status, 200, JSON.stringify(data));
  });
});
