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
- Finished lessons reopen in **review**: full history, previous diagrams, and a
  composer for follow-up questions. No Next button or new grading in review.
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

## Cloudflare Worker URL in Settings

The default Worker URL is baked into the APK at build time from `.env.local`.
On the device, open the gear → **Cloudflare Worker URL**:

- The current default is prefilled.
- You can paste a different Worker URL and tap **Test connection**.
- **Use default** restores the baked-in URL.
- The change is stored on that device only.

This lets you change the Cloudflare worker without rebuilding the APK.

The default in the published build points at your current Worker. If you share
the APK with someone else, they will use your Worker until they change it in
Settings — and that means your Go allowance. Change `ALLOWED_ORIGIN` on the
Worker and use separate Worker URLs if you distribute it widely.

---

## Release signing

This repo is set up for signed release builds.

Local signing material (kept outside git):

```text
/home/jeevankumar/.cove-android/cove-release.jks
/home/jeevankumar/.cove-android/RELEASE-CREDENTIALS.txt
android/keystore.properties        (ignored)
```

`android/app/build.gradle` reads `android/keystore.properties` and signs the
release build with that keystore.

Current version:

```text
versionCode 2
versionName 1.0.1
package com.lroe.cove
```

Build release artifacts:

```bash
npm run cap:sync
cd android
./gradlew assembleRelease bundleRelease
```

Outputs:

```text
android/app/build/outputs/apk/release/app-release.apk
android/app/build/outputs/bundle/release/app-release.aab
```

Verify the APK signature:

```bash
$ANDROID_HOME/build-tools/36.1.0/apksigner verify --print-certs \
  android/app/build/outputs/apk/release/app-release.apk
```

Back up the keystore and credentials file somewhere safe. If you lose them, you
cannot update the app with the same signing identity.

### Installing release over debug

The debug APK and release APK use different signing keys. Android will refuse to
install one over the other. To move a phone from debug to release, uninstall the
debug app first, which removes its local notes and progress. Keep the original
PDF/PPTX files so they can be uploaded again.

### Play Store

The `.aab` is the Play Store upload format. Publishing there requires a Google
Play developer account, store listing, privacy policy, and data-safety form.
The signed `.apk` is fine for direct sharing and sideloading.

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
