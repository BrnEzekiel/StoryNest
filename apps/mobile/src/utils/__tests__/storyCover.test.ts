import { validateStoryCover } from "../storyCover";

describe("validateStoryCover", () => {
  test("new story without a cover is rejected", () => {
    expect(
      validateStoryCover({ isEditing: false, coverUri: null, existingCoverUrl: null })
    ).toContain("cover");
  });

  test("new story with a picked cover passes", () => {
    expect(
      validateStoryCover({ isEditing: false, coverUri: "file:///cover.jpg", existingCoverUrl: null })
    ).toBeNull();
  });

  test("edit may keep the existing cover", () => {
    expect(
      validateStoryCover({ isEditing: true, coverUri: null, existingCoverUrl: "https://x/y.jpg" })
    ).toBeNull();
  });

  test("edit with neither picked nor existing cover is rejected", () => {
    expect(
      validateStoryCover({ isEditing: true, coverUri: null, existingCoverUrl: null })
    ).toContain("cover");
  });

  test("edit with a replacement pick passes", () => {
    expect(
      validateStoryCover({ isEditing: true, coverUri: "file:///new.jpg", existingCoverUrl: "https://x/y.jpg" })
    ).toBeNull();
  });
});
