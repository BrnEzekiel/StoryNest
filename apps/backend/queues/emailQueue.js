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

/**
 * Enqueue a welcome email for a new user.
 * @param {{ email: string, username: string }} payload
 */
async function enqueueWelcomeEmail(payload) {
  return emailQueue.add("welcome", payload, {
    jobId: `welcome-${payload.email}-${Date.now()}`,
  });
}

/**
 * Enqueue a generic email job.
 * @param {string} type - job name (e.g. "otp", "digest", "new-chapter")
 * @param {object} payload
 * @param {object} [options] - BullMQ job options (delay, priority, etc.)
 */
async function enqueueEmail(type, payload, options = {}) {
  return emailQueue.add(type, payload, options);
}

module.exports = {
  emailQueue,
  EMAIL_QUEUE_NAME,
  enqueueWelcomeEmail,
  enqueueEmail,
};
