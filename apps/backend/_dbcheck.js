// Scratch DB check + Role enum migration (deleted after use). Never prints credentials.
const fs = require("fs");
const path = require("path");

const envRaw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
const m = envRaw.match(/^DATABASE_URL=(.*)$/m);
if (!m) { console.error("NO_DATABASE_URL"); process.exit(1); }
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

(async () => {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log("CONNECTED host=" + new URL(url.replace(/:[^:@/]+@/, ":***@")).hostname);
    const enums = await client.query(
      "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'Role' ORDER BY e.enumsortorder"
    );
    console.log("ROLE_VALUES=" + JSON.stringify(enums.rows.map((r) => r.enumlabel)));
    const found = await client.query('SELECT id FROM "User" WHERE id = ANY($1)', [IDS]);
    console.log("TEST_IDS_FOUND=" + found.rows.length + "/" + IDS.length);
    if (!enums.rows.some((r) => r.enumlabel === "WRITER")) {
      await client.query('ALTER TYPE "Role" ADD VALUE IF NOT EXISTS \'WRITER\'');
      const after = await client.query(
        "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'Role' ORDER BY e.enumsortorder"
      );
      console.log("ROLE_VALUES_AFTER=" + JSON.stringify(after.rows.map((r) => r.enumlabel)));
    } else {
      console.log("MIGRATION_SKIPPED=WRITER already present");
    }
  } catch (e) {
    console.error("DB_ERROR=" + e.message);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch {}
  }
})();
