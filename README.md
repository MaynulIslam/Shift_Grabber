# SmartCourier

Personal Android automation app for delivery drivers. **Feature 1 (Shift
Grabber)** is scaffolded end-to-end: a React Native (TypeScript) UI driving a
Kotlin AccessibilityService that reads the Skip The Dishes "Open Shifts" page and
taps claim for shifts matching your preferences.

> ⚠️ **Read first.** This app automates another app's UI on your behalf, which
> very likely violates Skip's terms of service and could get your driver account
> flagged or banned. It's your account and your call — just go in informed.

---

## What's in this repo right now

This is **source only**. The Gradle build shell (wrapper, `build.gradle`,
icons, `styles.xml`) is intentionally not included — let the React Native CLI
generate it for your exact toolchain, then copy these files over (steps below).

```
src/                         # React Native / TypeScript layer (complete)
  types/index.ts             # shared contracts (also describes the native bridge payloads)
  store/                     # Zustand stores (prefs + global settings, MMKV-persisted)
  services/                  # BridgeService (native seam), LogService, NotificationService, storage
  hooks/useNativeBridge.ts   # fans native events -> stores/logs/notifications
  components/                # AppCard, StatusBadge, LogItem, CriteriaSlider
  screens/                   # Home, Skip, ShiftGrabber, Log, Settings
  navigation/                # bottom tabs + Home stack
App.tsx, index.js, app.json

android/app/src/main/
  java/com/smartcourier/
    config/SkipSelectors.kt          # ⭐ the ONE file you tune against real Skip
    core/ShiftGrabber.kt             # process-wide coordinator + JS event emitter
    model/ShiftModels.kt             # prefs + parsed-shift data classes
    modules/ShiftGrabberModule.kt    # JS bridge (matches BridgeService.ts)
    modules/ShiftGrabberPackage.kt
    services/SkipAccessibilityService.kt   # reads + taps the Skip UI
    services/ForegroundService.kt          # persistent notif + coroutine refresh loop
    services/SkipNotificationListenerService.kt  # optional: early scan on Skip push
    utils/AccessibilityUtils.kt      # node traversal/click/scroll helpers
    utils/NodeParser.kt              # parse card text + match against prefs
    MainActivity.kt, MainApplication.kt
  res/xml/accessibility_service_config.xml
  res/values/strings.xml
  AndroidManifest.xml
```

---

## One-time setup (MacBook Air M2, 8 GB)

Recommended toolchain for your machine: **Android Studio for the SDK/adb/native
debugging, VS Code for daily editing, and a physical phone instead of the
emulator** (the emulator is the real RAM hog on 8 GB — skip it).

1. **Install prerequisites**
   - [Node 18+](https://nodejs.org) and a package manager (npm/yarn)
   - **JDK 17** (`brew install --cask zulu@17`)
   - **Android Studio** → SDK Manager → install *Android SDK Platform 34*,
     *Platform-Tools*, *Build-Tools 34*. Set `ANDROID_HOME` and add
     `platform-tools` to your `PATH`.

2. **Generate the build shell, then merge these sources in.** Easiest path that
   avoids hand-writing Gradle:
   ```bash
   # In a scratch dir, generate a clean project with the same name:
   npx @react-native-community/cli@latest init SmartCourier --version 0.73.6
   # Copy the generated android/gradle*, android/build.gradle, android/settings.gradle,
   # android/gradle.properties, android/app/build.gradle, android/app/proguard-rules.pro,
   # and android/app/src/main/res/values/styles.xml + mipmap-* icon folders
   # INTO this repo (do NOT overwrite the files listed above that already exist here).
   ```
   The custom Kotlin lives under `com.smartcourier`, so make sure the generated
   project's `applicationId`/namespace is `com.smartcourier` (the CLI uses the
   name you pass). If it differs, update package declarations or the gradle
   `namespace`.

3. **Install JS dependencies**
   ```bash
   npm install
   ```

4. **Run on your phone** (USB debugging on, `adb devices` shows it):
   ```bash
   npm run android
   ```

---

## Wiring it up the first time (on the phone)

1. **Verify the Skip package name** — the value in `SkipSelectors.PACKAGE` is a
   guess:
   ```bash
   adb shell pm list packages | grep -i skip
   ```
   Put the real package in `SkipSelectors.kt`, the `<queries>` block and
   `android:packageNames` in `AndroidManifest.xml` / `accessibility_service_config.xml`.

2. **Discover the real UI selectors.** Open the Skip courier app on the Open
   Shifts page, then:
   ```bash
   adb shell uiautomator dump && adb pull /sdcard/window_dump.xml
   ```
   Read `window_dump.xml` and fill in `SkipSelectors.ViewIds` / `Texts` with the
   real `resource-id` and `text` values. **This is the only file you should need
   to touch** to get scanning/claiming working.

3. **Grant permissions on the device**
   - Settings → Accessibility → SmartCourier → **On**
   - Allow notifications when prompted
   - (Optional) Settings → Notification access → SmartCourier, to enable the
     early-scan listener.

4. In the app: Apps → Skip The Dishes → Shift Grabber → set preferences →
   **Start Monitoring**. Watch the **Logs** tab — every scan/refresh/match is
   logged there, which is how you'll debug selector accuracy.

---

## How it works (data flow)

```
ShiftGrabberScreen ──startMonitoring(prefs)──> BridgeService ──> ShiftGrabberModule (Kotlin)
                                                                      │
                                                          sets prefs in ShiftGrabber (coordinator)
                                                                      │
                                                          starts ForegroundService
                                                                      │
ForegroundService loop (every refreshIntervalSec):                    │
  bring Skip to front ─> SkipAccessibilityService.runCycle(prefs) ─> scan + match + tap claim
                      └> .refresh() (scroll or swipe)                  │
                                                                      │
  results ──ShiftGrabber.emit()──> DeviceEventEmitter ──> useNativeBridge ──> stores + Logs + Notifee
```

`BridgeService` is defensive: if the native module isn't built yet, the JS app
still runs (methods no-op with a dev warning), so you can iterate on the UI in
Metro before the Android build exists.

---

## Known stubs / next steps

- `SkipSelectors.kt` values are placeholders — **must** be filled from a real
  device dump (step 2 above).
- `NodeParser` zone extraction matches against the card's raw text; once the real
  card layout is known, parse `zone` into its own field for stricter matching.
- Battery: aggressive OEM battery managers (Samsung, Xiaomi) may kill the
  foreground service. Add SmartCourier to the "don't optimize" list on the phone.
- Feature 2 (app-selector dashboard) is done: the Home screen shows overall
  monitoring status, a session grab count, an accessibility gate, a quick
  start/stop, and live per-app status. Other apps remain disabled placeholders.
```
