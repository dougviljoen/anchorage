# Anchorage

A calm, context-aware companion for the space between plans.

## Run locally

The checked-in `.env` starts in demo mode, so no credentials are required.

```bash
npm install
npm run dev
```

Open `http://localhost:4173`.

## Environment

Fill the existing `.env` when you are ready to connect live services:

- Supabase project URL and publishable key
- Supabase secret key for server functions
- a website-restricted Google Maps JavaScript API key and Map ID
- a distinct server key restricted to Places API (New) and Routes API
- an OpenAI API key

Never expose server keys with a `VITE_` prefix. Legacy Supabase anon and
service-role keys remain supported as fallbacks. Open-Meteo does not require a
key. `.env.example` documents the same contract without secrets.

The app defaults to its source-controlled, low-noise embedded map style.
`VITE_GOOGLE_MAP_STYLE_MODE=cloud` opts into the style associated with the
configured Google Map ID once that cloud style is ready.

## Useful checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Structure

- `src/domain` — product language and deterministic recommendation logic
- `src/data` — replaceable data repositories
- `src/features/map` — the spatial Field, Journey and Memory experience
- `supabase` — PostGIS schema, row-level security and Edge Functions
- `docs` — architectural and product invariants

See [docs/architecture.md](docs/architecture.md) for the system boundaries and
[docs/product-principles.md](docs/product-principles.md) for the decisions the
interface should preserve. [docs/travel-intelligence.md](docs/travel-intelligence.md)
documents the Routes and Places function contracts and deployment boundary.

## WSL note

This checkout currently lives on `/mnt/c` while the project uses Linux Node and
npm inside WSL. It works, but dependency installation, builds and file watching
will be noticeably slower than in the WSL filesystem. Before active development,
prefer a fresh clone under a path such as `~/code/anchorage`; do not copy
`node_modules` across.
