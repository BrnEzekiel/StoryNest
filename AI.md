# StoryNest AI Memory

**Repo:** https://github.com/BrnEzekiel/StoryNest  
**Updated:** 2026-09-28

## Production

| Service | URL / system |
|---------|----------------|
| API | `https://storynest-qzwm.onrender.com` |
| Web hosting | **Firebase** (project `storynest-12345`) — not Vercel |
| Auth | Firebase Auth + OTP on API |
| Mobile | Expo EAS → same API URL |

See **PRODUCTION.md** for Firebase Hosting / App Hosting steps and CORS.

## Shipped
- API live on Render
- Correct client API URLs
- Substance Phase A tabs (Home/Read/Podcasts/Chat/Activity)
- Web Paystack + TipTap studio (needs Node host or App Hosting for API routes)

## Open
- Deploy web via Firebase App Hosting (preferred) or static Hosting
- Set Render CORS to `*.web.app` / `*.firebaseapp.com`
- Rebuild APK after URL fix
- Substance B–D
