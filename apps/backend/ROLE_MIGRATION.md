# WRITER role: migration + deploy notes

The app now supports READER / WRITER / ADMIN. The backend code in this repo
(`apps/backend/app.runtime.js` + `b64_*.txt` parts) already contains the new
role and routes. Two manual steps put it live: migrate the database enum,
then redeploy the backend.

## 1. Migrate the production database (one statement, non-destructive)

This only adds a value to the `Role` enum. It rewrites no tables and changes
no existing rows (everyone keeps their current role).

Run against the production Postgres (Render dashboard -> database -> Connect,
or any psql with `DATABASE_URL`):

```sql
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'WRITER';
```

Verify:

```sql
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'Role';
-- expect: READER, WRITER, ADMIN
```

If you prefer Prisma instead of raw SQL (same effect):

```bash
npx prisma db push --schema=packages/db/prisma/schema.prisma
```

## 2. Redeploy the backend on Render

- Push this repo state to the branch Render deploys from, or use Render's
  Manual Deploy -> Deploy latest commit for the `storynest-qzwm` service.
- No new environment variables are needed.

## 3. What the new backend code adds

- `POST /auth/register` accepts `accountType: "writer"` (READER stays default;
  nothing can self-assign ADMIN).
- `POST /users/me/role` lets a READER self-upgrade to WRITER and returns fresh
  tokens carrying the new role.
- `POST /stories` is open to WRITER + ADMIN (was ADMIN only).
- `DELETE /stories/:id` (owner or ADMIN, ordered cascade).
- `GET /stories/:id/chapters`, `PUT /chapters/:id`, `DELETE /chapters/:id`
  (owner or ADMIN).
- `GET /admin/my-stories`, `GET /admin/stats` (own data for writers, all data
  for admins).

## 4. Rollback

- Code: redeploy the previous commit.
- Database: Postgres cannot drop an enum value in use; leaving the unused
  `WRITER` value in place is harmless.
