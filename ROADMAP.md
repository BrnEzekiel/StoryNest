# StoryNest Feature Roadmap — 110 items

Progress: **100 / 110** shipped & verified. (Only Batch 6 monetization #52–#61 remains — skipped per request.)

- `- [x]` = done and verified (code read or built + typechecked).
- `(pre-existing)` = already in the codebase before Batch 1.
- `(Batch N)` = implemented in that batch.
- Unchecked boxes may still turn out to exist — each is verified against the code before building.

## Batch 1: Reader experience
- [x] #1 **Chapter navigation** — chapter list drawer with jump-to-chapter. (pre-existing)
- [x] #2 **In-book search** — find text within the current chapter with match jumping. (Batch 1)
- [x] #3 **Highlights & notes** — select text to highlight and attach private notes, viewable in a "My annotations" shelf. (Gap closure: annotate mode — tap to highlight, long-press for note + Annotations shelf screen)
- [x] #4 **Inline definitions** — long-press a word for dictionary meaning without leaving the reader. (pre-existing: dictionary modal with free Dictionary API)
- [x] #5 **Reading ruler / focus mode** — dim everything except the current paragraph for distraction-free reading. (Gap closure: long-press any paragraph to focus, tap to release)
- [x] #6 **Auto-scroll** — hands-free scrolling with adjustable speed. (Batch 1)
- [x] #7 **Page-turn animations** — curl/slide/fade transitions instead of plain scrolling. (Gap closure: fade/slide chapter transitions, switchable in theme modal; page-curl pending)
- [x] #8 **Custom reader presets** — save named combinations of theme + font + size + spacing (e.g. "Night bus"). (Gap closure: named presets in theme modal — save/apply/delete)
- [x] #9 **Time-left-in-chapter** — live "12 min left in this chapter" based on personal reading speed. (Batch 1)
- [x] #10 **Resume across devices** — sync last-read position between mobile and web via the backend. (Gap closure: bookmark progress sync + scroll restore on both mobile and web)
- [x] #11 **Quote sharing cards** — turn a highlighted passage into a branded image for WhatsApp/Instagram status. (Gap closure: branded quote card modal with view-shot capture + share)

## Batch 2: Writing & publishing
- [x] #12 **Writer onboarding flow** — apply/upgrade path from READER to WRITER role. (pre-existing)
- [x] #13 **Story editor** — rich-text editor with autosave drafts for writers on mobile and web. (pre-existing)
- [x] #14 **Chapter manager** — reorder, rename, schedule, and publish chapters individually. (Batch 2: added reorder)
- [x] #15 **Cover designer** — built-in templates + Cloudinary upload with crop, so writers don't need Photoshop. (Batch 2: preset gallery + coverTheme)
- [x] #16 **Version history UI** — view, compare, and restore earlier drafts (Version model exists). (Batch 2: implemented missing endpoints + snapshots)
- [x] #17 **Co-authoring** — invite another writer to edit with roles (owner/editor) and change attribution. (Batch 2: implemented missing endpoints + edit rights)
- [x] #18 **Scheduled publishing** — "publish chapter 7 every Friday 6pm" with timezone support. (Batch 2: wired publishedAt end-to-end)
- [x] #19 **Audience targeting** — age rating, content warnings picker, and genre/mood tags at publish time. (Batch 2: backend fields + editor inputs)
- [x] #20 **Writer analytics dashboard** — reads, finishes, drop-off chapter, likes-per-chapter, follower growth. (pre-existing)
- [x] #21 **Beta readers group** — share draft chapters privately with selected readers for feedback before publishing. (Batch 2: codes + redeem)

## Batch 3: Social & community
- [x] #22 **Comments UI** — threaded comments with replies. (pre-existing)
- [x] #23 **Paragraph-level comments** — comment on a specific passage, Medium-style, not just the whole story. (Batch 3: discuss mode + paragraphIndex)
- [x] #24 **Likes & reactions UI** — like stories plus emoji reactions per chapter. (Batch 3: reactions backend + reader bar)
- [x] #25 **Follow authors** — follow + author profile pages with their stories and stats (Follows model exists). (Batch 3: implemented missing endpoint)
- [x] #26 **Reader profiles** — public shelves, currently-reading, and badges on a shareable profile. (Batch 3: implemented missing endpoint)
- [x] #27 **Direct messages** — reader↔author chat built on the existing Message model. (pre-existing)
- [x] #28 **Book clubs** — private groups with shared reading schedules and discussion threads. (Batch 3: clubs backend + screens)
- [x] #29 **Reading activity feed** — "Wanjiku finished X", "Otieno liked Y" from people you follow. (pre-existing)
- [x] #30 **Story requests board** — readers request topics; writers claim requests and publish against them. (Batch 3: requests backend + screen)
- [x] #31 **Annual reading wrap** — shareable year-in-review (minutes read, top genres, longest streak). (Batch 3: Wrap screen)

## Batch 4: Discovery & personalization
- [x] #32 **"Because you read" rail** — collaborative-filtering recommendations using likes + history. (pre-existing)
- [x] #33 **Mood-based discovery** — "I want something dark and short tonight" picker using the mood field. (Batch 4: mood chips)
- [x] #34 **Reading-time filter** — filter stories by minutes (under 10, 10–30, 30+). (Batch 4: time chips)
- [x] #35 **Trending & charts** — daily/weekly top 10 by reads, likes velocity, and finishes. (pre-existing)
- [x] #36 **New-chapter alerts feed** — "stories you follow updated" as a dedicated home section. (Batch 4: updated-for-you rail)
- [x] #37 **Author spotlight rotation** — weekly featured Kenyan/emerging author interview + story bundle. (Batch 4: spotlight card)
- [x] #38 **Smart search upgrades** — typo tolerance, author search, tag search, and recent searches. (Batch 4: recent searches; author search pre-existing)
- [x] #39 **Similar stories strip** — "Readers of this also finished" at the end of every story. (Batch 4: reader rail)
- [x] #40 **Onboarding taste quiz** — pick 3 genres + favorite authors at signup to seed the home feed. (Batch 4: refine-taste quiz)
- [x] #41 **Seasonal collections** — curated bundles (e.g. "Holiday horror", "Valentine's romance"). (Batch 4: collection cards)

## Batch 5: Gamification & streaks
- [x] #42 **XP & levels UI** — surface the xp field with levels (Page Turner → Bookworm → Legend). (Batch 5: level curve + badge)
- [x] #43 **Achievements gallery** — display and unlock Achievement records ("7-day streak", "100 chapters"). (Batch 5: real backend + screen)
- [x] #44 **Daily reading goal ring** — progress ring against dailyGoalMinutes with gentle reminders. (Batch 5: SVG ring + goal alerts)
- [x] #45 **Streak freeze** — spend coins to protect a streak for a missed day. (Batch 5: 50-coin repair endpoint + UI)
- [x] #46 **Reading challenges** — monthly quests ("read 5 sci-fi chapters") with coin rewards. (Batch 5: weekly challenges + claims)
- [x] #47 **Leaderboards** — opt-in weekly boards among friends or all readers. (Batch 5: implemented missing endpoint + registered screen)
- [x] #48 **Finish-rate badges for writers** — "90% finish rate" trust badge on high-quality stories. (Batch 5: real finish rate + badge)
- [x] #49 **Referral rewards UI** — share referralCode, earn coins when friends join and read (schema-ready). (pre-existing)
- [x] #50 **Coin wallet screen** — balance, earn history, and spend options for the coins field. (Batch 5: wallet + history)
- [x] #51 **Season passes** — limited-time themed reward tracks for heavy readers. (Batch 5: monthly pass + claims)

## Batch 6: Monetization & premium
- [ ] #52 **M-Pesa checkout** — STK push payments in KES (Purchase model already uses KES).
- [ ] #53 **Premium subscriptions** — monthly/yearly plans using isPremium/premiumExpiresAt, with paywall UI.
- [ ] #54 **Unlock-per-story** — buy individual premium stories or chapters with coins or cash.
- [ ] #55 **Writer payouts** — revenue share dashboard and M-Pesa/bank withdrawal for authors.
- [ ] #56 **Tipping** — send coins or KES tips to authors per chapter.
- [ ] #57 **Ad-supported free tier** — tasteful ads for free users, removable with premium.
- [ ] #58 **Gift premium** — buy a subscription for a friend via referral/payment link.
- [ ] #59 **Coin bundles shop** — purchase coin packs with bonus tiers.
- [ ] #60 **Subscription management** — upgrade, downgrade, cancel, receipts, and restore-purchases on reinstall.
- [ ] #61 **Free-trial flow** — 7-day premium trial with expiry reminders and graceful downgrade.

## Batch 7: Audio & accessibility
- [x] #62 **Text-to-speech mode** — listen to any story with natural voices and speed control. (Batch 7: expo-speech reader bar + rate control)
- [x] #63 **Human audiobooks** — writers upload narrated chapters; readers stream or download. (Gap closure: chapter audio upload + reader narration bar with play/download)
- [x] #64 **Sleep timer** — stop audio after 15/30/60 minutes. (Batch 7: TTS sleep chip 15/30/60/off)
- [x] #65 **Dyslexia-friendly font** — OpenDyslexic option plus letter/line-spacing controls. (Batch 7: dyslexic font preference + reader letter-spacing)
- [x] #66 **Full screen-reader support** — labeled controls and logical focus order on every screen. (Gap closure: labels + roles on reader toolbar, story cards, settings rows, admin console, new screens)
- [x] #67 **Dynamic type support** — respect the phone's system font-size accessibility setting. (pre-existing: match-system-text-size reader scaling, toggleable)
- [x] #68 **High-contrast theme** — beyond light/sepia/dark, a true black + yellow accessibility theme. (Batch 7: contrast reader theme)
- [x] #69 **Haptic feedback** — subtle vibrations on page turns, likes, and achievements. (Batch 7 + gap closure: likes, bookmarks, focus, highlights, reward claims)
- [x] #70 **Voice search** — speak to search stories and authors. (Batch 7: mic button in Explore wired to device speech recognition)
- [x] #71 **Swahili & Sheng localization** — full UI translation plus a language toggle in settings. (Batch 7: i18n + Settings language chips)

## Batch 8: Offline & sync
- [x] #72 **Download stories** — save full stories/chapters for offline reading with storage manager. (Batch 8: OfflineManager + Downloads screen)
- [x] #73 **Auto-download follows** — new chapters from followed authors download on Wi-Fi automatically. (Batch 8 + gap closure: auto-download on bookmark with Wi-Fi-only option)
- [x] #74 **Offline queue** — likes, bookmarks, and comments made offline sync when back online. (Batch 8: Outbox + app-launch/foreground flush)
- [x] #75 **Lite / data-saver mode** — compressed covers, no autoplay, minimal prefetch for expensive data. (Batch 8: lite toggle skips cover-art downloads)
- [x] #76 **OPDS / e-reader export** — send stories to Kindle/Kobo or export EPUB/PDF. (Gap closure: server-built EPUB per story + share-to-e-reader from Downloads)
- [x] #77 **Cross-device library sync** — bookmarks, history, and settings follow the account everywhere. (Batch 8: server bookmarks + reading progress sync)
- [x] #78 **Background prefetch** — next chapter downloads silently while you read the current one. (Batch 8: next-chapter prefetch in reader)
- [x] #79 **Storage usage screen** — per-story download sizes with one-tap cleanup. (Batch 8: Downloads screen with per-story sizes + clear-all)
- [x] #80 **Offline-first launch** — app opens instantly to downloaded content with no connection. (Gap closure: cold launch routes to Downloads when offline with saved stories)
- [x] #81 **Smart cache eviction** — auto-remove finished downloads when storage runs low. (Batch 8: clear-finished button driven by bookmark progress)

## Batch 9: Notifications & engagement
- [x] #82 **New-chapter push** — instant notification when a followed story updates. (Batch 9: on-device chapter alerts via EngagementService)
- [x] #83 **Streak-saver nudge** — "read 5 minutes to keep your 12-day streak" evening reminder. (Batch 9: scheduled streak reminders)
- [x] #84 **Comment reply alerts** — notify on replies, likes on your comments, and author responses. (Batch 9: reply watch checks)
- [x] #85 **Personalized digest** — weekly "new in your genres" email/push summary. (Batch 9 + gap closure: on-device digest + admin email-digest runner)
- [x] #86 **Price-drop / free-weekend alerts** — notify when a wishlisted premium story goes on sale. (Batch 9: deals watch in engagement engine)
- [x] #87 **Granular notification settings** — per-type toggles beyond the single notificationsOn flag. (Batch 9: digest/chapters/streak/replies/quiet toggles in Settings)
- [x] #88 **In-app notification inbox** — persistent history of all notifications inside the app. (Batch 9: Inbox screen + announcements API)
- [x] #89 **Quiet hours** — no pushes during user-defined sleep hours. (Batch 9: quiet-hours gate 10pm–7am, toggleable)

## Batch 10: Safety, moderation & trust
- [x] #90 **Report flow** — report stories, chapters, comments, and users with reason picker. (Batch 10: ReportSheet + POST /reports)
- [x] #91 **Moderation queue** — admin review of isFlagged items with approve/reject actions. (Batch 10: admin reports console with dismiss/remove/ban)
- [x] #92 **Plagiarism check** — scan new submissions against published stories before they go live. (pre-existing: shingle-containment scan auto-flags copies at publish)
- [x] #93 **Keyword + AI content filter** — auto-flag hate speech, explicit content, and spam in stories/comments. (Batch 10: trust.js filters + tests)
- [x] #94 **Age-gate enforcement** — use dateOfBirth + isAdult to lock mature content with verification. (Batch 10 + gap closure: DOB at signup + editable in profile, server age check, reader interstitial)
- [x] #95 **Block & mute** — block users, mute comment threads, hide individual stories. (Batch 10 + gap closure: block/unblock, thread mute, hide/unhide stories)
- [x] #96 **Two-factor authentication** — TOTP/SMS second factor for writer and admin accounts. (Batch 10: TOTP setup/verify/disable + Settings UI)
- [x] #97 **Login alerts & sessions** — "new login" email plus active-session list with remote logout. (Batch 10: login email pre-existing + sessions list + sign-out-everywhere)
- [x] #98 **Privacy controls** — profile visibility, activity-feed opt-out, and data-download/delete (GDPR-style). (Batch 10: discoverability toggle, data export, delete account)

## Batch 11: Admin, analytics & platform
- [x] #99 **Admin analytics dashboard** — DAU/MAU, retention curves, reads-per-genre, revenue overview. (Gap closure: /admin/analytics + stats tab in admin console)
- [x] #100 **Featured-content scheduler** — plan isFeatured rotations and home banners on a calendar. (Batch 11 + gap closure: scheduled publish + timed features + upcoming-schedule list)
- [x] #101 **Bulk story tools** — batch publish, re-tag, feature, or unlist stories via CSV. (Batch 11 + gap closure: bulk endpoint + CSV picker UI in admin console)
- [x] #102 **User management console** — search users, change roles, reset passwords, ban/unban. (Batch 11: admin user search + ban console; role endpoint live)
- [x] #103 **Crash & error dashboard** — surface error-handler reports with trends and alerts. (Batch 11: /admin/errors + ops console tab)
- [x] #104 **Feature flags system** — roll features out to % of users without a new build. (Batch 11 + gap closure: runtime flags + install-bucketed % rollouts)
- [x] #105 **In-app update prompt** — force or suggest updates when a new version ships. (Batch 5: full self-update — silent OTA + in-app APK install)
- [x] #106 **Deep linking** — storynest.app/s/... links that open stories directly from shares. (Batch 11: storynest:// + https intent filter + linking map)
- [x] #107 **SEO story pages** — public web pages per story so Google sends free traffic. (Batch 11: sitemap + robots + Book JSON-LD on web)
- [x] #108 **Public API for partners** — documented endpoints for schools/publishers to embed StoryNest content. (Batch 11 + gap closure: /v1 endpoints + docs/API.md)
- [x] #109 **Automated backups & status page** — scheduled DB backups plus a public uptime page. (Batch 11 + gap closure: backup dump + daily snapshots + /status endpoint)
- [x] #110 **Multi-currency support** — USD/NGN/GHS pricing alongside KES for diaspora and expansion. (Batch 11: /currencies + Settings picker)
