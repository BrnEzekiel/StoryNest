/**
 * Shared Redis connection for BullMQ queues and workers.
 * Uses REDIS_URL from env. Falls back to local Redis for development.
 */
const { config } = require("../config");

const redisConnection = {
  url: config.redisUrl,
  maxRetriesPerRequest: null, // required by BullMQ
};

module.exports = { redisConnection };
