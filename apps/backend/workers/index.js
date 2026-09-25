/**
 * BullMQ workers entry — run as a separate process from the API.
 *   npm run worker
 *   npm run worker:dev
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("dotenv").config();

const { createEmailWorker } = require("./emailWorker");
const { createContentWorker } = require("./contentWorker");

console.log("[Workers] Starting StoryNest workers (email + content)…");

const emailWorker = createEmailWorker();
const contentWorker = createContentWorker();

async function shutdown() {
  console.log("[Workers] Shutting down…");
  await Promise.all([emailWorker.close(), contentWorker.close()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
