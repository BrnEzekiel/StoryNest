# StoryNest production deploy

## Architecture

| Service | Suggested host | Notes |
|---------|----------------|--------|
| **Web** (Next.js) | [Vercel](https://vercel.com) | Root: `apps/web` |
| **API** (Express) | [Render](https://render.com) / Railway / Fly | `apps/backend` |
| **Worker** (BullMQ) | Same as API, second process | `npm run worker` |
| **Postgres** | Neon / Supabase / Render Postgres | `DATABASE_URL` |
| **Redis** | Upstash / Render Redis | `REDIS_URL` (use `rediss://` if TLS) |

```
[Browser] → Vercel (web + /api/paystack + /api/cloudinary)
                ↓ NEXT_PUBLIC_API_URL
            Render API :5000
                ↓ REDIS_URL
            Worker process (email + content queues)
                ↓ DATABASE_URL
            Postgres
```

---

## 1. Database & Redis

1. Create Postgres → copy `DATABASE_URL`
2. Run migrations from monorepo root:
   ```bash
   npm install
   npx prisma db push --schema=packages/db/prisma/schema.prisma
   ```
3. Create Redis → copy `REDIS_URL`

---

## 2. Backend (API + worker)

### Environment (API service)

```env
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=long-random
JWT_REFRESH_SECRET=long-random
REDIS_URL=rediss://...

# CORS — comma-separated web origins (required for browser)
CORS_ORIGINS=https://your-app.vercel.app,https://www.yourdomain.com
FRONTEND_URL=https://your-app.vercel.app

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
SMTP_USER=

# Optional
SLACK_WEBHOOK_URL=
FIREBASE_PROJECT_ID=
```

### Start commands

- **API:** `npm run start --workspace=apps/backend` (or `node apps/backend/index.js`)
- **Worker (separate service/process):** `npm run worker --workspace=apps/backend`

Both need the same `DATABASE_URL` and `REDIS_URL`.

### CORS note

The packed Express app should honor `CORS_ORIGINS` / `FRONTEND_URL` if already wired. If the browser still blocks requests:

1. Confirm `Access-Control-Allow-Origin` includes your Vercel URL
2. Allow methods `GET,POST,PUT,DELETE,OPTIONS` and header `Authorization`
3. Temporary debug: set `CORS_ORIGINS=*` only on a staging API (not ideal for credentials)

If CORS is hard-coded to localhost inside the packed `index`, unpack/patch per `PHASE0_INDEX_PATCH.md` and add:

```js
const origins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));
```

---

## 3. Web (Vercel)

### Project settings

- **Root Directory:** `apps/web`
- **Framework:** Next.js
- **Install:** `npm install` (from monorepo you may need `cd ../.. && npm install` — or deploy web as standalone with its own lockfile)

Recommended: set Root Directory to `apps/web` and enable monorepo install from repo root if Vercel asks.

### Environment variables (Vercel → Settings → Environment Variables)

```env
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
API_URL=https://your-api.onrender.com

# Paystack (server secret never NEXT_PUBLIC_)
PAYSTACK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
NEST_PLUS_AMOUNT=1000000
NEST_PLUS_CURRENCY=NGN

# Cloudinary (cover uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=storynest/covers
```

### Paystack callback

In Paystack dashboard, allow your production domain. Checkout uses `callback_url` = `https://your-app.vercel.app/plus`.

### Deploy

```bash
# or connect the GitHub repo in Vercel UI and deploy main
cd apps/web && npx vercel --prod
```

`vercel.json` in `apps/web` sets the framework defaults.

---

## 4. Mobile

Point `EXPO_PUBLIC_API_URL` at the **same** production API URL. Rebuild with EAS.

---

## 5. Smoke test

1. `GET https://api…/health` → 200  
2. Web login / OTP signup  
3. Explore stories  
4. Studio: upload cover + TipTap chapter  
5. `/plus` Paystack test (use test keys first)  
6. Worker logs: digest scheduler + due-chapter scanner  

---

## 6. Security checklist

- [ ] Rotate any keys ever pasted in chat (Paystack live keys)
- [ ] Secrets only in host env, not in git
- [ ] `JWT_*` secrets long and unique per environment
- [ ] CORS limited to real web origins
- [ ] Redis/Postgres not publicly writable without auth

---

## Quick local prod-like run

```bash
git pull
npm install
# fill apps/backend/.env and apps/web/.env.local
npm run backend
npm run worker
npm run web
```
