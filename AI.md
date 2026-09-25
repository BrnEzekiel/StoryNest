# StoryNest AI Memory

**Repo:** https://github.com/BrnEzekiel/StoryNest  
**Updated:** 2026-09-25

## Production
See **[DEPLOY.md](./DEPLOY.md)** for Vercel + API + worker + Redis + CORS.

Key env:
- `CORS_ORIGINS` / `FRONTEND_URL` on API
- `NEXT_PUBLIC_API_URL` on web
- Paystack + Cloudinary on **web** server env

## Shipped features (web)
Reader, library, studio (TipTap + Cloudinary), admin, streaks, feed, follow, comments, OTP signup, Nest Plus (Paystack), digests/workers

## Open / optional
- Unpack backend index if CORS is hard-coded to localhost
- Firebase Auth on web (optional; OTP path works without it)
- Mobile Paystack parity
