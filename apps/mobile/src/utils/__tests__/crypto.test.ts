jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock("../../api/apiClient", () => ({
  __esModule: true,
  default: { post: jest.fn(async () => ({})), get: jest.fn(async () => ({})) },
}));

jest.mock("expo-secure-store", () => {
  const mem = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (k: string, v: string) => {
      mem.set(k, v);
    }),
    getItemAsync: jest.fn(async (k: string) => (mem.has(k) ? mem.get(k)! : null)),
    deleteItemAsync: jest.fn(async (k: string) => {
      mem.delete(k);
    }),
  };
});

import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import { encryptTo, decryptFrom, ensureChatKeys, getMySecretKey } from "../crypto";
import apiClient from "../../api/apiClient";

describe("chat crypto", () => {
  test("encrypt/decrypt round-trips between two parties", () => {
    const alice = nacl.box.keyPair();
    const bob = nacl.box.keyPair();
    const cipher = encryptTo("hello bob", bob.publicKey, alice.secretKey);
    expect(typeof cipher).toBe("string");
    expect(cipher).not.toContain("hello");
    expect(decryptFrom(cipher, alice.publicKey, bob.secretKey)).toBe("hello bob");
    // Sender can read their own message back with the same shared secret.
    expect(decryptFrom(cipher, bob.publicKey, alice.secretKey)).toBe("hello bob");
  });

  test("wrong key yields null, never garbage", () => {
    const alice = nacl.box.keyPair();
    const bob = nacl.box.keyPair();
    const eve = nacl.box.keyPair();
    const cipher = encryptTo("secret", bob.publicKey, alice.secretKey);
    expect(decryptFrom(cipher, alice.publicKey, eve.secretKey)).toBeNull();
  });

  test("tampered and malformed payloads yield null", () => {
    const alice = nacl.box.keyPair();
    const bob = nacl.box.keyPair();
    const cipher = encryptTo("secret", bob.publicKey, alice.secretKey);
    const tampered = cipher.slice(0, -4) + "AAAA";
    expect(decryptFrom(tampered, alice.publicKey, bob.secretKey)).toBeNull();
    expect(decryptFrom("!!!not-base64!!!", alice.publicKey, bob.secretKey)).toBeNull();
    expect(decryptFrom("", alice.publicKey, bob.secretKey)).toBeNull();
  });

  test("ensureChatKeys creates, persists, and publishes once", async () => {
    const post = apiClient.post as any;
    post.mockClear();
    const pub1 = await ensureChatKeys("user-1", null);
    expect(pub1).toBeTruthy();
    expect(post.mock.calls.length).toBe(1);
    expect(post.mock.calls[0][0]).toBe("/users/me/keys");
    // Second call reuses the stored secret and skips the upload when matching.
    post.mockClear();
    const pub2 = await ensureChatKeys("user-1", pub1);
    expect(pub2).toBe(pub1);
    expect(post.mock.calls.length).toBe(0);
    // Secret round-trips through secure storage.
    const secret = await getMySecretKey("user-1");
    expect(secret).not.toBeNull();
    const derived = encodeBase64(nacl.box.keyPair.fromSecretKey(secret!).publicKey);
    expect(derived).toBe(pub1);
  });
});
