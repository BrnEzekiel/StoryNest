# StoryNest AI Memory & Migration Tracker

> **Purpose:** This file is the single source of truth for the ongoing migration and feature work.
> Any AI model (or human) continuing this project should read this file first.
> When a task is completed, mark it with `[x]`. Keep notes of important decisions and blockers under each phase.

**Last updated:** 2026-09-25  
**Repository:** https://github.com/BrnEzekiel/StoryNest  
**Owner:** BrnEzekiel (Brian Onyango Ezekiel)

---

## 1. Project Snapshot (Current State)

### What StoryNest is
Premium long-form reading + writing platform. Focus: high-quality storytelling, sophisticated aesthetics, gamification (streaks), and social interaction.

**Brand**
- Voice: Warm, inviting, professional (“the Nest for imagination”)
- Colors: Deep Forest Green + Warm Cream
- Anti-references: Generic SaaS dashboards, loud neon, cluttered news feeds

### Current Tech Stack (already in the repo)
| Layer        | Technology                                      |
|--------------|-------------------------------------------------|
| Mobile       | React Native (Expo) + TypeScript                |
| Web          | **Next.js 15 App Router + Tailwind**            |
| Backend      | Node.js + Express.js + **BullMQ** (email + content queues) |
| Database     | PostgreSQL + Prisma ORM                         |
| Auth         | JWT (Access + Refresh Tokens)                   |
| Storage      | Cloudinary (cover images)                       |
| Email        | Gmail REST API via google-auth-library          |
| Queues       | BullMQ + Redis                                  |
| Monorepo     | npm workspaces (`apps/*`, `packages/*`)         |

**Key paths**
- `apps/mobile` — Expo app
- `apps/web` — Next.js web (reader + **Creator Studio** + admin)
- `apps/backend` — Express + BullMQ workers
- Root scripts: `backend`, `worker`, `web`, `mobile`

**Web surfaces**
- Reader (themes, progress, bookmarks), Explore, Library
- **Studio**: dashboard, new/edit story, chapters + schedule, analytics
- **Admin**: stats overview, flagged list, catalog
- Auth pages (OTP parity still deferred)

---

## 2. Target Stack (Migration Goal)

Same as before: Next.js + Tailwind + Express + JWT + BullMQ + Prisma + Cloudinary.

---

## 3. Migration Phases & Checklist

### Phase 0 — Foundation (Redis + BullMQ)
- [x] bullmq + ioredis, queues/, workers/, REDIS_URL, welcome email job
- [x] Recovery packaging for full backend entry
- [ ] Prove e2e on host with Redis

### Phase 1 — Next.js Web Skeleton
- [x] apps/web scaffold, brand, API client, login/signup, shell, basic pages
- [ ] CORS for production web origin; Vercel deploy
- [ ] Auth OTP parity (deferred)

### Phase 2 — Core Reader & Library
- [x] Reader themes/font/progress/chapters/bookmarks
- [x] Library + Explore search/genre + skeletons
- [ ] Offline SW (optional)

### Phase 3 — Author & Admin Surfaces (Web)
**Goal:** Powerful web tools for authors and admins.

- [x] Author dashboard (`/studio`) — my-stories, stats, delete
- [x] Story create/edit (`/studio/new`, `/studio/[id]/edit`) — textarea editor (TipTap optional later)
- [x] Cover via URL field (Cloudinary paste; multipart upload later)
- [x] Chapter manager (`/studio/[id]/chapters`) — CRUD + datetime schedule
- [x] Author analytics (`/studio/analytics`) — `/admin/analytics`
- [x] Admin overview (`/admin`) — stats, flagged, catalog
- [x] Content queue scaffold: `queues/contentQueue.js`, `workers/contentWorker.js` (`publish-story`, `process-cover`)
- [ ] Wire `enqueueScheduledPublish` into Express chapter save (needs modular index or patch)
- [ ] TipTap rich text
- [ ] Direct Cloudinary upload from web
- [ ] Full user moderation API surface (if backend adds routes)

**BullMQ jobs**
- [x] `publish-story` (delayed) — worker stub logs; Prisma update TODO
- [x] `process-cover` — worker stub
- [ ] `send-author-notification`
- [ ] `generate-story-stats` (periodic)

**Notes / Decisions:**
- Studio uses same endpoints as mobile AdminScreen: `/admin/my-stories`, `/admin/stats`, `/admin/analytics`, `POST/PUT/DELETE /stories`, chapter CRUD.
- Editor is polished textarea (serif body), not TipTap yet — fewer deps, shippable now.
- Header nav links: Explore, Library, Studio, Admin.

### Phase 4 — Engagement, Social & Personalization
- [ ] Digests, streaks dashboard, AI recs, comments polish, Nest Plus, etc.

---

## 4–9. (See prior sections in git history for catalog, decisions, cadence, reuse, docs.)

---

## 10. Immediate Next Action

1. **Owner:** `git pull origin main && npm install`
2. Run `npm run backend` + `npm run worker:dev` + `npm run web`
3. Sign in → **Studio** → New story → Chapters (optional schedule) → Analytics
4. Next: wire scheduled publish into API on chapter save, or **revisit auth**, or Phase 4 digests

---

*Update checkboxes as work is completed.*
