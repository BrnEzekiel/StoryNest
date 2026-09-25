# StoryNest AI Memory & Migration Tracker

**Last updated:** 2026-09-25  
**Repo:** https://github.com/BrnEzekiel/StoryNest

## Stack
Mobile Expo · Web Next.js 15 + Tailwind · Express + BullMQ · Prisma/Postgres · JWT

## Web routes
`/` `/explore` `/library` `/streaks` `/stories/[id]` (reader + **comments**) `/studio/*` `/admin` `/login` `/signup`

## Phases

### 0 BullMQ
- [x] Email + content queues/workers, REDIS_URL
- [ ] Deploy e2e with Redis

### 1 Web skeleton
- [x] apps/web scaffold, brand, API client
- [ ] OTP auth parity; production CORS/Vercel

### 2 Reader & library
- [x] Themes, progress, bookmarks, search, skeletons

### 3 Studio & admin
- [x] Studio CRUD, chapters + schedule UI, analytics, admin overview
- [x] Content worker Prisma publish; **scan-due-chapters every 5 min**
- [ ] TipTap; Cloudinary multipart; enqueue on save from packed index

### 4 Engagement
- [x] `/streaks` goals dashboard
- [x] Digest + new-chapter email job types
- [x] **Reader comments** (nested reply UI, `/stories/:id/comments`)
- [ ] Digest cron for users with notificationsOn
- [ ] Follows / activity feed on web
- [ ] Nest Plus / Stripe

## Next actions
1. `git pull && npm install`
2. Open a story → scroll to **Discussion**
3. Optional: auth OTP, follows, or unpack backend index for direct `enqueueScheduledPublish` on chapter save
