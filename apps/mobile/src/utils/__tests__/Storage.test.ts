jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => {
  const mem = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (mem.has(k) ? mem.get(k)! : null)),
      setItem: jest.fn(async (k: string, v: string) => {
        mem.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        mem.delete(k);
      }),
    },
  };
});

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Storage } from "../Storage";
import { withTimeout } from "../promise";

const secure = SecureStore as any;
const memStore = AsyncStorage as any;
// A promise that never settles, like a stalled system keystore.
const never = () => new Promise<any>(() => {});

describe("Storage secure-store hardening", () => {
  beforeEach(() => {
    secure.setItemAsync.mockReset();
    secure.getItemAsync.mockReset();
    secure.deleteItemAsync.mockReset();
    memStore.setItem.mockClear();
    memStore.getItem.mockClear();
  });

  test("withTimeout resolves fast values and rejects hung ones", async () => {
    expect(await withTimeout(Promise.resolve("ok"), 1000)).toBe("ok");
    let err: any = null;
    try {
      await withTimeout(never(), 20, "slow");
    } catch (e) {
      err = e;
    }
    expect(err && err.message).toBe("slow");
  });

  test("setItem falls back to AsyncStorage when the keystore hangs", async () => {
    secure.setItemAsync.mockImplementation(never);
    await Storage.setItem("accessToken", "tok", 20);
    expect(await AsyncStorage.getItem("accessToken")).toBe("tok");
  });

  test("setItem falls back to AsyncStorage when the keystore throws", async () => {
    secure.setItemAsync.mockImplementation(async () => {
      throw new Error("no keystore");
    });
    await Storage.setItem("k", "v", 1000);
    expect(await AsyncStorage.getItem("k")).toBe("v");
  });

  test("healthy SecureStore stays the primary", async () => {
    const mem = new Map<string, string>();
    secure.setItemAsync.mockImplementation(async (k: string, v: string) => {
      mem.set(k, v);
    });
    secure.getItemAsync.mockImplementation(async (k: string) => (mem.has(k) ? mem.get(k)! : null));
    await Storage.setItem("a", "b");
    expect(await Storage.getItem("a")).toBe("b");
    expect(secure.setItemAsync.mock.calls.length).toBe(1);
  });

  test("getItem falls back to AsyncStorage when the keystore hangs", async () => {
    await AsyncStorage.setItem("rt", "refresh-1");
    secure.getItemAsync.mockImplementation(never);
    expect(await Storage.getItem("rt", 20)).toBe("refresh-1");
  });
});
