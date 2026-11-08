// Maintained unit tests for trust & safety helpers (no DB required).
// Run: npm test -- trust.test.js   (from apps/backend)
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { totpCode, verifyTotp, newTotpSecret, containsBlocked, containmentScore, ageFromDob } = require("../utils/trust");

describe("TOTP", () => {
  test("verifies a code it just generated", () => {
    const secret = newTotpSecret();
    assert.equal(verifyTotp(secret, totpCode(secret)), true);
  });

  test("rejects wrong codes and bad input", () => {
    const secret = newTotpSecret();
    assert.equal(verifyTotp(secret, "000000"), false);
    assert.equal(verifyTotp(secret, "abc"), false);
    assert.equal(verifyTotp("", totpCode(secret)), false);
    assert.equal(verifyTotp(secret, ""), false);
  });

  test("generates unique base32 secrets", () => {
    const a = newTotpSecret();
    const b = newTotpSecret();
    assert.notEqual(a, b);
    assert.match(a, /^[A-Z2-7]{32}$/);
  });
});

describe("content filter", () => {
  test("flags slurs, explicit content, and spam", () => {
    assert.equal(containsBlocked("you are a retard"), true);
    assert.equal(containsBlocked("check my onlyfans page"), true);
    assert.equal(containsBlocked("https://a.co https://b.co https://c.co deals"), true);
    assert.equal(containsBlocked("FREE MONEY if you click now"), true);
  });

  test("passes ordinary story text", () => {
    assert.equal(containsBlocked("The assassin crept through the class showcase."), false);
    assert.equal(containsBlocked("She sells seashells by the seashore."), false);
    assert.equal(containsBlocked(""), false);
  });
});

describe("plagiarism containment", () => {
  const original = "the quick brown fox jumps over the lazy dog near the quiet river bank at dawn";
  test("scores near-identical text high", () => {
    assert.ok(containmentScore(original, original) >= 0.99);
    assert.ok(containmentScore(original + " extra words at the very end here", original) > 0.5);
  });

  test("scores unrelated text low", () => {
    assert.ok(containmentScore("completely different words about cooking recipes and spices", original) < 0.2);
    assert.equal(containmentScore("", original), 0);
  });
});

describe("age gate", () => {
  test("computes age from date of birth", () => {
    const twenty = new Date();
    twenty.setFullYear(twenty.getFullYear() - 20);
    assert.equal(ageFromDob(twenty.toISOString()), 20);
    assert.equal(ageFromDob(null), null);
    assert.equal(ageFromDob("not-a-date"), null);
  });
});
