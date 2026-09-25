# StoryNest Web (`apps/web`)

Next.js (App Router) + Tailwind CSS web client for StoryNest.
Talks to the existing Express API in `apps/backend`.

## Setup

```bash
# from repo root
npm install

# env
cp apps/web/.env.example apps/web/.env.local
# set NEXT_PUBLIC_API_URL if backend is not on localhost:5000

npm run web
# → http://localhost:3000
```

## Brand

- Deep Forest Green `#003631`
- Warm Cream `#FDFAF5`
- Gold accent `#FFEDA8`

## Stack

- Next.js 15 App Router
- Tailwind CSS (brand tokens + CSS variables)
- Lightweight UI primitives (Button, Card, Input) — shadcn-compatible patterns
- JWT via `Authorization: Bearer` (same as mobile); cookies can be added later

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing |
| `/explore` | Story list from API |
| `/stories/[id]` | Story reader (basic) |
| `/login` `/signup` | Auth against Express |
| `/library` | Placeholder |
