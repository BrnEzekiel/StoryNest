import fs from "fs";
import path from "path";

// Regression test for the release-APK launch crash: two copies of
// react-native-webview (nested 13.8.6 + hoisted 13.16.x) made Metro bundle
// one copy's JS spec while Gradle autolinked the other's native code, so
// TurboModuleRegistry.getEnforcing() asked for a module the binary never
// registered ("'RNCWebViewModule' could not be found").

const APP_DIR = path.resolve(__dirname, "..", "..", "..");

function resolveDepRoot(fromDir: string, dep: string): string | null {
  let dir = fromDir;
  while (true) {
    const candidate = path.join(dir, "node_modules", dep, "package.json");
    if (fs.existsSync(candidate)) return path.dirname(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function consumerDir(dep: string): string {
  const root = resolveDepRoot(APP_DIR, dep);
  if (!root) throw new Error(`cannot resolve ${dep} from ${APP_DIR}`);
  return root;
}

describe("native dep dedupe (react-native-webview)", () => {
  test("every consumer resolves to the same copy", () => {
    const consumers = [
      APP_DIR,
      consumerDir("react-native-youtube-iframe"),
      consumerDir("react-native-paystack-webview"),
    ];
    const resolved = consumers.map((c) => {
      const r = resolveDepRoot(c, "react-native-webview");
      expect(r).not.toBeNull();
      return r as string;
    });
    expect(new Set(resolved).size).toBe(1);
  });

  test("resolved copy's JS spec name matches its native module name", () => {
    const webviewRoot = resolveDepRoot(APP_DIR, "react-native-webview");
    expect(webviewRoot).not.toBeNull();
    const libDir = path.join(webviewRoot as string, "lib");
    const specNames = new Set<string>();
    for (const f of fs.readdirSync(libDir)) {
      if (!f.endsWith(".js")) continue;
      const src = fs.readFileSync(path.join(libDir, f), "utf8");
      for (const m of src.matchAll(/getEnforcing\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        specNames.add(m[1]);
      }
    }
    expect(specNames.size).toBeGreaterThan(0);
    const impl = path.join(
      webviewRoot as string,
      "android/src/main/java/com/reactnativecommunity/webview/RNCWebViewModuleImpl.java"
    );
    expect(fs.existsSync(impl)).toBe(true);
    const nativeSrc = fs.readFileSync(impl, "utf8");
    const nativeName = nativeSrc.match(/NAME\s*=\s*"([^"]+)"/)?.[1];
    expect(nativeName).toBeDefined();
    for (const name of specNames) {
      expect(name).toBe(nativeName);
    }
  });
});
