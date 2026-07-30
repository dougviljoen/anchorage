# Anchorage architecture

Anchorage is a contextual recommendation system with a deliberately small user
surface. The design separates facts, deterministic judgment, and language so
that the interface can feel effortless without becoming unaccountable.

## Core flow

1. Destination research creates a bounded pack of places and events.
2. Source records preserve where each operational claim came from and when it
   was checked.
3. Context adapters resolve current location, weather, daylight, opening
   windows, routing, the next anchor, and the traveller's available energy.
4. The opportunity engine removes infeasible options and scores the remainder.
5. A thread assembler builds geographically coherent two-to-five-hour routes.
6. The server-side composition function gives those verified facts a concise
   theme and explanation.
7. Impressions and journal signals improve the user's taste portrait.

The model never chooses whether a closed place is open or invents route facts.
It receives a complete factual snapshot and produces strict structured copy.

## Boundaries

- `src/domain` contains portable product types and deterministic logic.
- `src/data` implements repositories. UI code never knows whether data came from
  demo fixtures, Supabase, or an offline cache.
- `src/features/map` owns the map camera, spatial overlays and the adaptive
  context sheet.
- `supabase/migrations` is the durable relational and geospatial model.
- `supabase/functions` owns secret-bearing integrations and AI composition.

Routes and Places are separate bounded capabilities. The route service returns
geometry and operational steps; the place service discovers candidates around
a point or along an encoded route. Place results do not bypass the opportunity
engine simply because Google returned them. See
[`travel-intelligence.md`](travel-intelligence.md).

## Spatial interaction model

The map is the durable application surface rather than a destination page.
Routes change meaning without changing primitives:

- **Field** frames the traveller, the next fixed anchor and three timely
  possibilities.
- **Thread** replaces glints with an ordered route and stop markers.
- **Journey** zooms out to show completed and open travel between bases.
- **Memory** attaches selective observations to the travelled geography.

The adaptive sheet explains what is spatially visible. It may expand, collapse
or change mode, but it does not replace the map. Device location is requested
only through an explicit bearing action; trip preview coordinates keep the
experience useful before permission is granted.

Map styling defaults to a source-controlled embedded style so the product can
guarantee sufficient restraint. A cloud style can replace it when an equivalent
Google style is associated with the production Map ID.

Basemap names are off by default. A device-local display preference can restore
geographic and road labels when the traveller needs more context; business POI
labels remain suppressed so selected Anchorage places retain priority.

## Evidence model

Operational claims are associated with a source, confidence and verification
time. A generated thread stores the exact factual snapshot used to create it,
its score components, generation time and expiry. This makes stale guidance
detectable and recommendations auditable.

## Recommendation model

Hard constraints run first:

- the place can be reached and used inside its opening window;
- the route returns before the next fixed anchor;
- transport and walking fit the current limits;
- required booking or availability is satisfied.

Surviving candidates are scored for taste match, last-chance urgency, weather,
light, geographic convenience, travel friction, expected crowding, arrival
risk and evidence quality.

Opportunity margin compares the value of doing something now with the best
realistic future window. Radar only interrupts when that margin, personal
relevance and evidence quality are all high.

## Offline posture

The PWA shell and static assets are cached now. Before field use, the live
repository should cache the current base, held threads, anchor details, phrase
cards and last known route instructions in IndexedDB. Live operational data
should show its age whenever the network is unavailable.

## Security posture

- Browser code receives only the Supabase anonymous key and a hostname/API
  restricted Google browser key.
- OpenAI, Google Places/Routes and Supabase service-role credentials remain in
  Edge Function secrets.
- Row-level security owns all personal trip, taste and journal data.
- Public place research is written only by trusted server-side jobs.
