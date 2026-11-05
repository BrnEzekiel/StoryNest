jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

import { migrateTabOrder, DEFAULT_TAB_ORDER } from "../ThemeContext";

describe("migrateTabOrder", () => {
  test("keeps a full modern order untouched", () => {
    const order = ["Home", "Read", "Podcasts", "Chat", "Activity"];
    expect(migrateTabOrder(order)).toEqual(order);
  });

  test("maps legacy names to modern tabs", () => {
    expect(migrateTabOrder(["Home", "Explore", "Profile"])).toEqual([
      "Home",
      "Read",
      "Activity",
      "Podcasts",
      "Chat",
    ]);
  });

  test("Saved is legacy and folds into Read", () => {
    const out = migrateTabOrder(["Home", "Saved"]);
    expect(out).not.toContain("Saved");
    expect(out).toEqual(["Home", "Read", "Podcasts", "Chat", "Activity"]);
  });

  test("drops unknown tabs and caps at five", () => {
    const out = migrateTabOrder(["Home", "Nope", "Read", "Podcasts", "Chat", "Activity", "Extra"]);
    expect(out.length).toBe(5);
    expect(out).not.toContain("Nope");
    expect(out).not.toContain("Extra");
  });

  test("default order carries five tabs", () => {
    expect(DEFAULT_TAB_ORDER).toEqual(["Home", "Read", "Podcasts", "Chat", "Activity"]);
  });
});
