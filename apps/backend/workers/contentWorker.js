/**
 * Content worker — scheduled publish + cover processing.
 * Uses Prisma when DATABASE_URL is available.
 */
const { Worker } = require("bullmq");
const { redisConnection } = require("../queues/connection");
const { CONTENT_QUEUE_NAME } = require("../queues/contentQueue");

let prisma;
try {
  const { PrismaClient } = require("@prisma/client");
  prisma = new PrismaClient();
} catch (e) {
  console.warn("[ContentWorker] Prisma not available:", e.message);
}

function createContentWorker() {
  const worker = new Worker(
    CONTENT_QUEUE_NAME,
    async (job) => {
      const { name, data } = job;
      console.log(`[ContentWorker] job ${job.id} type=${name}`, data);

      switch (name) {
        case "publish-story": {
          if (!prisma) {
            console.warn("[ContentWorker] Skip publish — no Prisma");
            break;
          }
          const now = new Date();
          if (data.chapterId) {
            await prisma.chapter.update({
              where: { id: data.chapterId },
              data: {
                isDraft: false,
                publishedAt: now,
              },
            });
            console.log(`[ContentWorker] Chapter ${data.chapterId} published`);
          }
          if (data.storyId) {
            await prisma.story.update({
              where: { id: data.storyId },
              data: {
                isDraft: false,
                publishedAt: now,
              },
            });
            console.log(`[ContentWorker] Story ${data.storyId} published`);
          }
          break;
        }
        case "process-cover": {
          console.log(`[ContentWorker] process-cover (noop until Cloudinary pipeline):`, data);
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
