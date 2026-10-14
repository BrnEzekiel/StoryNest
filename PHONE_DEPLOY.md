# Deploy without a PC (phone only)

CORS is done. Code is on `main`. What’s left needs **one-time secrets** in GitHub (phone browser is fine). I cannot log into your Firebase or Expo as you.

## 1. API (already live)

`https://storynest-qzwm.onrender.com/health`  
Should return `status: ok` (wait up to ~60s if the free instance was asleep).

## 2. Firebase web deploy via GitHub Actions

### A. Create a Firebase service account JSON (phone)

1. Open [Firebase Console](https://console.firebase.google.com/) → project **storynest-12345**
2. Project settings → **Service accounts** → **Generate new private key**
3. Download the JSON (save somewhere safe)

### B. Add GitHub secret (phone)

1. Open: https://github.com/BrnEzekiel/StoryNest/settings/secrets/actions
2. **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT_STORYNEST`
   - Value: paste the **entire** JSON file contents
3. Optional secret: `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` = your Paystack public key
4. Optional variable (Settings → Variables): `NEXT_PUBLIC_API_URL` = `https://storynest-qzwm.onrender.com`

### C. Run the workflow

1. https://github.com/BrnEzekiel/StoryNest/actions
2. **Deploy Web (Firebase Hosting)** → **Run workflow** → branch `main`

When green, site is usually:

- https://storynest-12345.web.app  
- https://storynest-12345.firebaseapp.com  

## 3. Android APK via EAS (phone)

### A. Expo token

1. https://expo.dev → account → **Access tokens** → create token  
2. GitHub secret name: `EXPO_TOKEN`  value: that token

### B. Run workflow

1. Actions → **EAS Android APK** → **Run workflow**  
2. Build runs on Expo’s servers. When finished, open https://expo.dev → your project → Builds → download APK.

`eas.json` already points at `https://storynest-qzwm.onrender.com`.

## 4. After web is live

Confirm Render `CORS_ORIGINS` includes:

```text
https://storynest-12345.web.app,https://storynest-12345.firebaseapp.com
```

(You said this is already done.)

## What I already did for you

- Full app features on `main` (Phases A–D)
- Correct API URL everywhere
- GitHub Actions workflows above
- No PC required for builds once secrets exist

## What is impossible without your login

Firebase and Expo refuse deploys without **your** credentials. Adding the two secrets above is the only step left that requires you.
