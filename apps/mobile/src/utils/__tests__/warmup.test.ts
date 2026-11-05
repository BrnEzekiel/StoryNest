import apiClient from "../../api/apiClient";
import { shouldWarmup, warmupServer, __resetWarmup, WARMUP_WINDOW_MS } from "../warmup";

jest.mock("../../api/apiClient", () => ({
  __esModule: true,
  default: { get: jest.fn(async () => ({ data: { status: "ok" } })) },
}));

const mockedGet = apiClient.get as unknown as {
  (...args: any[]): Promise<unknown>;
  mockClear(): void;
  mockRejectedValueOnce(v: unknown): void;
};

describe("warmup", () => {
  beforeEach(() => {
    __resetWarmup();
    mockedGet.mockClear();
  });

  test("shouldWarmup fires once per window", () => {
    expect(shouldWarmup(null, 1000)).toBe(true);
    expect(shouldWarmup(1000, 1000 + WARMUP_WINDOW_MS - 1)).toBe(false);
    expect(shouldWarmup(1000, 1000 + WARMUP_WINDOW_MS)).toBe(true);
  });

  test("warmupServer pings /health once per window and never throws", () => {
    warmupServer();
    warmupServer();
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledWith("/health", { timeout: 10000 });
  });

  test("warmupServer swallows ping failures", async () => {
    mockedGet.mockRejectedValueOnce(new Error("cold"));
    expect(() => warmupServer()).not.toThrow();
    await Promise.resolve();
  });
});
