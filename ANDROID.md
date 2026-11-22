# Color Quest for Android

The Android app is the same game (`index.html`) wrapped with [Capacitor](https://capacitorjs.com). Ads (Google AdMob) exist **only** in the Android app; the website / PWA never shows ads.

## 1. Get an installable APK (no Android Studio needed)

1. Push to `main` (or open **Actions → Android build → Run workflow**).
2. When the run finishes, open it and download the **color-quest-debug-apk** artifact.
3. Unzip, copy `app-debug.apk` to your phone and install it (allow "install unknown apps" once).

The debug build uses Google's **test** ads, so you can try rewarded and interstitial ads safely.

## 2. Set up AdMob (before publishing)

1. In AdMob: **Apps → Add app → Android**. Package name: `com.siddiqur.colorquest`.
2. Copy the **App ID** (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`) into
   `android/app/src/main/AndroidManifest.xml` (the `com.google.android.gms.ads.APPLICATION_ID` meta-data).
3. Create two ad units and copy their IDs into `ADS_CONFIG` in `index.html`:
   - **Rewarded** → `rewardedId`
   - **Interstitial** → `interstitialId`
4. In the same `ADS_CONFIG`, change `testing: true` to `testing: false`.
5. Put an `app-ads.txt` file at the root of your website (`https://siddiqur.com/app-ads.txt`), using the line AdMob shows you
   (it looks like `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`), and set the same website as the developer
   website in your Play Console store listing. AdMob uses it to verify the app.
6. In AdMob → **Privacy & messaging**, create a GDPR message (EEA/UK consent). The app already calls Google's consent tool and
   shows an "Ad privacy choices" button in Settings when it is required.

**Never tap your own live ads** and keep `testing: true` while developing; either can get the AdMob account limited.

Where ads appear: rewarded ads only when the player chooses them (shop, "Double coins" after a win, or when out of coins for a
hint / extra bottle). An interstitial can appear between Endless levels (every 4 levels, at most once per 2 minutes). The daily
puzzle never shows interstitials.

## 3. Sign the release build

Create an upload key once (keep the file and passwords safe, and back them up):

```
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload-keystore.jks     # macOS: base64 -i upload-keystore.jks
```

In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret | Value |
| --- | --- |
| `CQ_KEYSTORE_BASE64` | the base64 output above |
| `CQ_KEYSTORE_PASSWORD` | keystore password |
| `CQ_KEY_ALIAS` | `upload` |
| `CQ_KEY_PASSWORD` | key password |

Re-run the workflow; it now also produces **color-quest-release-aab** (a signed `.aab`). The version code is the workflow run
number, so every build is higher than the last one, as Google Play requires.

## 4. Publish on Google Play

1. Play Console → **Create app** (free, game). Enrol in **Play App Signing** when asked.
2. Store listing: 512x512 icon (`icons/icon-512.png`), a 1024x500 feature graphic, at least 2 phone screenshots, short and full description.
3. **Privacy policy URL**: `https://siddik-web.github.io/color-quest-pwa/privacy.html` (the file `privacy.html` in this repo).
4. App content: **Ads: Yes**; target audience **13+** (not designed for children); fill in the **Data safety** form
   (the app collects the advertising ID through AdMob; no accounts, no data sold by you) and the **advertising ID** declaration.
5. Upload the `.aab` to **Internal testing** first, install from the Play link, then promote to **Production**.

Accounts created after 13 Nov 2023 must run a closed test with 12 testers for 14 days first. Yours predates that, so you can go
through internal testing and straight to production.

## 5. Updating the app

Edit `index.html` (and the other web files), push to `main`, download the new `.aab` from the workflow, upload it as a new
release in Play Console. To build locally instead: `npm ci && npm run sync && cd android && ./gradlew bundleRelease`
(needs JDK 21 and the Android SDK).

## Notes

- Package name `com.siddiqur.colorquest` is permanent once uploaded to Play. Change it now if you want something else
  (`capacitor.config.json`, `android/app/build.gradle`, `strings.xml`, and the folder/package of `MainActivity.java`).
- Progress is saved on the device only (no accounts), so it is lost if the app is uninstalled.
