import { ActivityLog } from "../activityLog";
import apiClient from "../../api/apiClient";

jest.mock("../../api/apiClient", () => ({
  __esModule: true,
  default: { post: jest.fn(async () => ({})) },
}));

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

describe("ActivityLog", () => {
  beforeEach(async () => {
    await ActivityLog.clear();
  });

  test("logs entries newest-first with timestamps", async () => {
    await ActivityLog.log({ kind: "READ", title: "Story A" });
    await ActivityLog.log({ kind: "LIKE", title: "Story B" });
    const list = await ActivityLog.list();
    expect(list.length).toBe(2);
    expect(list[0].kind).toBe("LIKE");
    expect(list[0].title).toBe("Story B");
    expect(list[0].id).toBeTruthy();
    expect(list[0].ts).toBeGreaterThan(0);
    expect(list[1].kind).toBe("READ");
  });

  test("caps the journal length, dropping oldest", async () => {
    for (let i = 0; i < 205; i++) {
      await ActivityLog.log({ kind: "READ", title: `Story ${i}` });
    }
    const list = await ActivityLog.list();
    expect(list.length).toBe(200);
    expect(list[0].title).toBe("Story 204");
  });

  test("clear empties the journal", async () => {
    await ActivityLog.log({ kind: "READ", title: "Story A" });
    await ActivityLog.clear();
    expect(await ActivityLog.list()).toEqual([]);
  });

  test("survives corrupt stored data", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("@sn_activity_journal", "{not-json");
    ActivityLog.__resetCache();
    expect(await ActivityLog.list()).toEqual([]);
  });

  test("syncs client-only kinds to the server feed", async () => {
    const post = apiClient.post as any;
    post.mockClear();
    await ActivityLog.log({ kind: "READ", title: "Story A" });
    expect(post.mock.calls.length).toBe(1);
    expect(post.mock.calls[0][0]).toBe("/activity/log");
    expect(post.mock.calls[0][1].kind).toBe("READ");
    expect(post.mock.calls[0][1].title).toBe("Story A");
  });

  test("skips server sync for server-logged kinds (no double count)", async () => {
    const post = apiClient.post as any;
    post.mockClear();
    await ActivityLog.log({ kind: "LIKE", title: "Story B" });
    await ActivityLog.log({ kind: "COMMENT", title: "Story C" });
    await ActivityLog.log({ kind: "PUBLISH", title: "Story D" });
    expect(post.mock.calls.length).toBe(0);
  });
});
