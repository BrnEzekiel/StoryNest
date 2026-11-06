// Regression: /auth/otp/initiate must actually deliver the code.
// It used to fire-and-forget the email and always answer "OTP sent", so dead
// mail credentials looked like success and nobody ever received a code.
// Now the route awaits delivery and answers 502 when every provider fails.
// Integration test: boots the real backend on port 5059 and uses the dev DB
// from apps/backend/.env. Sends one real SMTP message (to a dead domain, so
// Gmail accepts it and bounces async). Cleans up its rows.
// Run: npm test --workspace=apps/backend   (needs network for Neon + Gmail)
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const backendDir = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(backendDir, ".env") });
const { PrismaClient } = require("@prisma/client");

const PORT = 5059;
const BASE = `http://localhost:${PORT}`;
const tag = `em${Date.now()}`;
const email = `${tag}@test.local`;

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
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
});

describe("otp email delivery", () => {
  it("initiate returns 200 only when the code is really sent", async () => {
    const r = await fetch(`${BASE}/auth/otp/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await r.json().catch(() => ({}));
    assert.equal(r.status, 200, `expected delivery, got ${r.status}: ${JSON.stringify(data)}`);
    const row = await prisma.user.findUnique({ where: { email } });
    assert.ok(row && row.otpCode && row.otpExpiry, "initiate must store an OTP code");
  });
});
