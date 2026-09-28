# StoryNest AI Memory

**Repo:** https://github.com/BrnEzekiel/StoryNest  
**Updated:** 2026-09-28

## Production API (verified)
- **URL:** `https://storynest-qzwm.onrender.com`
- **Health:** `GET /health` → `status: ok`, version 3.8.0, schema `social_master_v3_stable`, bullmq true
- **Do not use** `https://storynest.onrender.com` (wrong / dead host)

## Env for clients
```
NEXT_PUBLIC_API_URL=https://storynest-qzwm.onrender.com
EXPO_PUBLIC_API_URL=https://storynest-qzwm.onrender.com
```

## Shipped
Web: reader, library, studio, admin, streaks, feed, OTP, Paystack, workers  
Mobile: Expo 51, API client points at Render URL above

## Next product goal
Substance-style social reader: Home feed, Read, Activity, Subscribe UX (see conversation roadmap)

## Open
- CORS_ORIGINS on Render for Vercel + localhost
- APK rebuild after URL fix
- Substance Phase A UI
