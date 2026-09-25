/**
 * Queues barrel — import from here in the API server.
 */
const {
  emailQueue,
  EMAIL_QUEUE_NAME,
  enqueueWelcomeEmail,
  enqueueEmail,
} = require("./emailQueue");

const {
  contentQueue,
  CONTENT_QUEUE_NAME,
  enqueueScheduledPublish,
  enqueueProcessCover,
} = require("./contentQueue");

module.exports = {
  emailQueue,
  EMAIL_QUEUE_NAME,
  enqueueWelcomeEmail,
  enqueueEmail,
  contentQueue,
  CONTENT_QUEUE_NAME,
  enqueueScheduledPublish,
  enqueueProcessCover,
};
