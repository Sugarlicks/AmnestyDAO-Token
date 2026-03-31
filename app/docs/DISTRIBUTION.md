# Distribution

## iOS

### TestFlight

1. **Set up your Apple developer environment**

* Sign up for an Apple Developer Program (paid)
* Install Xcode
* Log into Xcode (`Settings > Accounts`)
* Ensure:

  * Team is set
  * Bundle ID matches your app
  * Signing is configured

---

2. **Install dependencies (from `frontend/`)**

```
npm install
```

---

3. **Generate icons (one-time only)**

```
npm run generate:icons
```

---

4. **Build the frontend**

```
quasar build
```

---

5. **Sync Capacitor**

```
cd src-capacitor
npx cap sync ios
```

---

6. **Open in Xcode**

```
npx cap open ios
```

---

7. **Archive and upload**

* `Product > Archive`
* Upload via Organizer to App Store Connect

---

8. **Test via TestFlight**

* Add testers
* Verify the app works before production release

---

### Production (App Store Release)

9. **Prepare app listing in App Store Connect**

In App Store Connect:

* Add:

  * App name
  * Description
  * Keywords
  * Screenshots (required for all device sizes)
  * App icon
  * Privacy policy URL
* Complete:

  * App Privacy section
  * Age rating
  * Export compliance

---

10. **Create a new App Store version**

* Go to **App Store > New Version**
* Select the build you uploaded via Xcode
* Attach it to the version

---

11. **Submit for review**

* Click **Submit for Review**
* Apple will review the app (usually 1–3 days)

---

12. **Release the app**

Once approved, choose one:

* **Manual release** (recommended)
* Automatic release
* Scheduled release

App will go live on the App Store 🎉

---

## Android

### Internal Testing

1. **Set up your Android environment**

* Install Android Studio
* Install SDK + tools
* Configure environment variables if needed

---

2. **Install dependencies (from `frontend/`)**

```
npm install
```

---

3. **Generate icons (one-time only)**

```
npm run generate:icons
```

---

4. **Build the frontend**

```
quasar build
```

---

5. **Sync Capacitor**

```
cd src-capacitor
npx cap sync android
```

---

6. **Open in Android Studio**

```
npx cap open android
```

---

7. **Generate signed build**

* `Build > Generate Signed Bundle / APK`
* Use **.aab (recommended)**
* Create/store keystore securely

---

8. **Upload to internal testing**

* Go to Google Play Console
* Testing > Internal Testing
* Upload `.aab`
* Add testers

---

### Production (Play Store Release)

9. **Prepare store listing**

In Google Play Console:

* Add:

  * App name
  * Short + long description
  * Screenshots
  * App icon
  * Feature graphic
  * Privacy policy

---

10. **Complete required sections**

* App content:

  * Data safety form
  * Content rating
  * Target audience
* Store settings:

  * Pricing (free/paid)
  * Countries/regions

---

11. **Create a production release**

* Go to **Release > Production**
* Click **Create new release**
* Upload your `.aab`
* Add release notes

---

12. **Review and roll out**

* Click **Review release**
* Fix any warnings/errors
* Click **Start rollout to production**

---

13. **Release goes live**

* Usually within a few hours (can take longer for first release)
* You can:

  * Roll out gradually (percentage-based)
  * Release to all users immediately

---

## Notes

* iOS review is stricter and slower than Android
* First releases on both platforms take longer due to extra checks
* Always test via TestFlight / Internal Testing before production
* Keep:

  * Apple certificates safe
  * Android keystore safe (critical)
