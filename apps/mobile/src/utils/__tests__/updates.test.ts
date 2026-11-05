import { resolveUpdateAvailability } from "../updates";

describe("resolveUpdateAvailability", () => {
  test("release build with updates enabled can check", () => {
    expect(resolveUpdateAvailability(false, true)).toBe("checkable");
  });

  test("dev builds cannot check (no update channel)", () => {
    expect(resolveUpdateAvailability(true, true)).toBe("disabled");
    expect(resolveUpdateAvailability(true, false)).toBe("disabled");
  });

  test("release builds with updates disabled cannot check", () => {
    expect(resolveUpdateAvailability(false, false)).toBe("disabled");
  });
});
