# StoryNest AI Memory & Migration Tracker

**Last updated:** 2026-09-25  
**Repo:** https://github.com/BrnEzekiel/StoryNest

## Stack
Mobile Expo · Web Next.js 15 + Tailwind · Express + BullMQ · Prisma/Postgres · JWT

## Web routes
`/` `/explore` `/library` `/feed` `/streaks` `/users/[id]` `/stories/[id]` (reader + comments) `/studio/*` `/admin` `/login` `/signup`

## Phases

### 0–3
- [x] BullMQ email + content queues; web skeleton; reader/library; studio/admin
- [x] Due-chapter scanner every 5 min
- [ ] OTP auth parity; TipTap; Cloudinary multipart; deploy CORS

### 4 Engagement
- [x] `/streaks` goals
- [x] Digest + new-chapter email job types
- [x] Reader comments (nested)
- [x] **Activity feed** `/feed` (`GET /activity/feed`)
- [x] **User profile + follow** `/users/[id]` (`GET /users/:id/profile`, `POST /users/:id/follow`)
- [ ] Digest cron for notificationsOn users
- [ ] Nest Plus / Stripe

## Next
1. `git pull && npm install && npm run web`
2. Sign in → `/feed` → open a user → Follow
3. Optional: auth OTP, digests cron, or Stripe
