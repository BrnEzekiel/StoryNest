import nacl from "tweetnacl";
import { decodeUTF8, encodeUTF8, decodeBase64, encodeBase64 } from "tweetnacl-util";
import { Storage } from "./Storage";
import apiClient from "../api/apiClient";

/**
 * 1:1 chat encryption (NaCl box = X25519 + authenticated encryption).
 * Each device holds a keypair: the SECRET never leaves secure storage, the
 * PUBLIC key is published so others can encrypt to us. The server only ever
 * sees ciphertext. This is honest end-to-end encryption for DMs; it does not
 * implement Signal's forward secrecy or key verification.
 */

const keyFor = (userId: string) => `e2ee:secret:${userId}`;

/** Other users' public keys, base64 (memory cache; also seeded from API). */
const pubCache = new Map<string, string>();

export const cacheUserPublicKey = (userId: string, pub: string | null | undefined) => {
  if (userId && pub) pubCache.set(userId, pub);
};

/** Make sure I have a keypair; publish the public half if the server differs. */
export const ensureChatKeys = async (userId: string, serverPublicKey?: string | null): Promise<string | null> => {
  try {
    let secretB64 = await Storage.getItem(keyFor(userId));
    if (!secretB64) {
      const kp = nacl.box.keyPair();
      secretB64 = encodeBase64(kp.secretKey);
      await Storage.setItem(keyFor(userId), secretB64);
    }
    const pubB64 = encodeBase64(nacl.box.keyPair.fromSecretKey(decodeBase64(secretB64)).publicKey);
    if (pubB64 !== serverPublicKey) {
      try {
        await apiClient.post("/users/me/keys", { publicKey: pubB64 });
      } catch {}
    }
    return pubB64;
  } catch {
    return null;
  }
};

export const getMySecretKey = async (userId: string): Promise<Uint8Array | null> => {
  try {
    const s = await Storage.getItem(keyFor(userId));
    return s ? decodeBase64(s) : null;
  } catch {
    return null;
  }
};

export const getUserPublicKey = async (userId: string): Promise<Uint8Array | null> => {
  const hit = pubCache.get(userId);
  if (hit) {
    try {
      return decodeBase64(hit);
    } catch {
      pubCache.delete(userId);
    }
  }
  try {
    const res = await apiClient.get(`/users/${userId}/key`);
    const pk = res.data?.publicKey as string | null;
    if (pk) {
      pubCache.set(userId, pk);
      return decodeBase64(pk);
    }
  } catch {}
  return null;
};

/** Encrypt to the other party. Output is base64(nonce + ciphertext). */
export const encryptTo = (plaintext: string, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): string => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(decodeUTF8(plaintext), nonce, theirPublicKey, mySecretKey);
  const full = new Uint8Array(nonce.length + box.length);
  full.set(nonce);
  full.set(box, nonce.length);
  return encodeBase64(full);
};

/** Decrypt from the other party. Null when tampered, wrong key, or corrupt. */
export const decryptFrom = (
  payloadB64: string,
  theirPublicKey: Uint8Array,
  mySecretKey: Uint8Array
): string | null => {
  try {
    const full = decodeBase64(payloadB64);
    if (full.length <= nacl.box.nonceLength) return null;
    const nonce = full.slice(0, nacl.box.nonceLength);
    const box = full.slice(nacl.box.nonceLength);
    const msg = nacl.box.open(box, nonce, theirPublicKey, mySecretKey);
    return msg ? encodeUTF8(msg) : null;
  } catch {
    return null;
  }
};
