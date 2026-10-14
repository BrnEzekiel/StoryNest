# StoryNest AI Memory

**Repo:** https://github.com/BrnEzekiel/StoryNest  
**Updated:** 2026-10-15

## Production

| Service | Value |
|---------|--------|
| API | `https://storynest-qzwm.onrender.com` |
| Health | ok · v3.8.x · BullMQ |
| Web host | **Firebase** (`storynest-12345`) |
| Mobile | Expo EAS · `EXPO_PUBLIC_API_URL` set in eas.json |
| Pay | Paystack Nest Plus |

## Phases

- [x] Phase A — Tabs Home / Read / Podcasts / Chat / Activity
- [x] Phase B — Subscribe label + share on profiles (web + mobile)
- [x] Phase C — Podcasts hub (catalog UI; audio CMS next)
- [x] Phase D — Nest Plus Paystack path (web); Premium screen mobile link
- [x] API URL + Firebase docs + Codely brief PDF

## Still requires human accounts

- Firebase App Hosting deploy
- Render `CORS_ORIGINS` for `*.web.app`
- `eas build` APK with Expo login
- Live Paystack keys in web env (never commit)

## See also

- `PRODUCTION.md` · `DEPLOY.md`
