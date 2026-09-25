/**
 * Email queue — welcome, OTP, digests, new-chapter, digest-batch cron.
 */
const { Queue } = require("bullmq");
const { redisConnection } = require("./connection");

const EMAIL_QUEUE_NAME = "email";

const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

async function enqueueWelcomeEmail(payload) {
  return emailQueue.add("welcome", payload, {
    jobId: `welcome-${payload.email}-${Date.now()}`,
  });
}

async function enqueueEmail(type, payload, options = {}) {
  return emailQueue.add(type, payload, options);
}

async function enqueueDigest(payload, options = {}) {
  return emailQueue.add("digest", payload, {
    jobId: `digest-${payload.email}-${payload.period || "weekly"}-${Date.now()}`,
    ...options,
  });
}

async function enqueueNewChapterEmail(payload) {
  return emailQueue.add("new-chapter", payload, {
    jobId: `newch-${payload.email}-${payload.chapterTitle || Date.now()}`,
  });
}

/** Enqueue a one-shot batch run (or used by the repeatable scheduler). */
async function enqueueDigestBatch(period = "weekly") {
  return emailQueue.add(
    "run-digest-batch",
    { period },
    { jobId: `digest-batch-${period}-${Date.now()}` }
  );
}

/**
 * Register weekly digest cron (Sunday 09:00 UTC).
 * Safe to call on every worker boot — BullMQ dedupes by jobId/key.
 */
async function ensureDigestScheduler() {
  await emailQueue.add(
    "run-digest-batch",
    { period: "weekly" },
    {
      repeat: { pattern: "0 9 * * 0" },
      jobId: "digest-batch-weekly",
    }
  );
  console.log("[EmailQueue] Weekly digest scheduler registered (Sun 09:00 UTC)");
}

module.exports = {
  emailQueue,
  EMAIL_QUEUE_NAME,
  enqueueWelcomeEmail,
  enqueueEmail,
  enqueueDigest,
  enqueueNewChapterEmail,
  enqueueDigestBatch,
  ensureDigestScheduler,
};
