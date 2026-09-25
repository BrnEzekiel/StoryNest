/**
 * Content queue — scheduled publish, AI tagging, cover processing (Phase 3 scaffold).
 * Wire workers when deploy has Redis; chapter.publishedAt can drive delayed jobs.
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

/**
 * Schedule a story/chapter publish at a future time.
 * @param {{ storyId: string, chapterId?: string, publishAt: string|Date }} payload
 */
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

module.exports = {
  contentQueue,
  CONTENT_QUEUE_NAME,
  enqueueScheduledPublish,
  enqueueProcessCover,
};
