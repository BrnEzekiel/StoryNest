# StoryNest production (Firebase + Render)

You use **Firebase** for app identity / optional web hosting — **not Vercel**.

## Stack in production

| Layer | Where |
|--------|--------|
| **API** | Render → `https://storynest-qzwm.onrender.com` |
| **Auth (mobile)** | Firebase Auth (`storynest-12345`) |
| **Web frontend** | Firebase Hosting *or* Firebase App Hosting |
| **Mobile** | Expo / EAS APK |
| **DB** | Postgres (via `DATABASE_URL` on Render) |
| **Queues** | Redis + BullMQ on Render |

---

## 1. API (already live)

```text
https://storynest-qzwm.onrender.com/health
```

→ `status: ok`, version 3.8.0

### Render CORS (required for web)

```env
CORS_ORIGINS=http://localhost:3000,https://storynest-12345.web.app,https://storynest-12345.firebaseapp.com
FRONTEND_URL=https://storynest-12345.web.app
```

Add any custom Firebase domain you attach later.

---

## 2. Firebase project

- Project id: **`storynest-12345`** (see `.firebaserc`)
- Mobile already uses Firebase Auth + `google-services.json`

---

## 3. Web deploy options

### Option A — Firebase **App Hosting** (recommended for full Next.js)

Keeps `/api/paystack` and `/api/cloudinary` server routes.

1. [Firebase console](https://console.firebase.google.com/) → App Hosting  
2. Connect GitHub `BrnEzekiel/StoryNest`  
3. Root / app directory: `apps/web`  
4. Env:
   ```env
   NEXT_PUBLIC_API_URL=https://storynest-qzwm.onrender.com
   PAYSTACK_SECRET_KEY=...
   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=...
   CLOUDINARY_*=...
   ```
5. Deploy

### Option B — Firebase **Hosting** static export

Good for a simple marketing/read UI **without** Next server routes.

```bash
cd apps/web
# set API URL for build
export NEXT_PUBLIC_API_URL=https://storynest-qzwm.onrender.com
export STORYNEST_STATIC_EXPORT=1
npm install
npm run build
cd ../..
npx firebase-tools login
npx firebase-tools deploy --only hosting
```

Output goes to `apps/web/out` (see `firebase.json`).

**Note:** Static export cannot run Paystack/Cloudinary **server** routes. Those need Option A or keep them on Render only.

---

## 4. Mobile APK

```bash
cd apps/mobile && npm install
npx eas-cli build -p android --profile preview
```

`EXPO_PUBLIC_API_URL` is already `https://storynest-qzwm.onrender.com` in `eas.json`.

---

## 5. Client env summary

```env
# Web + Mobile
NEXT_PUBLIC_API_URL=https://storynest-qzwm.onrender.com
EXPO_PUBLIC_API_URL=https://storynest-qzwm.onrender.com

# Firebase (mobile already configured)
# EXPO_PUBLIC_FIREBASE_* as in firebaseConfig.ts
```

---

## Substance Phase A (code)

Tabs: **Home · Read · Podcasts · Chat · Activity**

Phases B–D still open (Subscribe polish, real podcasts, monetization depth).
