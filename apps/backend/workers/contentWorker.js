/**
 * Content worker — scheduled publish, scan-due chapters, cover processing.
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

async function publishChapter(chapterId, storyId) {
  const now = new Date();
  if (chapterId) {
    await prisma.chapter.update({
      where: { id: chapterId },
      data: { isDraft: false, publishedAt: now },
    });
    console.log(`[ContentWorker] Chapter ${chapterId} published`);
  }
  if (storyId) {
    await prisma.story.update({
      where: { id: storyId },
      data: { isDraft: false, publishedAt: now },
    });
    console.log(`[ContentWorker] Story ${storyId} marked live`);
  }
}

/** Publish chapters whose publishedAt is in the past but still draft-like */
async function scanDueChapters() {
  if (!prisma) {
    console.warn("[ContentWorker] scan-due skipped — no Prisma");
    return { published: 0 };
  }
  const now = new Date();
  const due = await prisma.chapter.findMany({
    where: {
      publishedAt: { lte: now },
      isDraft: true,
    },
    take: 50,
  });
  for (const ch of due) {
    await prisma.chapter.update({
      where: { id: ch.id },
      data: { isDraft: false },
    });
    console.log(`[ContentWorker] scan-due published chapter ${ch.id}`);
  }
  return { published: due.length };
}

function createContentWorker() {
  const worker = new Worker(
    CONTENT_QUEUE_NAME,
    async (job) => {
      const { name, data } = job;
      console.log(`[ContentWorker] job ${job.id} type=${name}`, data || "");

      switch (name) {
        case "publish-story": {
          if (!prisma) {
            console.warn("[ContentWorker] Skip publish — no Prisma");
            break;
          }
          await publishChapter(data.chapterId, data.storyId);
          break;
        }
        case "scan-due-chapters": {
          return await scanDueChapters();
        }
        case "process-cover": {
          console.log(`[ContentWorker] process-cover (noop):`, data);
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

module.exports = { createContentWorker, scanDueChapters };
