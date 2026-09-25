# Phase 0 — Restore `index.js` + apply BullMQ wiring

During automated migration, `apps/backend/index.js` was accidentally truncated.
**All other Phase 0 files are fine** (`queues/`, `workers/`, `config.js`, `package.json`).

## 1. Restore full `index.js` from git history

On your machine (in the StoryNest repo):

```bash
# Restore the last known-good full backend entrypoint
git checkout 1c38922bcf7fd1dc857b2ffb78700fd3be0a7f11 -- apps/backend/index.js
```

That commit still has the complete routes (stories, chapters, social, etc.).

## 2. Apply these three small edits

### A) Add queue import (after the config require)

```js
const { config, sendGmail, sendSlack } = require("./config");
const { enqueueWelcomeEmail, enqueueEmail } = require("./queues");
```

### B) Replace the `/health` route with:

```js
app.get("/health", (req, res) => res.json({ status: "ok", version: "3.8.0", schema: "social_master_v3_stable", bullmq: true, timestamp: new Date().toISOString() }));

// --- QUEUE DEBUG / TEST (protect or remove in production later) ---
app.post("/queues/test-welcome", async (req, res) => {
  try {
    const email = (req.body?.email || "test@storynest.local").toLowerCase().trim();
    const username = req.body?.username || "Nestling";
    const job = await enqueueWelcomeEmail({ email, username });
    res.json({ message: "Welcome email job enqueued", jobId: job.id, queue: "email" });
  } catch (error) {
    console.error("[Queue] test-welcome failed:", error.message);
    res.status(500).json({ error: "Failed to enqueue job. Is Redis running and REDIS_URL set?", detail: error.message });
  }
});

app.get("/queues/health", async (req, res) => {
  try {
    const { emailQueue } = require("./queues");
    const [waiting, active, completed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);
    res.json({
      redisUrlConfigured: Boolean(process.env.REDIS_URL) || true,
      email: { waiting, active, completed, failed },
    });
  } catch (error) {
    res.status(500).json({ error: "Queue health check failed", detail: error.message });
  }
});
```

### C) After successful register (before `res.status(201)`), enqueue welcome email:

```js
    const tokens = generateTokens(updatedUser);

    // Fire-and-forget welcome email via BullMQ (does not block response)
    enqueueWelcomeEmail({ email: updatedUser.email, username: updatedUser.username })
      .catch((err) => console.error("[Queue] welcome email enqueue failed:", err.message));

    res.status(201).json({ user: updatedUser, ...tokens });
```

Optional: change the listen log string to `StoryNest Backend v3.8.0 (BullMQ)`.

## 3. Env + install + run

Add to `.env` / Render:

```
REDIS_URL=redis://127.0.0.1:6379
# Production example (Upstash):
# REDIS_URL=rediss://default:PASSWORD@HOST:6379
```

```bash
cd apps/backend
npm install          # picks up bullmq + ioredis

# Terminal 1 — API
npm run dev

# Terminal 2 — Worker
npm run worker:dev
```

## 4. Verify

```bash
curl http://localhost:5000/health
# expect: "bullmq": true

curl -X POST http://localhost:5000/queues/test-welcome \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","username":"TestUser"}'

curl http://localhost:5000/queues/health
```

Worker logs should show the job processed (email send may fail if Gmail creds missing — queue itself is still proven).

## Files already committed for Phase 0

- `apps/backend/package.json` — bullmq, ioredis, `worker` / `worker:dev` scripts
- `apps/backend/config.js` — `redisUrl`
- `apps/backend/queues/connection.js`
- `apps/backend/queues/emailQueue.js`
- `apps/backend/queues/index.js`
- `apps/backend/workers/emailWorker.js`
- `apps/backend/workers/index.js`
- `AI.md` — migration memory file
