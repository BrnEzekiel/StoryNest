/**
 * Content worker — processes scheduled publish and media jobs.
 * Publish handler is a stub that logs; extend to set isDraft=false / publishedAt in Prisma.
 */
const { Worker } = require("bullmq");
const { redisConnection } = require("../queues/connection");
const { CONTENT_QUEUE_NAME } = require("../queues/contentQueue");

function createContentWorker() {
  const worker = new Worker(
    CONTENT_QUEUE_NAME,
    async (job) => {
      const { name, data } = job;
      console.log(`[ContentWorker] job ${job.id} type=${name}`, data);

      switch (name) {
        case "publish-story": {
          // TODO: prisma.story / chapter update when index is modularized
          console.log(
            `[ContentWorker] Would publish story=${data.storyId} chapter=${data.chapterId}`
          );
          break;
        }
        case "process-cover": {
          console.log(`[ContentWorker] Would process cover`, data);
          break;
        }
        default:
          console.warn(`[ContentWorker] Unknown job type: ${name}`);
      }

      return { ok: true, type: name };
    },
    {
      connection: redisConnection,
      concurrency: 3,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[ContentWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[ContentWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

module.exports = { createContentWorker };
