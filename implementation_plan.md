# Implementation Plan: Google Auth Integration, Firebase Verification, & Nodemailer SMTP Transition

This implementation plan details the steps required to integrate Google Authentication ("join with google"), implement the sign-up with OTP via Firebase connection, remove the `resend.com` dependency, and verify the overall auth setup for StoryNest.

## User Review Required

We are transitioning from `resend` (which has proprietary SDK lock-in and a static apiKey) to a standard `nodemailer` SMTP client. This requires setting up standard SMTP credentials on your Render dashboard (or local `.env`) so the backend can send OTPs and emails.

Please add the following variables to your Render service environment or local `apps/backend/.env`:
* `SMTP_HOST`: e.g. `smtp.gmail.com` or `smtp.sendgrid.net`
* `SMTP_PORT`: e.g. `587` or `465`
* `SMTP_USER`: your SMTP username or email
* `SMTP_PASS`: your SMTP password or app password
* `SMTP_FROM`: e.g. `"StoryNest" <your-email@example.com>`
* `SMTP_SECURE`: `true` for port `465`, `false` for other ports (like `587`)

> [!IMPORTANT]
> Since we are modifying the backend files, we will commit the changes and push to GitHub (`BrnEzekiel/StoryNest`) to trigger a Render redeployment automatically once you approve the plan.

## Open Questions

There are no major open questions, but we will make sure the "Join with Google" flow is completely seamless for both signing up (first-time registration) and logging in.

## Proposed Changes

---

### Backend Components

#### [MODIFY] [package.json](file:///c:/Users/USER/new/apps/backend/package.json)
* Remove `"resend": "^6.12.4"` from dependencies.
* Add `"nodemailer": "^6.9.13"` to dependencies.

#### [MODIFY] [config.js](file:///c:/Users/USER/new/apps/backend/config.js)
* Replace the `resend` configuration with `smtp` configuration.
* Delete the `resend` client initialization.

#### [MODIFY] [index.js](file:///c:/Users/USER/new/apps/backend/index.js)
* Replace `resend` import with `nodemailer` transporter initialization.
* Rewrite `sendOTPEmail` to use `nodemailer` transporter.
* Update all other email-sending blocks (welcome email, story notifications, etc.) to use the SMTP transporter instead of `resend`.
* Update `/auth/login` to automatically register users who successfully authenticate with Google via Firebase but don't exist in the database, ensuring a unique username generation.

---

### Mobile/Frontend Components

#### [MODIFY] [AuthContext.tsx](file:///c:/Users/USER/new/apps/mobile/src/context/AuthContext.tsx)
* Implement `loginWithGoogle(idToken)` inside `AuthProvider`.
* Sign in to Firebase Auth using Google credentials:
  ```typescript
  const credential = GoogleAuthProvider.credential(idToken);
  const { user: firebaseUser } = await signInWithCredential(auth, credential);
  const firebaseIdToken = await firebaseUser.getIdToken();
  ```
* Post the Firebase ID token to the backend `/auth/login` endpoint, receive backend user session, and save tokens.
* Expose `loginWithGoogle` in `AuthContextType` and the context provider.

#### [MODIFY] [LoginScreen.tsx](file:///c:/Users/USER/new/apps/mobile/src/screens/LoginScreen.tsx)
* Inject a stunning "Google Sign In" button matching the application theme.
* Wire the button click to trigger `promptAsync()` from Expo Google Auth Session.

#### [MODIFY] [SignupScreen.tsx](file:///c:/Users/USER/new/apps/mobile/src/screens/SignupScreen.tsx)
* Inject the "Google Sign Up / Join" button in Step 1 of the sign-up process.
* Wire the button click to trigger `promptAsync()` and register/login with Google seamlessly.

---

## Verification Plan

### Manual Verification
1. Verify backend package dependencies install successfully.
2. Confirm SMTP email transmission works by triggering an OTP verification code.
3. Test Google Auth integration in the mobile UI.
4. Verify Render redeployment completes successfully after pushing to GitHub.
