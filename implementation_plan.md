# Implementation Plan: Fix StoryNest Database, Backend, and Authentication Issues

This plan outlines the changes required to resolve the four main issues identified in the StoryNest project.

## Proposed Changes

### 1. Database Schema Synchronization

We will merge the two Prisma schemas to create a unified source of truth. We will use the comprehensive schema from the `db` package, add the missing `firebaseUid` field, ensure `username` is unique, and make the backend's local schema identical.

#### [MODIFY] [schema.prisma](file:///C:/Users/USER/new/packages/db/prisma/schema.prisma)
* Update `User` model:
  * Add `firebaseUid String? @unique`
  * Add `@unique` constraint to the `username` field.

#### [MODIFY] [schema.prisma](file:///C:/Users/USER/new/apps/backend/prisma/schema.prisma)
* Overwrite/update with the identical unified schema from `packages/db/prisma/schema.prisma`.

---

### 2. Backend Endpoint Implementation

We will add the missing endpoints to the backend [index.js](file:///C:/Users/USER/new/apps/backend/index.js) and update the `GET /stories/:id` route to calculate `isLiked` dynamically.

#### [MODIFY] [index.js](file:///C:/Users/USER/new/apps/backend/index.js)
* **Token Refresh**: Add `POST /auth/refresh` endpoint.
* **Bookmarks**: Add `GET /users/me/bookmarks` and `POST /stories/:id/bookmark` endpoints.
* **Comments**: Add `GET /stories/:id/comments` and `POST /stories/:id/comments` endpoints.
* **Profile Management**: Add `PUT /users/me` endpoint to handle multipart/form-data image uploads for avatars.
* **Story Management**: Add `PUT /stories/:id` and `DELETE /stories/:id` endpoints with admin authorization checks.
* **Likes Integration**: Modify `GET /stories/:id` to check the authorization header and dynamically return `isLiked`.

---

### 3. Authentication Race Condition Resolution

We will introduce a client-side registering flag to prevent `onAuthStateChanged` from triggering a premature `syncWithBackend` before the sign-up endpoint resolves.

#### [MODIFY] [AuthContext.tsx](file:///C:/Users/USER/new/apps/mobile/src/context/AuthContext.tsx)
* Declare a file-scoped variable `let isRegistering = false;`.
* Wrap `createUserWithEmailAndPassword` and `/auth/register` flow in `isRegistering = true` / `isRegistering = false`.
* Skip calling `syncWithBackend()` inside `onAuthStateChanged` if `isRegistering` is true.

---

### 4. Dynamic URL for Global Error Handling

We will export the computed `BASE_URL` from the API client and use it inside the global error handler.

#### [MODIFY] [apiClient.ts](file:///C:/Users/USER/new/apps/mobile/src/api/apiClient.ts)
* Export `BASE_URL`.

#### [MODIFY] [ErrorHandler.ts](file:///C:/Users/USER/new/apps/mobile/src/utils/ErrorHandler.ts)
* Import `BASE_URL` from [apiClient.ts](file:///C:/Users/USER/new/apps/mobile/src/api/apiClient.ts).
* Replace the hardcoded `BACKEND_URL` with `BASE_URL`.

---

## Verification Plan

### Automated Verification
- Run database migrations/schema updates using:
  ```bash
  npm run db:push
  ```
- Regenerate the Prisma Client using:
  ```bash
  npm run postinstall --workspace=apps/backend
  ```

### Manual Verification
- Start backend server and verify that seeding and admin initialization works.
- Attempt email/password registration on the client and verify that the user profile is successfully created with no race condition errors.
- Verify bookmarking, commenting, profile updates, and admin editing/deleting functionalities.





You are operating as an Elite Android Systems Architect and Automated Code Quality Auditor. Your core objective is to execute a deep-dive, multi-layered static and structural audit of this entire project workspace. The application currently fails to build or execute. You must systematically locate every single point of failure, structural gap, and optimization bottleneck.

Analyze the entire directory structure and files, then generate an exhaustive audit report addressing the following categories in meticulous detail:

====================================================================
1. CRITICAL BLOCKERS, SYNTAX BREAKS, AND COMPILATION ERRORS
====================================================================
- Identify all explicit syntax errors, broken or unresolvable imports, and unmapped dependencies.
- Flag type-safety violations, strict null-safety issues (e.g., Kotlin platform types, unsafe null casting, unhandled nullable properties), and incorrect method signatures.
- Detect broken lifecycle implementations (e.g., faulty Activity/Fragment lifecycle binds, incorrect ViewModel instantiations).
- Identify invalid resource references within code files (e.g., calling 'R.id.missing_view' or 'R.string.non_existent').

====================================================================
2. ARCHITECTURAL WIRING, DATA FLOW, AND THREADING VIOLATIONS
====================================================================
- Audit the data layer boundary: Validate that data flow across layers (UI -> ViewModel -> UseCase/Repository -> Data Source) is unbroken. Look for missing return paths or unobserved streams/Flows/LiveData.
- Detect threading anomalies: Flag any long-running operations, network requests, or disk/database I/O executing directly on the Main (UI) thread instead of appropriate dispatchers (e.g., Dispatchers.IO).
- Inspect state management mechanics: Look for race conditions, unhandled loading/error states, mutable states exposed directly to views, or state loss bugs during configuration changes (e.g., screen rotation).
- Flag memory leak hazards: Look for static references to Contexts, unregistered BroadcastReceivers, un-cleared EventBuses, un-canceled coroutine jobs/RxJava disposables, or leaky anonymous inner classes.

====================================================================
3. MANIFEST, BUILD SYSTEM, AND ENVIRONMENT CONFIGURATIONS
====================================================================
- App Manifest Verification: Parse 'AndroidManifest.xml' completely. Check for missing or undeclared components (Activities, Services, Providers, Receivers), mismatched package names/namespaces, or invalid intent filters.
- Permissions & Security Audit: Check for missing critical runtime permissions (e.g., Network, Storage, Location) needed by the code. Identify misconfigured Network Security Configs (e.g., cleartext traffic blockers stopping API calls).
- Build Automation Tooling: Meticulously inspect Project and App level 'build.gradle' or 'build.gradle.kts' files. Check for dependency version conflicts, incorrect multi-module configurations, mismatched SDK targets (compileSdk vs. targetSdk vs. minSdk), and syntax errors in build scripts.
- ProGuard/R8 Mapping: Inspect 'proguard-rules.pro'. Check for missing '@Keep' or preservation rules for data models that will cause the app to crash due to reflection/serialization issues after obfuscation.

====================================================================
4. MISSING ASSETS, GENERATED CODE, AND GRAPHICS PIPELINES
====================================================================
- Missing Resource Files: Cross-reference every resource pointer in code against actual files inside 'src/main/res/'. Flag missing drawables, layouts, values (strings, colors, styles), or XML animation assets.
- Dependency Injection & Codegen Stubs: Check for missing generated files or stubs from code generators like Dagger/Hilt (e.g., missing '@AndroidEntryPoint', unlinked modules), Room database (e.g., un-updated entity versions, missing migrations), or ViewBinding/DataBinding compilation breaks.
- Multi-Density Asset Completeness: Identify missing vector or raster assets required across alternative resource qualifiers (e.g., layouts missing for specific screen sizes, missing values-v24 folders if required).

====================================================================
5. UNDER-IMPLEMENTED SUBSTUB LOGIC AND ERROR HANDLING GAPS
====================================================================
- Flag every single 'TODO', 'FIXME', and empty placeholder method stub that blocks core user paths.
- Identify dead code paths, unreachable branches, and completely un-implemented functional modules.
- Audit exception boundaries: Locate silent failure traps such as empty 'catch' blocks, unhandled asynchronous failures, unhandled HTTP error codes, or missing fallbacks when local databases/caches return null.

====================================================================
OUTPUT LAYOUT & REPORTING STANDARDS
====================================================================
Do not include conversational filler, introductory pleasantries, or broad generalizations. Go straight to the findings. Present the final report using the following structure:

1. EXECUTIVE SUMMARY & IMPACT MATRIX: A priority table sorting issues by severity: [BLOCKER] (Prevents Compilation), [CRITICAL] (Runtime Crash), [MAJOR] (Broken Data Flow), [MINOR] (Warning/Clean Code).
2. DETAILED FINDINGS BY CATEGORY: For every single issue identified, output this exact block:
   - FILE PATH & LOC: [Exact absolute/relative path and line range]
   - ISSUE LEVEL: [Blocker / Critical / Major / Minor]
   - ROOT CAUSE Analysis: [Clear explanation of why it breaks or impairs the application]
   - REMEDIATION SNIPPET: [Provide the exact, complete, copy-pasteable replacement code, config file modifications, or terminal commands to resolve the issue]
3. ABSENT FILES BLUEPRINT: If a file is missing entirely, output the absolute path where it must live and the full initial template content.
