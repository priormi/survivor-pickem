# Build Progress

## Phase 1 - Foundation

[x] Create project folder without disturbing existing root site files
[x] Add mobile-first hosted demo shell
[x] Add React/Vite/TypeScript project structure
[x] Add routing, app shell, navigation, and page placeholders
[x] Add shared types, API wrapper, auth/pick/league/admin service boundaries
[x] Add core Survivor rules utility and tests
[!] Run `npm install`, `npm test`, and `npm run build` locally - blocked because Node/npm are not installed in this container

## Phase 2 - Database

[x] Add initial Supabase schema migration with RLS enabled
[x] Add NFL teams seed data
[~] Add detailed RLS policies and SQL validation helpers

## Phase 3 - Authentication

[~] Add Edge Function shell for PIN login and hashed sessions
[ ] Implement bcrypt verification and session token hashing in Supabase

## Phase 4 - League / Season / Round APIs

[~] Add dashboard and pick-options Edge Function shells
[ ] Implement real database-backed responses

## Phase 5 - NFL Data

[ ] Implement provider adapter
[ ] Implement scheduled sync Edge Function

## Phase 6 - Picks

[~] Add submit-pick Edge Function shell
[ ] Implement transactional pick validation

## Phase 7 - Results Engine

[x] Implement tested pure all-survivors-loss rule logic
[~] Add process-round Edge Function shell
[ ] Persist idempotent results and deterministic recompute

## Phase 8 - Admin

[~] Add admin page and Edge Function shell
[ ] Implement commissioner workflows

## Phase 9 - History / Polish

[~] Add history, player history, and team usage routes
[ ] Connect routes to Supabase data

## Phase 10 - Deployment

[x] Add GitHub Pages workflow
[x] Add NFL sync workflow
[x] Prepare static `dist` output for Sites deployment
[x] Deploy static version to an accessible URL
[x] Prepare app for GitHub Pages subpath at `https://clubbinseals.com/survivor-pickem/`

Published URL:

```text
https://prior-family-survivor.priormike.chatgpt.site
```

GitHub Pages URL after pushing to `priormi/clubbinseals`:

```text
https://clubbinseals.com/survivor-pickem/
```
