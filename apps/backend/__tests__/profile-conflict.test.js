// Regression: PUT /users/me/profile with a taken username must answer 409, not 500.
// Same P2002 class as the register bug. Integration test: boots the real backend
// on port 5057 and uses the dev DB from apps/backend/.env. Cleans up its rows.
// Run: npm test --workspace=apps/backend   (needs network for Neon + Redis)
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const backendDir = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(backendDir, ".env") });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const PORT = 5057;
const BASE = `http://localhost:${PORT}`;
const tag = `pf${Date.now()}`;
const emailA = `${tag}a@test.local`;
const emailB = `${tag}b@test.local`;
const taken = `Taken${tag}`;
const PASS = "ProfPass123!";

let server;
let prisma;
let tokenA;

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

before(async () => {
  prisma = new PrismaClient();
  const hash = await bcrypt.hash(PASS, 10);
  await prisma.user.upsert({
    where: { email: emailA },
    update: { password: hash, emailVerified: true },
    create: { email: emailA, username: `seed_${tag}_a`, password: hash, emailVerified: true },
  });
  await prisma.user.upsert({
    where: { email: emailB },
    update: { username: taken },
    create: { email: emailB, username: taken, password: hash, emailVerified: true },
  });
  server = spawn("node", ["index.js"], {
    cwd: backendDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
    windowsHide: true,
  });
  await waitForHealth();
  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password: PASS }),
  });
  const body = await login.json();
  assert.equal(login.status, 200, JSON.stringify(body));
  tokenA = body.accessToken;
});

after(async () => {
  if (server && !server.killed) server.kill();
  if (prisma) {
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await prisma.$disconnect();
  }
});

async function putProfile(payload) {
  const r = await fetch(`${BASE}/users/me/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

describe("PUT /users/me/profile conflicts", () => {
  it("updates with a fresh username (baseline 200)", async () => {
    const { status, data } = await putProfile({ username: `Fresh${tag}`, bio: "hello" });
    assert.equal(status, 200, JSON.stringify(data));
    assert.equal(data.username, `Fresh${tag}`);
  });

  it("returns 409 (not 500) when the username is taken", async () => {
    const { status, data } = await putProfile({ username: taken });
    assert.equal(status, 409, JSON.stringify(data));
    assert.match(data.error || "", /taken/i, JSON.stringify(data));
  });
});
