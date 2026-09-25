# StoryNest AI Memory & Migration Tracker

**Last updated:** 2026-09-25  
**Repository:** https://github.com/BrnEzekiel/StoryNest  
**Owner:** BrnEzekiel

---

## Snapshot

| Layer | Stack |
|-------|--------|
| Mobile | Expo + TypeScript |
| Web | Next.js 15 + Tailwind (reader, studio, admin, streaks) |
| Backend | Express + BullMQ (email + content queues) |
| DB | PostgreSQL + Prisma |
| Auth | JWT (web OTP parity deferred) |

**Web routes:** `/` `/explore` `/library` `/streaks` `/stories/[id]` `/studio/*` `/admin` `/login` `/signup`

---

## Phases

### Phase 0 — BullMQ foundation
- [x] queues, workers, REDIS_URL, welcome email
- [ ] E2E prove on deploy host with Redis

### Phase 1 — Web skeleton
- [x] apps/web, brand, API client, shell, auth pages (basic)
- [ ] Production CORS + Vercel; OTP signup parity

### Phase 2 — Reader & library
- [x] Themes, font, progress, chapters, bookmarks, search, skeletons

### Phase 3 — Author & admin
- [x] `/studio` dashboard, new/edit story, chapters + schedule UI, analytics, `/admin`
- [x] Content queue + worker (Prisma publish on `publish-story` job)
- [ ] Call `enqueueScheduledPublish` from Express chapter save (index still base64-packed)
- [ ] TipTap + direct Cloudinary upload

### Phase 4 — Engagement (in progress)
- [x] Streaks & goals page (`/streaks`) — `/users/me`, daily goal preference
- [x] Digest + new-chapter email job types in email queue/worker
- [ ] Cron/scheduler to enqueue digests for users with notificationsOn
- [ ] Comments UI on web reader
- [ ] Follow / activity feed on web
- [ ] Nest Plus / Stripe checkout

---

## Immediate next

1. `git pull && npm install`
2. Test `/streaks` while logged in
3. Optionally: auth OTP on web, or comments on reader, or wire chapter schedule → `enqueueScheduledPublish` after unpacking backend index

---

*Hand-off: read this file first; tick boxes when done.*
