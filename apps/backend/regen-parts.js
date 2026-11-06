// Rebuilds b64_*.txt from app.runtime.js. app.js executes the PARTS, not the
// source, so every app.runtime.js change must be followed by:
//     node regen-parts.js
// The script refuses to finish unless the parts decode byte-identical.
const fs = require("fs");
const path = require("path");

const srcPath = path.join(__dirname, "app.runtime.js");
const src = fs.readFileSync(srcPath, "utf8");
const b64 = Buffer.from(src, "utf8").toString("base64");

// Keep the historical chunk size and trailing-newline style so diffs stay small.
const part0 = path.join(__dirname, "b64_0.txt");
const prev0 = fs.existsSync(part0) ? fs.readFileSync(part0, "utf8") : "";
const CHUNK = prev0.trim().length || 60000;
const EOL = prev0.endsWith("\n") ? "\n" : "";

let i = 0;
for (; i * CHUNK < b64.length; i++) {
  fs.writeFileSync(path.join(__dirname, `b64_${i}.txt`), b64.slice(i * CHUNK, (i + 1) * CHUNK) + EOL);
}
const count = i;
for (;; i++) {
  const stale = path.join(__dirname, `b64_${i}.txt`);
  if (!fs.existsSync(stale)) break;
  fs.unlinkSync(stale);
}

let joined = "";
for (let j = 0; ; j++) {
  const part = path.join(__dirname, `b64_${j}.txt`);
  if (!fs.existsSync(part)) break;
  joined += fs.readFileSync(part, "utf8").trim();
}
if (Buffer.from(joined, "base64").toString("utf8") !== src) {
  console.error("ROUNDTRIP MISMATCH: parts do not decode to app.runtime.js");
  process.exit(1);
}
console.log(`regen ok: ${count} parts, ${src.length} source bytes, roundtrip identical`);
