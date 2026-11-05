// Scratch FK-safe delete of 6 test users (deleted after use). Never prints credentials.
const fs = require("fs");
const path = require("path");

const envRaw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
const m = envRaw.match(/^DATABASE_URL=(.*)$/m);
let url = m[1].trim();
if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) url = url.slice(1, -1);

const { Client } = require("pg");
// 6 test users ONLY — admin cd2e3146... deliberately excluded per user choice.
const IDS = [
  "031b1822-f8ad-4d22-8cd4-2965e4354774",
  "685b126b-a1b1-4600-9fe6-0a1178cbde07",
  "8e5215ba-de19-46e7-9d0a-d0852ed430e8",
  "954c4e5e-53c1-4b11-ac4f-58686650b34a",
  "d4a08747-76e0-4c82-ad86-bb7616bf0fce",
  "eadbed45-38d1-4702-85a1-db46bbc0a97a",
];

(async () => {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query("BEGIN");
    // Guard 1: targets exist and none is ADMIN.
    const t = await client.query('SELECT id, role FROM "User" WHERE id = ANY($1)', [IDS]);
    if (t.rows.length !== IDS.length) throw new Error("ABORT: only " + t.rows.length + "/6 targets found");
    if (t.rows.some((r) => r.role === "ADMIN") || t.rows.some((r) => r.id === "cd2e3146-930c-4760-8a1f-6f4ef1ae035b"))
      throw new Error("ABORT: admin in target set");
    // Guard 2: no owned stories (would cascade into other users' content).
    const own = await client.query('SELECT COUNT(*)::int c FROM "Story" WHERE "ownerId" = ANY($1)', [IDS]);
    if (own.rows[0].c > 0) throw new Error("ABORT: targets own " + own.rows[0].c + " stories");

    const counts = {};
    const del = async (name, sql) => {
      const r = await client.query(sql, [IDS]);
      counts[name] = r.rowCount;
    };
    await del("PollVote", 'DELETE FROM "PollVote" WHERE "userId" = ANY($1)');
    await del("Review", 'DELETE FROM "Review" WHERE "userId" = ANY($1)');
    await del("Bookmark", 'DELETE FROM "Bookmark" WHERE "userId" = ANY($1)');
    await del("History", 'DELETE FROM "History" WHERE "userId" = ANY($1)');
    await del("Like", 'DELETE FROM "Like" WHERE "userId" = ANY($1)');
    await del("Note", 'DELETE FROM "Note" WHERE "userId" = ANY($1)');
    await del("Highlight", 'DELETE FROM "Highlight" WHERE "userId" = ANY($1)');
    await del("Activity", 'DELETE FROM "Activity" WHERE "userId" = ANY($1) OR "targetUserId" = ANY($1)');
    await del("Follows", 'DELETE FROM "Follows" WHERE "followerId" = ANY($1) OR "followingId" = ANY($1)');
    await del("Purchase", 'DELETE FROM "Purchase" WHERE "userId" = ANY($1)');
    await del("Achievement", 'DELETE FROM "Achievement" WHERE "userId" = ANY($1)');
    await del("Message", 'DELETE FROM "Message" WHERE "senderId" = ANY($1) OR "receiverId" = ANY($1)');
    await del("PlaylistStory", 'DELETE FROM "PlaylistStory" WHERE "playlistId" IN (SELECT id FROM "Playlist" WHERE "userId" = ANY($1))');
    await del("Playlist", 'DELETE FROM "Playlist" WHERE "userId" = ANY($1)');
    // Co-author links: find the column that references "User" first.
    const col = await client.query(
      `SELECT kcu.column_name FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
       WHERE tc.table_name = '_StoryCoAuthors' AND tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'User'`
    );
    if (col.rows.length > 0) {
      const cname = col.rows[0].column_name;
      const r = await client.query('DELETE FROM "_StoryCoAuthors" WHERE "' + cname + '" = ANY($1)', [IDS]);
      counts["_StoryCoAuthors"] = r.rowCount;
    }
    // Comments: targets' comments plus any replies threaded under them.
    const rc = await client.query(
      `WITH RECURSIVE doomed(id, "userId") AS (
         SELECT id, "userId" FROM "Comment" WHERE "userId" = ANY($1)
         UNION
         SELECT c.id, c."userId" FROM "Comment" c JOIN doomed d ON c."parentId" = d.id
       )
       DELETE FROM "Comment" WHERE id IN (SELECT id FROM doomed) RETURNING id, "userId"`,
      [IDS]
    );
    counts["Comment"] = rc.rowCount;
    counts["Comment_othersReplies"] = rc.rows.filter((r) => !IDS.includes(r.userId)).length;
    // Hygiene: nobody should point at deleted users as referrer.
    const ref = await client.query('UPDATE "User" SET "referrerId" = NULL WHERE "referrerId" = ANY($1)', [IDS]);
    counts["referrerId_nulled"] = ref.rowCount;
    // Finally the users (belt-and-braces role guard in the predicate).
    const u = await client.query('DELETE FROM "User" WHERE id = ANY($1) AND role <> \'ADMIN\'', [IDS]);
    counts["User"] = u.rowCount;
    const left = await client.query('SELECT COUNT(*)::int c FROM "User" WHERE id = ANY($1)', [IDS]);
    if (left.rows[0].c !== 0 || u.rowCount !== IDS.length) throw new Error("ABORT: user delete incomplete");
    await client.query("COMMIT");
    console.log("DELETED=" + JSON.stringify(counts));
    console.log("VERIFY_REMAINING=" + left.rows[0].c);
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("DB_ERROR=" + e.message);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch {}
  }
})();
