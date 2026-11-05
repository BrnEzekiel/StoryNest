// Scratch pre-delete census (deleted after use). Read-only. Never prints credentials.
const fs = require("fs");
const path = require("path");

const envRaw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
const m = envRaw.match(/^DATABASE_URL=(.*)$/m);
let url = m[1].trim();
if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) url = url.slice(1, -1);

const { Client } = require("pg");
const IDS = [
  "031b1822-f8ad-4d22-8cd4-2965e4354774",
  "685b126b-a1b1-4600-9fe6-0a1178cbde07",
  "8e5215ba-de19-46e7-9d0a-d0852ed430e8",
  "954c4e5e-53c1-4b11-ac4f-58686650b34a",
  "cd2e3146-930c-4760-8a1f-6f4ef1ae035b",
  "d4a08747-76e0-4c82-ad86-bb7616bf0fce",
  "eadbed45-38d1-4702-85a1-db46bbc0a97a",
];

const CHECKS = [
  ["users", 'SELECT id, email, role FROM "User" WHERE id = ANY($1) ORDER BY email'],
  ["ownedStories", 'SELECT id, title FROM "Story" WHERE "ownerId" = ANY($1)'],
  ["Bookmark", 'SELECT COUNT(*)::int c FROM "Bookmark" WHERE "userId" = ANY($1)'],
  ["History", 'SELECT COUNT(*)::int c FROM "History" WHERE "userId" = ANY($1)'],
  ["Like", 'SELECT COUNT(*)::int c FROM "Like" WHERE "userId" = ANY($1)'],
  ["Comment", 'SELECT COUNT(*)::int c FROM "Comment" WHERE "userId" = ANY($1)'],
  ["Review", 'SELECT COUNT(*)::int c FROM "Review" WHERE "userId" = ANY($1)'],
  ["Note", 'SELECT COUNT(*)::int c FROM "Note" WHERE "userId" = ANY($1)'],
  ["Highlight", 'SELECT COUNT(*)::int c FROM "Highlight" WHERE "userId" = ANY($1)'],
  ["Activity", 'SELECT COUNT(*)::int c FROM "Activity" WHERE "userId" = ANY($1) OR "targetUserId" = ANY($1)'],
  ["PollVote", 'SELECT COUNT(*)::int c FROM "PollVote" WHERE "userId" = ANY($1)'],
  ["Playlist", 'SELECT COUNT(*)::int c FROM "Playlist" WHERE "userId" = ANY($1)'],
  ["Follows", 'SELECT COUNT(*)::int c FROM "Follows" WHERE "followerId" = ANY($1) OR "followingId" = ANY($1)'],
  ["Purchase", 'SELECT COUNT(*)::int c FROM "Purchase" WHERE "userId" = ANY($1)'],
  ["Achievement", 'SELECT COUNT(*)::int c FROM "Achievement" WHERE "userId" = ANY($1)'],
  ["Message", 'SELECT COUNT(*)::int c FROM "Message" WHERE "senderId" = ANY($1) OR "receiverId" = ANY($1)'],
  ["referredOthers", 'SELECT COUNT(*)::int c FROM "User" WHERE "referrerId" = ANY($1)'],
];

(async () => {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    for (const [name, sql] of CHECKS) {
      const r = await client.query(sql, [IDS]);
      console.log(name + "=" + JSON.stringify(r.rows));
    }
    const m2m = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%StoryCoAuthor%' OR table_name LIKE '%_Story%'"
    );
    console.log("m2mTables=" + JSON.stringify(m2m.rows));
  } catch (e) {
    console.error("DB_ERROR=" + e.message);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch {}
  }
})();
