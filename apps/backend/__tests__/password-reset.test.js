// Regression: password reset must work end to end (forgot -> code -> reset -> login).
// The routes were missing entirely, and Settings claimed "link sent" without calling anything.
// Integration test: boots the real backend on port 5056 and uses the dev DB
// from apps/backend/.env. Cleans up its rows.
// Run: npm test --workspace=apps/backend   (needs network for Neon + Redis)
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const backendDir = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(backendDir, ".env") });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const PORT = 5056;
const BASE = `http://localhost:${PORT}`;
const tag = `pw${Date.now()}`;
const email = `${tag}@test.local`;
const OLD_PASS = "OldPass123!";
const NEW_PASS = "NewPass123!";

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
  const hash = await bcrypt.hash(OLD_PASS, 10);
  await prisma.user.upsert({
    where: { email },
    update: { password: hash, emailVerified: true, otpCode: null, otpExpiry: null },
    create: { email, username: `seed_${tag}`, password: hash, emailVerified: true },
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
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
});

describe("password reset flow", () => {
  it("forgot returns 404 for unknown email", async () => {
    const { status } = await post("/auth/password/forgot", { email: `nobody-${tag}@test.local` });
    assert.equal(status, 404);
  });

  it("forgot stores a code, reset rejects a wrong code", async () => {
    await post("/auth/password/forgot", { email });
    const row = await prisma.user.findUnique({ where: { email } });
    assert.ok(row && row.otpCode && row.otpExpiry, "forgot must store an OTP code");
    const { status, data } = await post("/auth/password/reset", {
      email,
      otp: "000000",
      newPassword: NEW_PASS,
    });
    assert.equal(status, 400, JSON.stringify(data));
  });

  it("reset with the right code sets the password (old stops, new works)", async () => {
    const row = await prisma.user.findUnique({ where: { email } });
    const { status, data } = await post("/auth/password/reset", {
      email,
      otp: row.otpCode,
      newPassword: NEW_PASS,
    });
    assert.equal(status, 200, JSON.stringify(data));
    const oldLogin = await post("/auth/login", { email, password: OLD_PASS });
    assert.notEqual(oldLogin.status, 200, "old password must stop working");
    const newLogin = await post("/auth/login", { email, password: NEW_PASS });
    assert.equal(newLogin.status, 200, JSON.stringify(newLogin.data));
    assert.ok(newLogin.data.accessToken, "new login must return tokens");
  });
});
