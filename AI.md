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
| Backend      | Node.js + Express.js + **BullMQ (in progress)** |
| Database     | PostgreSQL + Prisma ORM                         |
| Auth         | JWT (Access + Refresh Tokens)                   |
| Storage      | Cloudinary (cover images)                       |
| Email        | Gmail REST API via google-auth-library          |
| Queues       | BullMQ + Redis                                  |
| Other        | Firebase Admin, rate limiting, multer           |
| Monorepo     | npm workspaces (`apps/*`, `packages/*`)         |

**Key paths**
- `apps/mobile` — Expo app
- `apps/backend` — Express API (`index.js`, Prisma, config)
- `apps/backend/queues/` — BullMQ queues
- `apps/backend/workers/` — BullMQ workers entry
- Root `package.json` — workspaces + scripts (`backend`, `mobile`, `db:push`, `db:seed`)

**Existing features (mobile + API)**
- Auth (signup/login, JWT, Google auth path in progress)
- Home / Explore / Reader (themes, font size, progress)
- Bookmarks, reading history, streaks
- Admin panel (upload/edit/delete stories, role-based)
- Cloudinary uploads

---

## 2. Target Stack (Migration Goal)

| Piece                    | Role                                              |
|--------------------------|---------------------------------------------------|
| **Next.js** (App Router) | Web app + future admin/author dashboards          |
| **Tailwind CSS**         | Utility-first styling                             |
| **shadcn/ui**            | High-quality accessible components                |
| **Node.js + Express**    | Existing API (keep & extend)                      |
| **JWT**                  | Existing auth (keep; prefer httpOnly cookies on web) |
| **BullMQ + Redis**       | Async jobs (email, publish, media, digests, AI)   |
| **Prisma + PostgreSQL**  | Existing DB                                       |
| **Cloudinary**           | Existing media                                    |

### Target Architecture
```
apps/
  mobile/          ← existing Expo (keep evolving)
  web/             ← NEW Next.js + Tailwind + shadcn/ui
  backend/         ← existing Express + NEW BullMQ workers
packages/
  db/              ← Prisma (shared, optional extract)
  shared/          ← types/constants (optional)
```

---

## 3. Migration Phases & Checklist

### Phase 0 — Foundation (Redis + BullMQ)
**Goal:** Safe base for background jobs without breaking existing API.

- [x] Install `bullmq` + `ioredis` in `apps/backend` (`package.json` v1.2.0)
- [x] Create `apps/backend/queues/` (`connection.js`, `emailQueue.js`, `index.js`)
- [x] Create `apps/backend/workers/` (`emailWorker.js`, `index.js`)
- [x] Define queue names and config (`REDIS_URL` in `config.js` + `.env.example`)
- [x] Example job: welcome email (`enqueueWelcomeEmail` + worker handler)
- [x] Worker scripts: `npm run worker` / `npm run worker:dev`
- [x] Document recovery + wiring: `apps/backend/PHASE0_INDEX_PATCH.md`
- [ ] **BLOCKER:** Restore full `apps/backend/index.js` (was truncated during remote push)
  - Run: `git checkout 1c38922bcf7fd1dc857b2ffb78700fd3be0a7f11 -- apps/backend/index.js`
  - Then apply the 3 edits in `PHASE0_INDEX_PATCH.md`
- [ ] Prove end-to-end: Redis up + API + worker + `/queues/test-welcome`
- [ ] Backend still starts and existing routes work (after index restore)

**Notes / Decisions:**
- Workers run as a **separate process** from the API (`workers/index.js`).
- Email sending reuses existing `sendGmail` (Gmail REST API).
- Large-file push via GitHub API truncated `index.js`; recovery is local git checkout + small patch (documented).
- Do **not** deploy main until `index.js` is restored.

---

### Phase 1 — Next.js Web Skeleton
**Goal:** Working Next.js app that authenticates against the same Express API.

- [ ] Create `apps/web` with `create-next-app` (App Router, TypeScript, Tailwind, ESLint)
- [ ] Initialize shadcn/ui (`npx shadcn@latest init`)
- [ ] Map brand colors (Deep Forest Green + Warm Cream) into Tailwind theme + CSS variables
- [ ] Add core shadcn components (Button, Card, Input, Dialog, etc.)
- [ ] API client (fetch/axios) with Authorization + refresh-token handling
- [ ] Auth pages: Login / Signup / Logout (JWT; prefer httpOnly cookies for web)
- [ ] App shell: header, nav, theme toggle placeholder
- [ ] Basic pages: Home (featured), Explore, Story detail (read-only), Profile
- [ ] CORS on Express updated for web origin
- [ ] Root package.json scripts: `"web": "npm run dev --workspace=apps/web"`

**Notes / Decisions:**
- _None yet_

---

### Phase 2 — Core Reader & Library on Web
**Goal:** Reading parity with mobile for the most important flows.

- [ ] Story reader page (typography, Light / Sepia / Dark, font size, progress)
- [ ] Bookmarks & progress sync with existing backend endpoints
- [ ] Library / Continue reading (recently read, bookmarks, history)
- [ ] Search & filters (genre, completion status)
- [ ] Skeleton loaders / polished loading states
- [ ] (Optional later) Service worker / offline support

**BullMQ usage in this phase**
- [ ] Reading progress aggregation / streak calculation job
- [ ] “New chapter / story updated” email or push job

**Notes / Decisions:**
- _None yet_

---

### Phase 3 — Author & Admin Surfaces (Web)
**Goal:** Powerful web tools for authors and admins.

- [ ] Author dashboard (drafts, publish, scheduled publish, basic analytics)
- [ ] Story editor (rich text / Markdown — TipTap or similar + shadcn styling)
- [ ] Cover upload (existing Cloudinary flow)
- [ ] Optional BullMQ job: cover resize / WebP conversion
- [ ] Admin panel (user moderation, genre management, content flags)
- [ ] Scheduled publishing: Express enqueues delayed BullMQ job that publishes at the right time

**BullMQ jobs**
- [ ] `publish-story` (delayed)
- [ ] `process-cover`
- [ ] `send-author-notification`
- [ ] `generate-story-stats` (periodic)

**Notes / Decisions:**
- _None yet_

---

### Phase 4 — Engagement, Social & Personalization (Ongoing)
Pick from the existing roadmaps (`ROADMAP_IDEAL_APP.md`, `FUTURE_FEATURES.md`) and implement with the new stack.

**High-value candidates**
- [ ] AI recommendations (BullMQ background computation)
- [ ] Daily / weekly digest emails (BullMQ scheduled + Nodemailer)
- [ ] Reading goals & streaks dashboard (charts with shadcn + Recharts)
- [ ] Nested comments + mentions polish
- [ ] Follow authors + activity feed
- [ ] Highlights & notes
- [ ] Subscription / Nest Plus (Stripe + web checkout)
- [ ] Admin analytics dashboard

**Notes / Decisions:**
- _None yet_

---

## 4. BullMQ Starter Job Catalog

| Queue            | Example jobs                                      | Trigger                    |
|------------------|---------------------------------------------------|----------------------------|
| `email`          | Welcome, OTP, reset, digest, new-chapter          | Auth, publish, cron        |
| `notifications`  | Push (Firebase), in-app                           | Follows, comments, milestones |
| `media`          | Cover resize, WebP                                | Upload                     |
| `content`        | Scheduled publish, AI tagging/summary             | Admin / author actions     |
| `analytics`      | Daily aggregates, streak recalculation            | Cron / night job           |
| `moderation`     | Auto-flag toxic comments (future)                 | Comment create             |

Start with 2–3 queues and expand.

---

## 5. Technical Decisions (Lock Early)

| Topic              | Decision                                                                 |
|--------------------|--------------------------------------------------------------------------|
| Auth on web        | Prefer httpOnly secure cookies for access/refresh; keep Bearer JWT for mobile |
| API                | Same Express service; add web origin to CORS                             |
| Monorepo scripts   | Add `web` and worker scripts to root `package.json`                      |
| Deployment         | Backend + workers → Render/Railway/Fly; Web → Vercel; Redis → Upstash or managed |
| Design system      | Single Tailwind theme (brand tokens) shared conceptually with mobile     |
| Workers            | Separate process from API (`npm run worker`)                             |

---

## 6. Suggested 8–12 Week Cadence

| Week   | Focus                          | Deliverable                                      |
|--------|--------------------------------|--------------------------------------------------|
| 1–2    | Phase 0 + Phase 1              | Redis + BullMQ working; Next.js skeleton + auth + story list |
| 3–4    | Phase 2                        | Full web reader + library + progress sync        |
| 5–7    | Phase 3 (core)                 | Author editor + scheduled publish + basic admin  |
| 8–10   | Polish + 2–3 engagement features | Digests, streaks dashboard, or AI recommendations |
| 11–12  | Hardening                      | Monitoring, rate limits, Redis resilience, docs  |

---

## 7. What Can Be Reused Immediately

- Entire Express API (auth, stories, bookmarks, progress, admin)
- Prisma schema & PostgreSQL
- JWT logic
- Cloudinary uploads
- Gmail REST / Slack helpers in `config.js`
- Existing seed data
- Brand identity (Deep Forest Green + Warm Cream)

---

## 8. Key Existing Docs in Repo (Reference)

- `README.md` — current stack & setup
- `PRODUCT.md` — product strategy & brand
- `ROADMAP_IDEAL_APP.md` — 100+ ideal features
- `FUTURE_FEATURES.md` — 100 feature checklist
- `DESIGN.md` — design notes
- `implementation_plan.md` — Google Auth + Nodemailer work
- `apps/backend/PHASE0_INDEX_PATCH.md` — **restore index.js + BullMQ wiring**
- `walkthrough.md`, `IMPECCABLE_GUIDE.md`, etc.

---

## 9. How to Use This File

1. **Before starting any work** — read this entire file.
2. **When finishing a task** — change `- [ ]` to `- [x]` and add a short note under **Notes / Decisions** if something important was decided or blocked.
3. **When handing off to another AI or developer** — point them at this file + the repo URL.
4. **Keep the “Last updated” date current** when you make meaningful changes.

---

## 10. Immediate Next Action

1. **You (local):** Restore `apps/backend/index.js` per `PHASE0_INDEX_PATCH.md` and commit.
2. Start Redis, `npm install` in `apps/backend`, run API + worker, hit `/queues/test-welcome`.
3. After Phase 0 is green, start **Phase 1** (Next.js + Tailwind + shadcn skeleton).

---

*This file was created to preserve full context for the StoryNest migration to Next.js + Tailwind + shadcn/ui + BullMQ. Update the checkboxes as work is completed.*
