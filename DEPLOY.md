# Deploy guide — Firebase + Render

> Prefer **PRODUCTION.md**. This file replaces older Vercel-centric notes.

## API (Render)

- URL: `https://storynest-qzwm.onrender.com`
- Set `CORS_ORIGINS` to your Firebase web origins + `http://localhost:3000`

## Web (Firebase)

Project: `storynest-12345`

### App Hosting (full Next.js)

Connect GitHub → directory `apps/web` → env `NEXT_PUBLIC_API_URL=https://storynest-qzwm.onrender.com`

### Static Hosting

```bash
cd apps/web
STORYNEST_STATIC_EXPORT=1 NEXT_PUBLIC_API_URL=https://storynest-qzwm.onrender.com npm run build
cd ../..
firebase deploy --only hosting
```

## Mobile

```bash
cd apps/mobile
npx eas-cli build -p android --profile preview
```
