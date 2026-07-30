# Travel intelligence services

Anchorage keeps Google web-service credentials behind Supabase Edge Functions.
The browser only sends bounded coordinates and search intent.

## Functions

### `compute-route`

Accepts an origin, destination, up to ten intermediate coordinates and one
travel mode. It returns normalized distance, duration, encoded route geometry,
legs and navigation steps.

The ten-stop limit is intentional: Google prices route requests with eleven or
more intermediate waypoints at a higher tier. Transit requests reject
intermediates because the Routes API does not support them.

Each thread records the travel mode into every stop and from its final stop to
the next anchor. Continuous walking legs are grouped into one efficient request;
transit legs are requested separately because Google does not accept transit
waypoints. Transit legs can explicitly prefer bus, subway, train, light rail or
the broader rail family rather than collapsing every service into one generic
mode. Until a response arrives, the map retains its composed geometry. If the
provider has no transit geometry, a destination pack can supply a
source-verified path through known stations. Anchorage labels that line
verified rather than live; it never substitutes a road shape for a train.
An explicitly bus-only leg may use road-aligned driving geometry as a visibly
estimated fallback because both services follow the street network.
Successful walking legs still render against the live street network.

Route provenance and route priority are separate visual concerns. The map uses
weight and casing to emphasize the current leg; every upcoming leg retains the
same substantial opacity regardless of how far ahead it occurs. All modes share
one solid, continuous thread on the map. Mode, live/verified/estimated
confidence and provider navigation steps remain available in the detail layer
instead of competing with the journey itself.

### `search-places`

Accepts one focused text query and either:

- a coordinate and search radius; or
- an encoded route polyline for search-along-route.

`detailLevel: "discovery"` requests only identity, category, location and map
link fields. `detailLevel: "operational"` explicitly adds opening hours,
ratings, price and website fields, which use a more expensive Places SKU.

Raw search results are not rendered as Anchorage opportunities. They must pass
the deterministic feasibility, evidence and taste-scoring pipeline first.

## Security posture

- `GOOGLE_MAPS_SERVER_API_KEY` exists only in Supabase Function secrets.
- Request bodies are size-limited and structurally validated.
- Field masks are fixed server-side; the caller cannot increase the data or
  billing scope.
- Route requests are not cached because they contain precise location.
- Upstream errors are normalized and never return the provider key or raw
  response.
- During the personal build, functions accept this project's publishable key
  or a user session. Before public launch, change them to user-only auth and add
  per-user rate limiting.

## Deployment

The local `.env` is not uploaded to Supabase. Add
`GOOGLE_MAPS_SERVER_API_KEY` in the project's **Edge Function Secrets**
dashboard before invoking the deployed functions.

The Supabase GitHub integration deploys Edge Functions declared in
`supabase/config.toml` when **Deploy to production** is enabled. The repository
working directory should be `.` because `supabase/` is at the repository root.

## Verification

```bash
npx supabase@2.110.0 functions serve --env-file .env
npx deno@2.1.14 check --config supabase/functions/deno.json \
  supabase/functions/compute-route/index.ts \
  supabase/functions/search-places/index.ts
```

Local serving requires `supabase start` and Docker. Provider contract checks can
also be run against the Google endpoints without exposing key values.
