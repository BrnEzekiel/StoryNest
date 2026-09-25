# StoryNest AI Memory & Migration Tracker

**Last updated:** 2026-09-25  
**Repo:** https://github.com/BrnEzekiel/StoryNest

## Payments
**Provider: Paystack** (not Stripe)

| Env | Where | Notes |
|-----|--------|--------|
| `PAYSTACK_SECRET_KEY` | `apps/web` server env | Never commit; used by `/api/paystack/*` |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | web | Inline popup |
| `NEST_PLUS_AMOUNT` | web | Smallest currency unit (kobo for NGN) |
| `NEST_PLUS_CURRENCY` | web | Default `NGN` |

Flow: `/plus` → `POST /api/paystack/initialize` → Paystack popup/redirect → `POST /api/paystack/verify` → `POST {API}/monetization/subscribe` with user JWT → `isPremium`.

**Security:** Live keys were shared in chat — rotate them in the Paystack dashboard and only store in local `.env` / host secrets.

## Web routes
`/plus` Nest Plus · `/settings` · `/feed` · `/streaks` · `/users/[id]` · reader comments · studio · admin

## Open
- OTP auth parity on web
- TipTap / Cloudinary multipart
- Production CORS + Vercel (add Paystack env vars on host)
- Confirm backend `/monetization/subscribe` sets `isPremium` (mobile already calls it)
