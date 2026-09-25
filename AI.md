# StoryNest AI Memory & Migration Tracker

**Last updated:** 2026-09-25  
**Repo:** https://github.com/BrnEzekiel/StoryNest

## Stack
Mobile Expo · Web Next.js 15 + Tailwind · Express + BullMQ · Prisma/Postgres · JWT

## Web routes
`/` `/explore` `/library` `/feed` `/streaks` `/settings` `/users/[id]` `/stories/[id]` `/studio/*` `/admin` `/login` `/signup`

## Phases 0–4 (summary)

| Area | Status |
|------|--------|
| BullMQ email + content workers | Done |
| Due-chapter scanner (5 min) | Done |
| Web reader, library, studio, admin | Done |
| Comments, follow, activity feed | Done |
| Streaks + goals | Done |
| **Weekly digest batch** (`run-digest-batch`, Sun 09:00 UTC) | Done |
| **Settings** `/settings` notifications toggle | Done |
| OTP auth parity on web | Open |
| TipTap / Cloudinary multipart | Open |
| Nest Plus / Stripe | Open |
| Production CORS + Vercel | Open |

## Digest how-to
1. Redis + `npm run worker` running
2. Users with `notificationsOn: true` (toggle in `/settings`)
3. Cron enqueues one `digest` job per user with recent stories
4. Manual test: `node -e "require('./apps/backend/queues').enqueueDigestBatch().then(()=>process.exit())"` from backend cwd with env loaded

## Next
1. `git pull && npm install`
2. Toggle digests on `/settings`
3. Optional: **auth OTP**, **Stripe Nest Plus**, or production deploy
