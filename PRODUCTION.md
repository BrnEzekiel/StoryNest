# StoryNest production status (2026-09-28)

## Live API

| Item | Value |
|------|--------|
| **Public URL** | `https://storynest-qzwm.onrender.com` |
| **Health** | `GET /health` → `status: ok`, v3.8.0, `social_master_v3_stable`, BullMQ on |
| **Service** | Render free · `srv-d8djri4m0tmc73e1e1tg` · branch `main` |
| **Cold start** | Free tier may sleep; first request 30–60s |

**Wrong host (do not use):** `https://storynest.onrender.com`

### Render env (recommended)

```env
CORS_ORIGINS=http://localhost:3000,https://*.vercel.app
FRONTEND_URL=https://YOUR-VERCEL-URL
DATABASE_URL=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
REDIS_URL=...
```

### Clients

```env
NEXT_PUBLIC_API_URL=https://storynest-qzwm.onrender.com
EXPO_PUBLIC_API_URL=https://storynest-qzwm.onrender.com
```

Already set in `apps/mobile/eas.json` and web/mobile API defaults.

## Substance Phase A (shipped in repo)

Mobile bottom tabs aligned to product target:

1. **Home** — discovery feed / stories  
2. **Read** — explore / library hub  
3. **Podcasts** — placeholder (Phase C)  
4. **Chat** — existing Messages  
5. **Activity** — social activity feed (tab, not only stack)

## Deploy checklist

### Web (Vercel)

1. Import `BrnEzekiel/StoryNest`
2. Root directory: `apps/web`
3. Env: `NEXT_PUBLIC_API_URL`, Paystack, Cloudinary
4. Deploy production
5. Add Vercel URL to Render `CORS_ORIGINS`

### Mobile APK

```bash
cd apps/mobile && npm install
npx eas-cli build -p android --profile preview
```

API URL is baked from `eas.json`.

### Worker

Separate Render **Background Worker** with same env, start: `npm run worker --workspace=apps/backend` (or your worker script).

## Phases remaining

- **B** Subscribe UX, richer social posts, share cards  
- **C** Real podcasts + deeper chat  
- **D** Monetization polish (Paystack already on web)
