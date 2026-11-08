# StoryNest API

Base URL (production): `https://storynest-qzwm.onrender.com`
Web app points at it via `NEXT_PUBLIC_API_URL`. Mobile via the bundled API URL.

Auth: `Authorization: Bearer <accessToken>` (mobile-compatible).
Signup uses OTP like mobile. Refresh via `POST /auth/refresh`.

## Public partner API (`/v1`)

No auth required. Stable, versioned, read-only.

- `GET /v1/stories?genre=&limit=` — published stories (max 50). Returns `{ data: [...] }`.
- `GET /v1/stories/:id` — story detail with published chapter index (id/title/order, no bodies).

Example:

```bash
curl "https://storynest-qzwm.onrender.com/v1/stories?genre=Romance&limit=5"
```

## Reader surface (selected)

- `GET /stories?genre=&mood=` — catalog.
- `GET /stories/:id` — detail + `bookmarkProgress` for the signed-in reader.
- `GET /stories/:id/epub` — download a packaged EPUB (free stories; 403 for premium).
- `GET /chapters/:id` — chapter body (Bearer optional; premium/adult gated).
- `POST /stories/:id/bookmark` `{ progress }` — save position (`-1` removes). Syncs mobile ↔ web.
- `POST /stories/:id/like`, `POST /stories/:id/reactions` `{ emoji }`.
- `GET/POST /stories/:id/comments` (`content`, `parentId?`, `paragraphIndex?`).
- `POST /users/:id/follow`, `POST /users/:id/block` (toggles).
- `GET /announcements` — inbox feed.
- `POST /reports` `{ targetType: story|comment|user|chapter, targetId, reason, details? }`.

## Writer surface (selected)

- `POST /stories`, `PUT /stories/:id` — publish/edit (multipart `cover` supported).
- `GET /stories/:id/chapters` — full chapter rows incl. `audioUrl` (owner/editor).
- `POST /stories/:id/chapters` `{ title, body, order?, publishedAt?, audioUrl? }`.
- `PUT /chapters/:id` — edit (incl. `audioUrl`, scheduling).
- `POST /chapters/:id/audio` — multipart `audio` upload (Cloudinary, 60 MB).
- `GET /stories/:id/versions`, beta codes, co-author invites.

## Account & privacy

- `POST /users/me/settings` — `{ notificationsOn, recsEnabled, discoverable, showActivity, dateOfBirth }`.
- `GET /users/me/export` — full GDPR-style JSON dump.
- `DELETE /auth/account` — delete account + owned content.
- `POST /auth/totp/setup|verify|disable` — TOTP two-factor.
- `GET /users/me/sessions`, `POST /auth/logout-all` — session revocation.
- `GET /currencies` — supported display currencies.

## Admin (role `ADMIN`)

- `GET /admin/analytics` — `{ dau, mau, newUsers7d, retention7d, readsPerGenre, revenueByDay, revenueByCurrency, totals }`.
- `GET /admin/users?q=`, `PUT /admin/users/:id/role`, `PUT|POST /admin/users/:id/ban`.
- `GET /admin/reports`, `POST /admin/reports/:id/resolve` `{ action: DISMISS|REMOVE|BAN }`.
- `GET /admin/errors`, `GET /admin/flags`, `POST /admin/flags` `{ key, enabled, percent? }`.
- `POST /admin/announcements` `{ title, body }`.
- `POST /admin/stories/bulk` `{ ids[1..100], action: publish|unlist|feature|unfeature|tag|delete, genre? }`.
- `POST /admin/stories/:id/schedule` `{ publishAt }`, `GET /admin/scheduled`.
- `PUT /admin/stories/:id/feature` `{ days }`.
- `POST /admin/digest/run` `{ limit? }` — send weekly email digests.
- `GET /admin/backup` — JSON dump download.

## Ops

- `GET /status` — `{ ok, uptimeSec, version, users, stories, openReports, time }`.
- `GET /app/config` — feature flags + versions for mobile bootstrap.
