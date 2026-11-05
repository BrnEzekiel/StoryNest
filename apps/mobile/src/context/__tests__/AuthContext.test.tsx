import React from "react";
import renderer, { act } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";

(global as any).IS_REACT_ACT_ENVIRONMENT = true;
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "../AuthContext";

jest.mock("firebase/auth", () => ({
  GoogleAuthProvider: jest.fn(),
  signInWithCredential: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock("../../api/firebaseConfig", () => ({ auth: {} }));
jest.mock("../../api/apiClient", () => ({
  __esModule: true,
  default: { get: jest.fn(async () => ({ data: [] })), post: jest.fn() },
}));
jest.mock("../../utils/NotificationService", () => ({
  triggerLocalNotification: jest.fn(),
  initNotifications: jest.fn(),
}));
jest.mock("expo-av", () => ({
  Audio: { Sound: { createAsync: jest.fn() } },
}));
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
  };
});
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
      setItem: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
      removeItem: jest.fn(async (k: string) => { store.delete(k); }),
    },
  };
});

// Must match USER_SNAPSHOT_KEY in AuthContext.
const SNAPSHOT_KEY = "@sn_auth_user";

const seedUser = {
  id: "u1",
  email: "ada@example.com",
  username: "ada",
  role: "READER",
  coins: 10,
};

let ctx: ReturnType<typeof useAuth> | null = null;
const Probe = () => {
  ctx = useAuth();
  return null;
};

// Concurrent root like the production app: setState updaters run at render
// time, not synchronously inside the setState call.
const createOptions = { unstable_isConcurrent: true } as any;

describe("AuthContext session persistence", () => {
  test("restores the user from the local snapshot without network", async () => {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(seedUser));
    let root: ReactTestRenderer;
    await act(async () => {
      root = renderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
        createOptions
      );
    });
    expect(ctx!.loading).toBe(false);
    expect(ctx!.user?.username).toBe("ada");
    await act(async () => {
      root!.unmount();
    });
  });

  test("updateUser merges and persists the snapshot (survives restart)", async () => {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(seedUser));
    let root: ReactTestRenderer;
    await act(async () => {
      root = renderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
        createOptions
      );
    });
    await act(async () => {
      await ctx!.updateUser({ coins: 99, avatarUrl: "https://x/y.png" } as any);
    });
    expect(ctx!.user?.coins).toBe(99);
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    const snap = JSON.parse(raw!);
    expect(snap.username).toBe("ada");
    expect(snap.coins).toBe(99);
    expect(snap.avatarUrl).toBe("https://x/y.png");
    await act(async () => {
      root!.unmount();
    });
  });
});
