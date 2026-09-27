# Prior Family Survivor

Mobile-first private NFL Survivor Pick'em app for a family league. The rules include double elimination, no team reuse during a season, Thursday noon Central lock deadlines, hidden picks before lock, playoffs, commissioner corrections, and the all-survivors-loss rule.

## Current Status

The main hosted path is now a React/Vite app intended to run on GitHub Pages at `/survivor-pickem/` and persist shared league state through Supabase Edge Functions and PostgreSQL. The first production slice supports PIN login, session tokens, shared dashboard/standings reads, pick options, and current-week pick submission.

Result processing, NFL schedule/result sync, commissioner tools, and full history views are still follow-up functionality.

## Architecture

GitHub Pages hosts the React app. The browser calls Supabase Edge Functions. Edge Functions use service-role access to PostgreSQL for authentication, pick validation, hidden-pick filtering, NFL sync, result processing, and admin operations.

The browser must never receive another player's hidden pick before the deadline, and it must never be trusted to enforce deadlines, used-team rules, strikes, or admin status.

## Local Development

Install Node 20 or newer, then run:

```bash
npm install
npm run dev
```

Run checks:

```bash
npm test
npm run build
```

Node/npm are not installed in the current coding container, so these commands could not be executed here.

## Supabase Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` locally.
4. Apply `supabase/migrations/001_initial_schema.sql`.
5. Apply `supabase/seed.sql` to create the first league, 2026 season, Week 1, teams, and demo players.
6. Deploy Edge Functions from `supabase/functions`.
7. In Supabase function secrets, set `SUPABASE_SERVICE_ROLE_KEY`. `SYNC_SECRET` and `NFL_PROVIDER_KEY` are still reserved for the later NFL sync path.

Required server-side secrets:

```text
SUPABASE_SERVICE_ROLE_KEY
SYNC_SECRET
NFL_PROVIDER_KEY
```

## First Commissioner

Bootstrap the first admin through a private SQL/CLI process after migrations are applied. Do not expose a public "make me admin" endpoint. Store only a secure PIN hash, then create the player as `is_admin = true`.

## GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` builds this app and publishes it under:

```text
https://priormi.github.io/survivor-pickem/
```

In GitHub, enable Pages from GitHub Actions. Add repository variables, not server secrets, for the browser config:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

The workflow publishes the Vite build output from `dist`. The app uses hash routing so routes refresh safely on GitHub Pages.

## NFL Sync

The workflow at `.github/workflows/sync-nfl.yml` invokes a protected `sync-nfl` Edge Function using `SYNC_SECRET`. It is scheduled more frequently on common NFL game days and can also be run manually.

## Rules Implemented in Tests

The pure rules module currently tests:

- win and tie produce no strike
- loss and no pick produce one strike
- second strike eliminates a player
- the all-survivors-loss rule waives elimination-causing strikes
- used teams cannot be selected again
- deadline checks compare timestamps

## Demo PINs

The static demo includes development-only PINs:

```text
Mike: 1234
Heather: 2222
Chloe: 3333
Sophia: 4444
```

Production PINs must be hashed server-side and never committed as plaintext.
