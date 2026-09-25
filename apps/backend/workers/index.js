/**
 * BullMQ workers entry point.
 * Run separately from the API server:
 *   npm run worker          (production)
 *   npm run worker:dev      (development with nodemon)
 */
require("dotenv").config();

const { createEmailWorker } = require("./emailWorker");

console.log("[Workers] Starting BullMQ workers...");

const emailWorker = createEmailWorker();

console.log("[Workers] Email worker ready");

async function shutdown() {
  console.log("[Workers] Shutting down...");
  await emailWorker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
