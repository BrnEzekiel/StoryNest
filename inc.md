# StoryNest — Errors & Incomplete Features Audit

## Security Issues

- [ ] **Credentials leaked in `.env.example`** — Real database URL (Neon), JWT secrets, Cloudinary API secret, and Google client ID are committed in plain text (`.env.example:22-29`). These should be placeholder values only.
- [ ] **Hardcoded admin credentials in backend** — `DEFAULT_PASSWORD = "password123"` and hardcoded admin emails in `apps/backend/index.js:25-27`. The server auto-creates admin accounts with a weak password on every startup.
- [ ] **Firebase config hardcoded in client** — API key, project ID, and app ID are embedded in `apps/mobile/src/api/firebaseConfig.ts:12-17`. Should use environment variables.
- [ ] **User password returned in auth responses** — `POST /auth/register` and `POST /auth/login` return the full `user` object from Prisma (including `password` hash) in the JSON response (`apps/backend/index.js:142,152`).
- [ ] **JWT fallback secrets are weak** — `process.env.JWT_ACCESS_SECRET || "secret"` and `"refresh-secret"` used as fallbacks (`apps/backend/index.js:101,114`). If env vars are missing, auth is trivially breakable.

## Backend Errors & Bugs

- [ ] **Duplicate `PORT` and `DATABASE_URL`** in `.env.example` — The same variables are defined twice (lines 2-4 and lines 22-23), the second set overrides the first with real credentials.
- [ ] **`/stories?limit=20` parameter not handled** — The Explore screen sends `?limit=20` (`ExploreScreen.tsx:34`) but the `/stories` endpoint never reads or applies a `limit` query parameter (`apps/backend/index.js:191-209`). All stories are always returned.
- [ ] **No input validation on auth endpoints** — `POST /auth/register` and `POST /auth/login` accept any body shape with no validation for email format, password length, or required fields.
- [ ] **`/stories/:id/read` crashes if story doesn't exist** — `story.readingTime` is accessed without a null check after `findUnique` (`apps/backend/index.js:291-292`). If the story was deleted, this throws.
- [ ] **`readingTime` not parsed on create** — `parseInt(readingTime)` can return `NaN` if no value is provided (`apps/backend/index.js:247`). No fallback or validation.
- [ ] **Uploaded files never cleaned up** — `multer` saves files to `uploads/` but they are never deleted after Cloudinary upload (`apps/backend/index.js:94,244`).
- [ ] **Refresh token not stored/invalidated server-side** — The `User` model has a `refreshToken` field, but it is never written to or checked. Any refresh token is valid until it expires, with no way to revoke.
- [ ] **Version history never created** — The `Version` model exists in the Prisma schema, but the `PUT /stories/:id` endpoint never creates a version entry before updating (`apps/backend/index.js:388-408`).
- [ ] **Story deletion doesn't delete `Version` records** — The `$transaction` in `DELETE /stories/:id` deletes likes, comments, history, bookmarks, and the story — but not `Version` records, which will cause a foreign key violation if versions exist (`apps/backend/index.js:414-420`).
- [ ] **Cache not invalidated on like/bookmark/comment** — `cache.flushAll()` is only called on story create/update/delete. Likes, comments, and bookmarks modify data that may be cached but don't clear the cache.
- [ ] **`POST /stories/:id/bookmark` doesn't validate `progress`** — `parseInt(progress)` can be `NaN`; no bounds checking (0-100).

## Mobile / Frontend Errors & Bugs

- [ ] **Missing asset files** — `assets/` directory does not exist in the repo. `OnboardingScreen.tsx` references `../../assets/onboarding-bg.jpg`, `../../assets/logo.png`; `LoginScreen.tsx` and `SignupScreen.tsx` reference `../../assets/auth-bg.jpg`. These are gitignored (`*.png`, `*.jpg` in `.gitignore`) so the app will crash on launch.
- [ ] **`NavigationContainer` imported but unused in `MainNavigator.tsx`** — `DefaultTheme` and `NavigationContainer` are imported from `@react-navigation/native` (line 4) but `NavigationContainer` is already in `App.tsx`. The import in `MainNavigator` is unused.
- [ ] **`MainNavigator` navigation goes to wrong tab** — `handleGenrePress` in `ExploreScreen.tsx` navigates to `navigation.navigate("Home", { genre: formattedGenre })` but "Home" is a tab screen nested inside "Main". This may not pass params correctly through the tab navigator.
- [ ] **Notifications bell button is a no-op** — Home screen bell icon has `onPress={() => {}}` (`HomeScreen.tsx:186-188`). Does nothing.
- [ ] **`ImagePicker.MediaTypeOptions` deprecated** — `ProfileScreen.tsx:39` and `AdminScreen.tsx:51` use `ImagePicker.MediaTypeOptions.Images` which was deprecated in newer Expo SDK versions.
- [ ] **`useIdTokenAuthRequest` Google client ID mismatch** — Login and Signup screens use `clientId: '170425305101-...'` but `.env.example` has a different `GOOGLE_CLIENT_ID` value (`564839035602-...`). One of these is wrong.
- [ ] **`isRegistering` is a module-level mutable variable** — `AuthContext.tsx:43` uses `let isRegistering = false` outside of React state/ref. This is fragile and won't survive Fast Refresh correctly.
- [ ] **No error display for failed login via Firebase** — `login()` in `AuthContext.tsx:90-91` calls `signInWithEmailAndPassword` but errors from Firebase are not caught in `AuthContext`; the catch in `LoginScreen.tsx:74` only catches `err.response?.data?.error` (Axios-style), not Firebase errors which have a different shape (`err.code`).
- [ ] **`WaveShape.tsx` component is unused** — Defined but never imported or rendered anywhere in the app.
- [ ] **`i18n.ts` is configured but never used** — The i18n module is set up with English and Spanish translations but is never imported in `App.tsx` or any screen. No `useTranslation` hook is called anywhere.
- [ ] **`storynest.md` and `gemini.txt` are dev artifacts committed to repo** — Large files (`storynest.md` is 1.6MB) that appear to be AI conversation logs, not production code.
- [ ] **Root `package.json` has wrong `name`** — Package name is `"new"` instead of `"storynest"` (`package.json:2`).
- [ ] **Duplicate Prisma schemas** — Identical `schema.prisma` exists in both `packages/db/prisma/` and `apps/backend/prisma/`. Only one should be the source of truth.
- [ ] **`prisma.config.ts` exists in two places** — `packages/db/prisma.config.ts` and `apps/backend/prisma.config.ts` — potential for drift.

## Incomplete Features (Claimed in README but not implemented)

- [ ] **Seed data uses placeholder images** — `packages/db/seed.js` uses `https://via.placeholder.com/150` for all cover images instead of real images. Stories will display blank/broken covers.
- [ ] **Change Password** — Settings screen shows "Change Password" but `onPress` just shows an `Alert` saying "Password reset link sent to your email" without actually sending anything (`SettingsScreen.tsx:87`).
- [ ] **Push Notifications** — Settings has a toggle for push notifications but it only controls local state (`SettingsScreen.tsx:13`). No actual push notification registration, no backend endpoint, no `expo-notifications` setup beyond the package being installed.
- [ ] **Language / i18n** — Settings shows "Language: English" but `onPress` shows an alert "coming in next update" (`SettingsScreen.tsx:80`). The `i18n.ts` file is set up but never integrated.
- [ ] **Forgot Password flow** — Login screen "Forgot Password?" button shows a static alert (`LoginScreen.tsx:124`). No actual password reset email is sent.
- [ ] **"Recommended For You" is fake** — The "RECOMMENDED FOR YOU" section on the Home screen just shows the first 3 stories from the same list (`HomeScreen.tsx:162`). No recommendation engine, no personalization.
- [ ] **Story drafts / scheduled publishing** — The schema has `isDraft` and `publishedAt` fields on `Story`, but the backend never filters by these. All stories are returned regardless of draft status. No scheduling logic exists.
- [ ] **Featured stories are not curated** — `isFeatured` exists on the `Story` model but the Home screen just picks the first story from the list as "featured" (`HomeScreen.tsx:97`). The backend never filters or sorts by `isFeatured`.
- [ ] **Story flagging** — `isFlagged` exists on the `Story` model but no endpoint or UI exists to flag or filter flagged stories.
- [ ] **Story summaries** — `summary` field exists on the `Story` model (nullable `@db.Text`) but is never populated or displayed.
- [ ] **User premium features** — `isPremium`, `premiumExpiresAt` fields exist on `User` but no subscription logic, payment flow, or premium-gated content exists.
- [ ] **Referral system** — `referrerId` field on `User` but no referral code generation, no tracking, no reward logic.
- [ ] **XP / Leveling / Achievements** — `xp` field on `User` and `Achievement` model exist but XP is never incremented and no achievements are ever awarded.
- [ ] **Purchase model unused** — `Purchase` model exists for micro-transactions but no purchase endpoint or payment integration exists.
- [ ] **Follows model unused** — `Follows` model exists for follow/unfollow but no API endpoints exist to follow or list followers.
- [ ] **Reading streaks are broken** — `streakCount` and `lastReadDate` exist on the User model, and `POST /stories/:id/read` updates `lastReadDate`, but `streakCount` is never incremented or reset. The streak display on ProfileScreen always shows 0 or whatever was initially seeded.
- [ ] **Daily reading goal** — `dailyGoalMinutes` field (default 30) on User but no tracking, progress display, or completion logic.
- [ ] **Nested comment replies** — The Comment model supports `parentId` for threading, but `POST /stories/:id/comments` never accepts or uses a `parentId` field. Comments are flat only.
- [ ] **Admin: no way to toggle `isFeatured` or `isDraft`** — Admin UI can create/edit/delete stories but has no controls for featuring or draft status.
- [ ] **Privacy Policy** — Shows a static alert instead of actual policy content (`SettingsScreen.tsx:92`).
- [ ] **About page** — Shows a static alert instead of real app info/version/credits (`SettingsScreen.tsx:98`).
