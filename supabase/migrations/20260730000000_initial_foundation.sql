create extension if not exists pgcrypto;
create schema if not exists extensions;
grant usage on schema extensions to public;
create extension if not exists postgis with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;

create type public.anchor_kind as enum (
  'stay',
  'reservation',
  'transport',
  'intention'
);

create type public.source_confidence as enum (
  'verified',
  'strong',
  'estimated'
);

create type public.taste_signal_kind as enum (
  'explicit',
  'accepted',
  'dismissed',
  'lingered',
  'journaled'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  home_timezone text not null default 'UTC',
  preferred_locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  country_code text not null check (char_length(country_code) = 2),
  starts_on date not null,
  ends_on date not null,
  timezone text not null,
  status text not null default 'draft'
    check (status in ('draft', 'researching', 'ready', 'active', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.bases (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  city text not null,
  region text,
  stay_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location extensions.geography(point, 4326) not null,
  arrival_notes text,
  sequence integer not null,
  created_at timestamptz not null default now(),
  unique (trip_id, sequence),
  check (ends_at > starts_at)
);

create table public.anchors (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  base_id uuid references public.bases(id) on delete set null,
  kind public.anchor_kind not null,
  title text not null,
  detail text,
  location_name text,
  location extensions.geography(point, 4326),
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_fixed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  canonical_url text not null unique,
  source_type text not null
    check (source_type in (
      'official',
      'tourism',
      'maps',
      'editorial',
      'retailer',
      'research'
    )),
  default_confidence public.source_confidence not null default 'strong',
  created_at timestamptz not null default now(),
  last_checked_at timestamptz
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  external_provider text,
  external_id text,
  name text not null,
  description text,
  category text not null,
  address text,
  location extensions.geography(point, 4326) not null,
  timezone text not null,
  business_status text,
  price_level smallint check (price_level between 0 and 4),
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index places_location_gix on public.places using gist (location);
create index places_category_idx on public.places (category);
create unique index places_provider_id_uidx
  on public.places (external_provider, external_id)
  where external_provider is not null and external_id is not null;

create table public.place_sources (
  place_id uuid not null references public.places(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  source_url text not null,
  confidence public.source_confidence not null,
  claims jsonb not null default '{}'::jsonb,
  verified_at timestamptz not null,
  primary key (place_id, source_id)
);

create table public.opening_windows (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'exception', 'cancelled', 'unknown')),
  source_id uuid references public.sources(id) on delete set null,
  verified_at timestamptz,
  check (closes_at > opens_at)
);

create index opening_windows_lookup_idx
  on public.opening_windows (place_id, opens_at, closes_at);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places(id) on delete set null,
  name text not null,
  description text,
  booking_url text,
  cost_note text,
  source_id uuid not null references public.sources(id) on delete restrict,
  source_url text not null,
  confidence public.source_confidence not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_occurrences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'sold_out', 'unknown')),
  check (ends_at > starts_at)
);

create index event_occurrences_time_idx
  on public.event_occurrences (starts_at, ends_at);

create table public.trip_places (
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  editorial_note text,
  relevance numeric(4, 3) check (relevance between 0 and 1),
  research_status text not null default 'candidate'
    check (research_status in ('candidate', 'reviewed', 'approved', 'rejected')),
  added_by text not null default 'research'
    check (added_by in ('research', 'user', 'editor')),
  created_at timestamptz not null default now(),
  primary key (trip_id, place_id)
);

create table public.taste_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  kind public.taste_signal_kind not null,
  subject text not null,
  weight numeric(5, 3) not null check (weight between -1 and 1),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index taste_signals_user_idx
  on public.taste_signals (user_id, created_at desc);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  base_id uuid references public.bases(id) on delete set null,
  next_anchor_id uuid references public.anchors(id) on delete set null,
  mode text not null check (mode in ('drift', 'follow', 'go')),
  status text not null default 'suggested'
    check (status in ('suggested', 'held', 'started', 'completed', 'dismissed')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  score integer not null check (score between 0 and 100),
  opportunity_margin integer not null,
  score_components jsonb not null,
  factual_snapshot jsonb not null,
  narrative jsonb not null,
  generated_at timestamptz not null default now(),
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (valid_until >= generated_at)
);

create index threads_active_trip_idx
  on public.threads (trip_id, valid_until desc);

create table public.thread_stops (
  thread_id uuid not null references public.threads(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete restrict,
  sequence integer not null,
  arrives_at timestamptz not null,
  departs_at timestamptz not null,
  travel_minutes_from_previous integer not null default 0
    check (travel_minutes_from_previous >= 0),
  route_facts jsonb not null default '{}'::jsonb,
  primary key (thread_id, sequence),
  unique (thread_id, place_id),
  check (departs_at > arrives_at)
);

create table public.recommendation_impressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete set null,
  radar_signal jsonb,
  action text not null
    check (action in ('shown', 'opened', 'held', 'dismissed', 'started', 'completed')),
  context_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete set null,
  place_id uuid references public.places(id) on delete set null,
  occurred_at timestamptz not null,
  observation text not null,
  object_note text,
  media_path text,
  location extensions.geography(point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Foreign keys are not indexed automatically in PostgreSQL. These indexes also
-- support the ownership checks and cascade paths that dominate this schema.
create index trips_user_id_idx on public.trips (user_id);
create index anchors_trip_id_idx on public.anchors (trip_id);
create index anchors_base_id_idx on public.anchors (base_id);
create index place_sources_source_id_idx on public.place_sources (source_id);
create index opening_windows_source_id_idx on public.opening_windows (source_id);
create index events_place_id_idx on public.events (place_id);
create index events_source_id_idx on public.events (source_id);
create index event_occurrences_event_id_idx on public.event_occurrences (event_id);
create index trip_places_place_id_idx on public.trip_places (place_id);
create index taste_signals_trip_id_idx on public.taste_signals (trip_id);
create index taste_signals_place_id_idx on public.taste_signals (place_id);
create index threads_base_id_idx on public.threads (base_id);
create index threads_next_anchor_id_idx on public.threads (next_anchor_id);
create index thread_stops_place_id_idx on public.thread_stops (place_id);
create index recommendation_impressions_user_time_idx
  on public.recommendation_impressions (user_id, created_at desc);
create index recommendation_impressions_trip_id_idx
  on public.recommendation_impressions (trip_id);
create index recommendation_impressions_thread_id_idx
  on public.recommendation_impressions (thread_id);
create index journal_entries_user_time_idx
  on public.journal_entries (user_id, occurred_at desc);
create index journal_entries_trip_id_idx on public.journal_entries (trip_id);
create index journal_entries_thread_id_idx on public.journal_entries (thread_id);
create index journal_entries_place_id_idx on public.journal_entries (place_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger trips_set_updated_at
before update on public.trips
for each row execute function private.set_updated_at();

create trigger anchors_set_updated_at
before update on public.anchors
for each row execute function private.set_updated_at();

create trigger places_set_updated_at
before update on public.places
for each row execute function private.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute function private.set_updated_at();

create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row execute function private.set_updated_at();

create or replace function private.owns_trip(candidate_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips
    where id = candidate_trip_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.owns_trip(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.owns_trip(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.bases enable row level security;
alter table public.anchors enable row level security;
alter table public.sources enable row level security;
alter table public.places enable row level security;
alter table public.place_sources enable row level security;
alter table public.opening_windows enable row level security;
alter table public.events enable row level security;
alter table public.event_occurrences enable row level security;
alter table public.taste_signals enable row level security;
alter table public.trip_places enable row level security;
alter table public.threads enable row level security;
alter table public.thread_stops enable row level security;
alter table public.recommendation_impressions enable row level security;
alter table public.journal_entries enable row level security;

create policy "Users manage their profile"
on public.profiles for all
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users manage their trips"
on public.trips for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage bases in their trips"
on public.bases for all
to authenticated
using ((select private.owns_trip(trip_id)))
with check ((select private.owns_trip(trip_id)));

create policy "Users manage anchors in their trips"
on public.anchors for all
to authenticated
using ((select private.owns_trip(trip_id)))
with check ((select private.owns_trip(trip_id)));

create policy "Authenticated users read sources"
on public.sources for select
to authenticated
using (true);

create policy "Authenticated users read places"
on public.places for select
to authenticated
using (true);

create policy "Authenticated users read place evidence"
on public.place_sources for select
to authenticated
using (true);

create policy "Authenticated users read opening windows"
on public.opening_windows for select
to authenticated
using (true);

create policy "Authenticated users read events"
on public.events for select
to authenticated
using (true);

create policy "Authenticated users read event occurrences"
on public.event_occurrences for select
to authenticated
using (true);

create policy "Users manage their taste signals"
on public.taste_signals for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users read researched places for their trips"
on public.trip_places for select
to authenticated
using ((select private.owns_trip(trip_id)));

create policy "Users read and update their threads"
on public.threads for all
to authenticated
using ((select private.owns_trip(trip_id)))
with check ((select private.owns_trip(trip_id)));

create policy "Users read stops in their threads"
on public.thread_stops for select
to authenticated
using (
  exists (
    select 1
    from public.threads
    where public.threads.id = thread_stops.thread_id
      and (select private.owns_trip(public.threads.trip_id))
  )
);

create policy "Users manage their recommendation history"
on public.recommendation_impressions for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their journal"
on public.journal_entries for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
