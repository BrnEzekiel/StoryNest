/**
 * Content queue — scheduled publish, due-chapter scan, cover processing.
 */
const { Queue } = require("bullmq");
const { redisConnection } = require("./connection");

const CONTENT_QUEUE_NAME = "content";

const contentQueue = new Queue(CONTENT_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 30,
  },
});

async function enqueueScheduledPublish(payload) {
  const when = new Date(payload.publishAt).getTime();
  const delay = Math.max(0, when - Date.now());
  return contentQueue.add(
    "publish-story",
    {
      storyId: payload.storyId,
      chapterId: payload.chapterId || null,
    },
    {
      delay,
      jobId: `publish-${payload.chapterId || payload.storyId}-${when}`,
    }
  );
}

async function enqueueProcessCover(payload) {
  return contentQueue.add("process-cover", payload);
}

/** Register a repeatable scan every 5 minutes (call once at worker boot). */
async function ensureDueChapterScanner() {
  await contentQueue.add(
    "scan-due-chapters",
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
      jobId: "scan-due-chapters-repeat",
    }
  );
  console.log("[ContentQueue] Due-chapter scanner every 5 min");
}

module.exports = {
  contentQueue,
  CONTENT_QUEUE_NAME,
  enqueueScheduledPublish,
  enqueueProcessCover,
  ensureDueChapterScanner,
};
