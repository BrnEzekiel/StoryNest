/**
 * Email queue — welcome, OTP, digests, new-chapter notifications, etc.
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

/** Weekly/daily digest — cron or admin can call this. */
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

module.exports = {
  emailQueue,
  EMAIL_QUEUE_NAME,
  enqueueWelcomeEmail,
  enqueueEmail,
  enqueueDigest,
  enqueueNewChapterEmail,
};
