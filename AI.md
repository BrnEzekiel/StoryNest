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
| Backend      | Node.js + Express.js + **BullMQ**               |
| Database     | PostgreSQL + Prisma ORM                         |
| Auth         | JWT (Access + Refresh Tokens)                   |
| Storage      | Cloudinary (cover images)                       |
| Email        | Gmail REST API via google-auth-library          |
| Queues       | BullMQ + Redis                                  |
| Other        | Firebase Admin, rate limiting, multer           |
| Monorepo     | npm workspaces (`apps/*`, `packages/*`)         |

**Key paths**
- `apps/mobile` — Expo app
- `apps/web` — Next.js + Tailwind web client
- `apps/backend` — Express API (`index.js` → `app.js` loader + base64 runtime with BullMQ)
- `apps/backend/queues/` — BullMQ queues
- `apps/backend/workers/` — BullMQ workers entry
- Root `package.json` — workspaces + scripts (`backend`, `worker`, `web`, `mobile`, `db:push`, `db:seed`)

**Existing features (mobile + API)**
- Auth (OTP signup, login, JWT, Google path)
- Home / Explore / Reader (themes, font size, progress)
- Bookmarks, reading history, streaks
- Admin panel (upload/edit/delete stories, role-based)
- Cloudinary uploads

**Web**
- Landing, Explore (search + genre filter), full reader, Library (bookmarks), Login/Signup
- Reader: Light / Sepia / Dark, font size, progress bar, chapters, bookmark sync
- API client mirrors mobile endpoints (`/stories`, `/bookmark`, `/users/me/bookmarks`, etc.)

---

## 2. Target Stack (Migration Goal)

| Piece                    | Role                                              |
|--------------------------|---------------------------------------------------|
| **Next.js** (App Router) | Web app + future admin/author dashboards          |
| **Tailwind CSS**         | Utility-first styling                             |
| **shadcn/ui**            | High-quality accessible components (primitives in place; full CLI init optional) |
| **Node.js + Express**    | Existing API (keep & extend)                      |
| **JWT**                  | Existing auth (keep; prefer httpOnly cookies on web) |
| **BullMQ + Redis**       | Async jobs (email, publish, media, digests, AI)   |
| **Prisma + PostgreSQL**  | Existing DB                                       |
| **Cloudinary**           | Existing media                                    |

### Target Architecture
```
apps/
  mobile/          ← existing Expo (keep evolving)
  web/             ← Next.js + Tailwind + shadcn-style UI
  backend/         ← Express + BullMQ workers
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
- [x] Worker scripts: `npm run worker` / `npm run worker:dev` (+ root scripts)
- [x] Document recovery + wiring: `apps/backend/PHASE0_INDEX_PATCH.md`
- [x] Full backend entry restored via `index.js` → `app.js` + `b64_0..42.txt` (patched with queues import, `/queues/*` routes, welcome enqueue on register)
- [ ] Prove end-to-end on a host with Redis (Render/Railway + Upstash): API + worker + `/queues/test-welcome`
- [ ] Backend still starts on deploy host (verify after Redis env set)

**Notes / Decisions:**
- Workers run as a **separate process** from the API (`workers/index.js`).
- Email sending reuses existing `sendGmail` (Gmail REST API).
- Large-file push truncated plain `index.js`; recovery packaging uses base64 parts + `app.js` loader.
- Owner now has a PC; can pull `main` and run locally.

---

### Phase 1 — Next.js Web Skeleton
**Goal:** Working Next.js app that authenticates against the same Express API.

- [x] Create `apps/web` with Next.js App Router, TypeScript, Tailwind
- [x] Brand colors (Deep Forest Green + Warm Cream + Gold) in Tailwind theme + CSS variables
- [x] Core UI primitives (Button, Card, Input) — shadcn-compatible patterns
- [x] API client (`src/lib/api.ts`) with Authorization Bearer + localStorage tokens
- [x] Auth pages: Login / Signup (basic; **OTP flow deferred — revisit later**)
- [x] App shell: header, nav, footer
- [x] Basic pages: Home, Explore, Story detail, Library
- [x] Root package.json scripts: `"web"`, `"web:build"`, `"worker"`, `"worker:dev"`
- [ ] CORS on Express updated for web origin (when known deploy URL)
- [ ] Optional: full `npx shadcn@latest init` when interactive CLI is convenient
- [ ] Deploy web to Vercel pointing at backend URL

**Notes / Decisions:**
- Auth uses Bearer JWT like mobile. Web signup does not yet match mobile OTP + Firebase flow; login may work for existing accounts. **Revisit auth after Phase 2/3.**
- Hydration mismatch with `crxlauncher` attributes = browser extension noise.

---

### Phase 2 — Core Reader & Library on Web
**Goal:** Reading parity with mobile for the most important flows.

- [x] Story reader page (typography, Light / Sepia / Dark, font size, progress bar)
- [x] Chapter list + prev/next navigation; load chapter body via `/chapters/:id` when needed
- [x] Bookmarks & progress sync (`POST /stories/:id/bookmark`, `GET /users/me/bookmarks`)
- [x] Mark read (`POST /stories/:id/read`)
- [x] Library page (bookmarks when signed in; CTA when guest)
- [x] Search & genre filter on Explore (client-side over fetched list)
- [x] Skeleton loaders (explore cards + reader)
- [ ] (Optional later) Service worker / offline support

**BullMQ usage in this phase**
- [ ] Reading progress aggregation / streak calculation job
- [ ] “New chapter / story updated” email or push job

**Notes / Decisions:**
- Reader preferences also stored in `localStorage` (`sn_reader_theme`, `sn_reader_font`) and optionally synced via `POST /users/me/preferences`.
- API client expanded in `apps/web/src/lib/api.ts` to match mobile reader endpoints.
- Auth still deferred; bookmark actions require a valid token.

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
- [ ] Daily / weekly digest emails (BullMQ scheduled)
- [ ] Reading goals & streaks dashboard (charts)
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
| Auth on web        | Bearer JWT for now (mobile parity); OTP web flow + httpOnly cookies later |
| API                | Same Express service; add web origin to CORS                             |
| Monorepo scripts   | `web`, `worker`, `backend`, `mobile` on root `package.json`            |
| Deployment         | Backend + workers → Render/Railway/Fly; Web → Vercel; Redis → Upstash    |
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
- `apps/backend/PHASE0_INDEX_PATCH.md` — index.js recovery notes
- `apps/web/README.md` — web app setup
- `walkthrough.md`, `IMPECCABLE_GUIDE.md`, etc.

---

## 9. How to Use This File

1. **Before starting any work** — read this entire file.
2. **When finishing a task** — change `- [ ]` to `- [x]` and add a short note under **Notes / Decisions** if something important was decided or blocked.
3. **When handing off to another AI or developer** — point them at this file + the repo URL.
4. **Keep the “Last updated” date current** when you make meaningful changes.

---

## 10. Immediate Next Action

1. **Owner (PC):** `git pull origin main` && `npm install` && run backend + `npm run web`.
2. Smoke-test Explore → open a story → Display (theme/font) → Bookmark (if logged in) → Library.
3. Next build target: **Phase 3** (author/admin web) *or* revisit web auth (OTP parity with mobile).

---

*This file was created to preserve full context for the StoryNest migration to Next.js + Tailwind + shadcn/ui + BullMQ. Update the checkboxes as work is completed.*
