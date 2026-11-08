/**
 * Trust & safety pure helpers (no DB, no side effects).
 * Kept dependency-free so the maintained unit tests can run anywhere.
 */
const crypto = require("crypto");

const base32Decode = (str) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, "");
  for (const ch of clean) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};

const totpCode = (secret, step = 30, digits = 6, counterOffset = 0) => {
  const counter = Math.floor(Date.now() / 1000 / step) + counterOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.max(0, counter)));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]) % (10 ** digits);
  return String(code).padStart(digits, "0");
};

const verifyTotp = (secret, code) => {
  const c = String(code).replace(/\D/g, "");
  if (!secret || c.length !== 6) return false;
  return [-1, 0, 1].some((o) => totpCode(secret, 30, 6, o) === c);
};

const newTotpSecret = () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.randomBytes(32);
  let out = "";
  for (const b of bytes) out += alphabet[b % 32];
  return out;
};

const BLOCKED_PATTERNS = [
  /\b(fuck|shit|bitch|cunt|dickhead|motherfucker)\b/i,
  /\b(nigger|nigga|faggot|retard|kike|chink)\b/i,
  /\b(porn|xxx|hentai|onlyfans)\b/i,
  /(https?:\/\/\S+.*){3,}/i,
  /\b(buy followers|free money|crypto giveaway|double your btc)\b/i,
];

const containsBlocked = (text) => BLOCKED_PATTERNS.some((re) => re.test(String(text || "")));

const textShingles = (text, k = 5) => {
  const words = String(text || "").toLowerCase().split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + k <= words.length; i++) set.add(words.slice(i, i + k).join(" "));
  return set;
};

const containmentScore = (candidate, existing) => {
  const A = textShingles(candidate);
  const B = textShingles(existing);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter += 1;
  return inter / Math.min(A.size, B.size);
};

const ageFromDob = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
};

module.exports = { base32Decode, totpCode, verifyTotp, newTotpSecret, containsBlocked, textShingles, containmentScore, ageFromDob };
