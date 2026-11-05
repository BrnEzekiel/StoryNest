// Regression: POST /auth/register with a taken username must answer 409, not 500.
// Integration test: boots the real backend on port 5055 and uses the dev DB
// from apps/backend/.env (same DB the backend uses). Cleans up its rows.
// Run: npm test --workspace=apps/backend   (needs network for Neon + Redis)
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const backendDir = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(backendDir, ".env") });
const { PrismaClient } = require("@prisma/client");

const PORT = 5055;
const BASE = `http://localhost:${PORT}`;
const tag = `rg${Date.now()}`;
const emailA = `${tag}a@test.local`;
const emailB = `${tag}b@test.local`;
const emailC = `${tag}c@test.local`;
const taken = `Taken${tag}`;

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

async function register(email, username) {
  const r = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      username,
      password: "ProbePass123!",
      dob: "2000-01-01T00:00:00.000Z",
      tosAccepted: true,
      privacyAccepted: true,
      accountType: "reader",
      firebaseUid: `probe-fb-${tag}-${email}`,
    }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

before(async () => {
  prisma = new PrismaClient();
  // A + B: verified users ready to register. C: already holds the `taken` username.
  await prisma.user.upsert({
    where: { email: emailA },
    update: { emailVerified: true, otpCode: null, otpExpiry: null },
    create: { email: emailA, username: `seed_${tag}_a`, password: "probe", emailVerified: true },
  });
  await prisma.user.upsert({
    where: { email: emailB },
    update: { emailVerified: true, otpCode: null, otpExpiry: null },
    create: { email: emailB, username: `seed_${tag}_b`, password: "probe", emailVerified: true },
  });
  await prisma.user.upsert({
    where: { email: emailC },
    update: { username: taken },
    create: { email: emailC, username: taken, password: "probe", emailVerified: true },
  });
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
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB, emailC] } } });
    await prisma.$disconnect();
  }
});

describe("POST /auth/register conflicts", () => {
  it("registers with a fresh username (baseline 201)", async () => {
    const { status, body } = await register(emailA, `Fresh${tag}`);
    assert.equal(status, 201, JSON.stringify(body));
  });

  it("returns 409 (not 500) when the username is taken", async () => {
    const { status, body } = await register(emailB, taken);
    assert.equal(status, 409, JSON.stringify(body));
    assert.match(body.error || "", /taken/i, JSON.stringify(body));
  });
});
