# Architecture Decisions

## ADR-001: Hash Router for GitHub Pages

GitHub Pages does not automatically route deep links into a single-page React app. The app uses `HashRouter` so paths such as `/#/standings` refresh reliably without a custom fallback.

## ADR-002: Edge Functions Own Mutations

The browser never writes directly to protected tables for login, picks, results, admin actions, or hidden pick visibility. Supabase Edge Functions validate sessions and apply business rules with service-role access.

## ADR-003: Deterministic Result Processing

Round processing is modeled as a pure rules function first, then persisted by the server. Reprocessing should replay official picks and final game results in sequence instead of manually adding or subtracting strikes.

## ADR-004: Static Demo While Node Is Unavailable

This coding environment does not currently have Node/npm installed. A static `index.html` is included so the app can be reached through a URL immediately, while the React/Vite source, tests, and workflows are ready for a standard Node environment.
