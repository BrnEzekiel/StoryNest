# StoryNest AI Memory & Migration Tracker

**Last updated:** 2026-09-25  
**Repo:** https://github.com/BrnEzekiel/StoryNest

## Auth (web)
Matches mobile OTP flow:
1. `POST /auth/otp/initiate` `{ email, dob }`
2. `POST /auth/otp/verify` `{ email, otp }`
3. `POST /auth/register` `{ email, password, username, dob?, firebaseUid? }`
4. Login: `POST /auth/login` `{ email, password }`
5. Forgot: `/auth/password/forgot` + `/auth/password/reset`

Pages: `/signup` (3 steps) · `/login` · `/forgot-password`

Web sends `firebaseUid: web_<ts>` when Firebase isn’t on the web client; if backend rejects, configure Firebase on web or relax UID check server-side.

## Paystack Nest Plus
`/plus` + `/api/paystack/initialize|verify` → `/monetization/subscribe`  
**Rotate live keys** if they were pasted in chat; store only in env.

## Open
- TipTap + Cloudinary multipart on studio
- Production CORS + Vercel env (Paystack, API_URL)
- Optional real Firebase Auth on web
