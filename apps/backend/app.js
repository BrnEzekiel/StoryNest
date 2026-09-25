/**
 * Assembles full backend from base64 part files.
 * Phase 0 recovery packaging — equivalent to full index.js + BullMQ wiring.
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");

let b64 = "";
for (let i = 0; i < 43; i++) {
  b64 += fs.readFileSync(path.join(__dirname, "b64_" + i + ".txt"), "utf8").trim();
}
const code = Buffer.from(b64, "base64").toString("utf8");

const filename = path.join(__dirname, "app.runtime.js");
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(__dirname);
m._compile(code, filename);
