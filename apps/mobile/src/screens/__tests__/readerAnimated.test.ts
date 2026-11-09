import * as fs from "fs";
import * as path from "path";

// Guard: animated style values must only hang off Animated.* components.
// A plain <ScrollView style={{ opacity: <Animated.Value> }} compiles and
// typechecks fine, then crashes every open on device with
// ClassCastException (ReadableNativeMap cannot be cast to Double) —
// exactly the v1.0.8 story-open crash.
describe("reader animated values", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "StoryReaderScreen.tsx"),
    "utf8"
  );
  const ANIMATED_IDS = ["chapterFade", "chapterSlide", "progressBarWidth"];

  it("mounts the main scroller as Animated.ScrollView", () => {
    expect(src).toMatch(/<Animated\.ScrollView\s+ref=\{scrollViewRef\}/);
  });

  it("passes no animated value to a plain ScrollView", () => {
    const plainOpens = [...src.matchAll(/(?<!Animated\.)<ScrollView\b/g)];
    expect(plainOpens.length).toBeGreaterThan(0);
    for (const m of plainOpens) {
      const propsBlock = src.slice(m.index!, m.index! + 600);
      for (const id of ANIMATED_IDS) {
        expect(propsBlock).not.toContain(id);
      }
    }
  });
});
