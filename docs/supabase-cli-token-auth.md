# Supabase CLI Token Auth

This repo is already linked to the live Supabase project through:

- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/supabase/.temp/project-ref`

So the missing piece for CLI use is local authentication, not project linking.

## One-Time Setup

Create:

- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/.env.supabase.local`

Example contents:

```bash
SUPABASE_ACCESS_TOKEN=your_supabase_access_token_here
SUPABASE_DB_PASSWORD=your_database_password_here
```

Notes:

- `SUPABASE_ACCESS_TOKEN` is required.
- `SUPABASE_DB_PASSWORD` is recommended for `db push`.
- `.env.*` is already gitignored, so this file stays local.

## Where to get the token

Create a personal access token from the Supabase dashboard, then paste it into `SUPABASE_ACCESS_TOKEN`.

## Commands

List linked migrations:

```bash
cd /Users/oquendoproductions/Desktop/streetlight-app/streetlight-web
npm run supabase:migration:list
```

Push migrations to the linked project:

```bash
cd /Users/oquendoproductions/Desktop/streetlight-app/streetlight-web
npm run supabase:db:push
```

## Why this wrapper exists

The helper scripts:

- load `SUPABASE_ACCESS_TOKEN` from `.env.supabase.local`
- avoid depending on a browser-based `supabase login`
- avoid the local `~/.supabase` permission issues by running with a writable temporary home

## Helper scripts

- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/scripts/run-supabase.sh`
- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/scripts/supabase-db-push.sh`
