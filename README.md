# Cove Android

The Android app for **Cove**, built with Capacitor around the same React web
app. It is a separate repository from the iPhone/PWA version so the two can
ship independently.

The app is a native Android shell with the Cove UI running locally in a
WebView. There is no Android server and no hosted web app required.

---

## What it supports

- Upload **PDF** and **PowerPoint `.pptx`** notes through Android’s document
  picker.
- Smart titles from the document or first slide, rename from the note page.
- The same lessons, ElI5 + textbook mode, learning modes, chat style overrides,
  progress, delete, and hide-concepts controls as the web app.
- Local storage in the WebView (IndexedDB + localStorage). Notes and PDFs stay
  on the phone.
- OpenCode Go through the Cloudflare Worker, or Gemini directly, configured in
  the app’s Settings.

The app is portrait-only and dark by default.

---

## Requirements

- Node.js 20.19+
- JDK **21** (Capacitor 8 requires Java 21)
- Android SDK with platform **36**, build-tools 36, and platform-tools
- `adb` for USB installs
- An Android phone with USB debugging enabled, or the Android emulator

This machine’s local setup used:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="$HOME/.local/jdk21"
```

`JAVA_HOME` must point to a full JDK 21, not just a JRE. `javac` must exist.

---

## First setup

```bash
cd /home/jeevankumar/Videos/tutor-android
npm install
cp .env.example .env.local
# edit .env.local and set VITE_COVE_PROXY_URL
```

`.env.local` is ignored by git. It should contain the Cloudflare Worker URL:

```text
VITE_COVE_PROXY_URL=https://cove-proxy.your-subdomain.workers.dev
```

If it is empty, the app still works — paste the Worker URL from the gear on the
home screen after installing.

Then:

```bash
npm run android:build
```

This generates the web assets, copies them into the Android project, and builds
a debug APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or open the app directly:

```bash
adb shell monkey -p com.lroe.cove -c android.intent.category.LAUNCHER 1
```

---

## Development workflow

After changing web code:

```bash
npm run cap:sync
```

Then rebuild the APK:

```bash
cd android
./gradlew assembleDebug
```

Or use the one-liner from the repo root:

```bash
npm run android:build
```

For a live-reload workflow, Capacitor can point the WebView at the Vite dev
server, but that requires the phone and computer to be on the same network. The
static build is simpler for ordinary testing.

### Useful device commands

```bash
adb devices
adb logcat | grep -E 'Capacitor|chromium|Cove'
adb shell am force-stop com.lroe.cove
```

Debug builds enable Chrome WebView debugging. With the phone connected, open
`chrome://inspect` on the computer to inspect the WebView.

---

## App identity

- Application ID: `com.lroe.cove`
- App name: `Cove`
- Theme: dark, `#212121`
- Portrait only
- Icons and splash generated from `assets/icon.svg` with
  `@capacitor/assets`

If you want a different application ID, change it in:

- `capacitor.config.ts`
- `android/app/build.gradle`
- `android/app/src/main/java/.../MainActivity.java` package
- `android/app/src/main/res/values/strings.xml`

---

## Worker CORS

The Android WebView serves the app from:

```text
https://localhost
```

The Cloudflare Worker currently allows all origins (`*`), so this works. If you
lock `ALLOWED_ORIGIN` down to your PWA domain, add the Android origin too:

```text
https://your-site.netlify.app,https://localhost
```

For a future iOS Capacitor build, the origin is typically
`capacitor://localhost`.

---

## Data and privacy

- Notes, page/slide images, figures, chats, and progress live in the WebView
  storage on the phone.
- The original PDF/PPTX stays on the phone.
- Text, page images, and chat messages are sent to OpenCode Go or Gemini only
  when a lesson or chat calls the model.
- Clearing app storage removes all notes and progress. Keep the original files
  in Files/Drive.
- This is a study aid, not clinical advice.

---

## Debug vs release

The current APK is a **debug** build. It is fine for personal USB installs and
testing, but not for distributing through Play Store.

For a release build later:

1. Create a keystore (do not commit it):

   ```bash
   keytool -genkeypair -v \
     -keystore ~/cove-release.jks \
     -alias cove \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Add a `keystore.properties` outside git with the passwords and path.
3. Configure `signingConfigs.release` in `android/app/build.gradle`.
4. Run:

   ```bash
   cd android
   ./gradlew bundleRelease
   ```

Keep the keystore backed up. Losing it means you cannot update the same Play
Store listing.

---

## Project layout

```text
src/                    React app shared with the PWA version
public/                 PWA icons/favicon
assets/icon.svg         Android icon source
capacitor.config.ts     Capacitor app ID, name, splash/status bar config
android/                Native Android project
sample/                 Sample PDF and PPTX notes for testing
worker/                 Cloudflare Worker proxy source (reference)
```

The web app source is kept close to the iPhone/PWA version. Android-only changes
are intentionally small:

- `src/main.tsx` skips service-worker registration in native builds, handles
  the Android back button, and sets the status bar.
- `capacitor.config.ts` defines the native shell.
- `android/` holds the generated project, theme, icons, and splash.

---

## iPhone

This repository is Android-only. The iPhone version remains the PWA, or can be
packaged later with Capacitor iOS on a Mac. Capacitor iOS requires Xcode; it
cannot be built on this Linux machine.

---

## Repository

https://github.com/lroe/tutor-android
