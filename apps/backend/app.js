/**
 * Assembles full backend from base64 parts (Phase 0 recovery packaging).
 * Runtime-equivalent to the original single index.js + BullMQ wiring.
 */
const path = require("path");
const Module = require("module");

const parts = [];
for (let i = 0; i < 7; i++) {
  parts.push(require("./app.b64." + i));
}
const code = Buffer.from(parts.join(""), "base64").toString("utf8");

const filename = path.join(__dirname, "app.runtime.js");
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(__dirname);
m._compile(code, filename);
