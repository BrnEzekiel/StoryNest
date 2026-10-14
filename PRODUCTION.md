# StoryNest production

## Live API

`https://storynest-qzwm.onrender.com`

## Web

Firebase project `storynest-12345`  
Deploy without PC: see **PHONE_DEPLOY.md** (GitHub Actions + `FIREBASE_SERVICE_ACCOUNT_STORYNEST`).

## Mobile APK

GitHub Actions **EAS Android APK** + secret `EXPO_TOKEN` (see PHONE_DEPLOY.md).

## CORS

Include Firebase origins on Render. User-confirmed added.

## Clients

```
NEXT_PUBLIC_API_URL=https://storynest-qzwm.onrender.com
EXPO_PUBLIC_API_URL=https://storynest-qzwm.onrender.com
```
