/**
 * Email worker — welcome, OTP, digests, new-chapter, run-digest-batch.
 */
const { Worker } = require("bullmq");
const { redisConnection } = require("../queues/connection");
const {
  EMAIL_QUEUE_NAME,
  enqueueDigest,
} = require("../queues/emailQueue");
const { sendGmail, sendSlack } = require("../config");

let prisma;
try {
  const { PrismaClient } = require("@prisma/client");
  prisma = new PrismaClient();
} catch (e) {
  console.warn("[EmailWorker] Prisma not available:", e.message);
}

const brandShell = (inner) => `
  <div style="font-family: Georgia, serif; padding: 40px; background-color: #fdfaf5; color: #003631; border: 1px solid #e8e0d5; border-radius: 16px; max-width: 500px; margin: auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <span style="font-size: 28px; font-weight: bold; color: #003631; letter-spacing: 3px; border-bottom: 3px solid #FFEDA8; padding-bottom: 5px;">STORYNEST</span>
    </div>
    ${inner}
    <p style="font-size: 10px; text-align: center; color: #8C7B6E; letter-spacing: 1px; margin-top: 30px;">STORYNEST • THE HOME FOR IMAGINATION</p>
  </div>
`;

async function runDigestBatch(period = "weekly") {
  if (!prisma) {
    console.warn("[EmailWorker] run-digest-batch skipped — no Prisma");
    return { enqueued: 0 };
  }

  const days = period === "daily" ? 1 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let recentStories = [];
  try {
    recentStories = await prisma.story.findMany({
      where: {
        isDraft: false,
        publishedAt: { gte: since },
      },
      orderBy: { publishedAt: "desc" },
      take: 8,
      select: {
        title: true,
        authorName: true,
        genre: true,
      },
    });
  } catch (e) {
    console.warn("[EmailWorker] story fetch failed, trying looser query:", e.message);
    try {
      recentStories = await prisma.story.findMany({
        where: { isDraft: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { title: true, authorName: true },
      });
    } catch (e2) {
      console.error("[EmailWorker] story fetch failed:", e2.message);
    }
  }

  const items = recentStories.map((s) => ({
    title: s.title,
    author: s.authorName || undefined,
  }));

  // Prefer users who opted into notifications; fall back to any with email.
  let users = [];
  try {
    users = await prisma.user.findMany({
      where: {
        notificationsOn: true,
        email: { not: null },
      },
      select: { id: true, email: true, username: true },
      take: 500,
    });
  } catch (e) {
    console.warn("[EmailWorker] notificationsOn filter failed, using all with email:", e.message);
    try {
      users = await prisma.user.findMany({
        where: { email: { not: null } },
        select: { id: true, email: true, username: true },
        take: 200,
      });
    } catch (e2) {
      console.error("[EmailWorker] user fetch failed:", e2.message);
      return { enqueued: 0 };
    }
  }

  let enqueued = 0;
  for (const u of users) {
    if (!u.email) continue;
    try {
      await enqueueDigest({
        email: u.email,
        username: u.username,
        items,
        period,
      });
      enqueued += 1;
    } catch (err) {
      console.error(`[EmailWorker] enqueue digest for ${u.email}:`, err.message);
    }
  }

  console.log(`[EmailWorker] Digest batch: ${enqueued} emails queued (${period})`);
  try {
    await sendSlack(`*Digest batch* ${period}: queued ${enqueued} emails`);
  } catch {
    /* optional */
  }
  return { enqueued, period };
}

function createEmailWorker() {
  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
      const { name, data } = job;
      console.log(`[EmailWorker] Processing job ${job.id} type=${name}`);

      switch (name) {
        case "welcome": {
          const { email, username } = data;
          await sendGmail({
            to: email,
            subject: "Welcome to StoryNest",
            html: brandShell(`
              <h1 style="color: #003631; font-size: 24px; text-align: center;">Welcome, ${username || "Nestling"}!</h1>
              <p style="font-size: 16px; line-height: 1.6; text-align: center;">
                Your nest is ready. Dive into stories, build streaks, and let imagination take flight.
              </p>
            `),
          });
          await sendSlack(`*Welcome Email Sent*\n*User:* ${email} (${username || "n/a"})`);
          break;
        }

        case "otp": {
          const { email, otp, type } = data;
          await sendGmail({
            to: email,
            subject:
              type === "registration"
                ? "Your StoryNest Verification Code"
                : "Reset Your StoryNest Password",
            html: brandShell(`
              <h1 style="color: #003631; font-size: 24px; text-align: center;">Verification Code</h1>
              <div style="background-color: #003631; color: #FFEDA8; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; letter-spacing: 10px; font-weight: bold;">${otp}</span>
              </div>
            `),
          });
          break;
        }

        case "digest": {
          const { email, username, items = [], period = "weekly" } = data;
          const list = (items || [])
            .map(
              (it) =>
                `<li style="margin-bottom: 8px;"><strong>${it.title || "Story"}</strong>${it.author ? ` — ${it.author}` : ""}</li>`
            )
            .join("");
          await sendGmail({
            to: email,
            subject:
              period === "daily"
                ? "Your StoryNest daily nest"
                : "Your StoryNest weekly digest",
            html: brandShell(`
              <h1 style="color: #003631; font-size: 22px; text-align: center;">Hello, ${username || "Nestling"}</h1>
              <p style="font-size: 15px; line-height: 1.6; text-align: center;">
                Here&apos;s what&apos;s waiting in the nest this ${period === "daily" ? "day" : "week"}.
              </p>
              <ul style="text-align: left; padding-left: 20px;">${list || "<li>Explore new stories on StoryNest.</li>"}</ul>
            `),
          });
          break;
        }

        case "new-chapter": {
          const { email, username, storyTitle, chapterTitle } = data;
          await sendGmail({
            to: email,
            subject: `New chapter: ${storyTitle || "a story you follow"}`,
            html: brandShell(`
              <h1 style="color: #003631; font-size: 22px; text-align: center;">New chapter landed</h1>
              <p style="font-size: 15px; line-height: 1.6; text-align: center;">
                Hi ${username || "Nestling"}, <strong>${chapterTitle || "A new chapter"}</strong>
                is ready in <em>${storyTitle || "your story"}</em>.
              </p>
            `),
          });
          break;
        }

        case "run-digest-batch": {
          return await runDigestBatch(data?.period || "weekly");
        }

        default:
          console.warn(`[EmailWorker] Unknown job type: ${name}`);
      }

      return { ok: true, type: name };
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[EmailWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[EmailWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

module.exports = { createEmailWorker, runDigestBatch };
