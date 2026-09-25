/**
 * Queues barrel — import from here in the API server.
 */
const {
  emailQueue,
  EMAIL_QUEUE_NAME,
  enqueueWelcomeEmail,
  enqueueEmail,
} = require("./emailQueue");

module.exports = {
  emailQueue,
  EMAIL_QUEUE_NAME,
  enqueueWelcomeEmail,
  enqueueEmail,
};
