# StoryNest Android APK (stable, Android 10+)

## Why the previous APK crashed on open

Typical causes fixed in **v1.0.2**:

1. **Expo Updates** (`checkOnLaunch: ALWAYS`) — OTA fetch failures can kill the app at launch → **disabled** for this build.
2. **Wrong `react-native-webview`** (13.16 vs Expo 51’s 13.8.6) → **pinned to 13.8.6**.
3. **`BiometricGate` returned `null` while checking** → looked like an instant crash → green boot screen + skip path.
4. **`EXPO_PUBLIC_API_URL=localhost`** baked into release → phone cannot reach API (not always a crash, but “broken” app).
5. **Too many font packages** → size bloat → trimmed to fonts actually used in `App.tsx`.

**minSdk 29** = Android 10 and above (your request).

---

## Build the APK on your PC (EAS cloud — recommended)

You need: Node 20+, Expo account, internet.

```bash
git pull origin main
cd apps/mobile
npm install

# Log in once
npx eas-cli login

# Set your LIVE API URL (must be https reachable from phones)
# Edit eas.json → preview.env.EXPO_PUBLIC_API_URL
# or pass:
npx eas-cli build -p android --profile preview --env EXPO_PUBLIC_API_URL=https://YOUR-API.onrender.com
```

When the build finishes, EAS gives a **download link** for the `.apk`. Install on device (enable “Install unknown apps”).

### Size target &lt; 30 MB

Already enabled:

- Hermes
- Proguard + resource shrinking
- Legacy packaging
- Fewer font packages
- Updates plugin removed from active path

If still large, in Expo dashboard disable unused permissions and avoid bundling huge Lottie JSON assets.

---

## Local APK (needs Android SDK)

```bash
cd apps/mobile
npx expo prebuild -p android --clean
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

---

## Install tips (Android 10+)

1. Uninstall any old StoryNest build first.
2. Install the new APK.
3. Grant notifications only if prompted — app should open to login without network at first frame.
4. API must use **HTTPS** (cleartext HTTP is blocked on modern Android unless you add a network security config).

---

## Honest limit

A signed `.apk` binary cannot be generated inside this chat environment (no Android SDK / no your EAS credentials). After you run the EAS command above, the artifact is the working install file.

If the new build still closes immediately: connect the phone with USB debugging and run:

```bash
adb logcat *:E ReactNative:V ReactNativeJS:V
```

and share the red stack trace.
