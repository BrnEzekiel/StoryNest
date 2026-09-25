/**
 * Queues barrel — import from here in the API server.
 */
const {
  emailQueue,
  EMAIL_QUEUE_NAME,
  enqueueWelcomeEmail,
  enqueueEmail,
  enqueueDigest,
  enqueueNewChapterEmail,
  enqueueDigestBatch,
  ensureDigestScheduler,
} = require("./emailQueue");

const {
  contentQueue,
  CONTENT_QUEUE_NAME,
  enqueueScheduledPublish,
  enqueueProcessCover,
  ensureDueChapterScanner,
} = require("./contentQueue");

module.exports = {
  emailQueue,
  EMAIL_QUEUE_NAME,
  enqueueWelcomeEmail,
  enqueueEmail,
  enqueueDigest,
  enqueueNewChapterEmail,
  enqueueDigestBatch,
  ensureDigestScheduler,
  contentQueue,
  CONTENT_QUEUE_NAME,
  enqueueScheduledPublish,
  enqueueProcessCover,
  ensureDueChapterScanner,
};
