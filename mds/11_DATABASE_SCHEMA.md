# Database Schema

Keep the DB small.

## conversations

```sql
create table conversations (
  id uuid primary key,
  created_at timestamptz default now(),
  language text,
  origin_lat double precision,
  origin_lon double precision
);
```

## messages

```sql
create table messages (
  id uuid primary key,
  conversation_id uuid references conversations(id),
  role text not null,
  content text not null,
  structured_payload jsonb,
  created_at timestamptz default now()
);
```

## evidence

```sql
create table evidence (
  id uuid primary key,
  request_id uuid,
  variable text not null,
  value jsonb not null,
  unit text,
  source_name text not null,
  source_url text,
  freshness text not null,
  valid_from timestamptz,
  valid_to timestamptz,
  fetched_at timestamptz default now(),
  quality double precision,
  location geography(point, 4326)
);
```

## trips

```sql
create table trips (
  id uuid primary key,
  conversation_id uuid references conversations(id),
  departure_time timestamptz,
  origin geography(point, 4326),
  destination geography(point, 4326),
  status text,
  safety_score integer,
  opportunity_score integer,
  confidence double precision,
  decision jsonb,
  created_at timestamptz default now()
);
```

## geofences

```sql
create table geofences (
  id uuid primary key,
  name text not null,
  category text not null,
  severity text not null,
  source_name text,
  geometry geography(polygon, 4326)
);
```

## Optional tables

- `cached_provider_responses`
- `agent_runs`
- `saved_locations`

Do not spend Gateway time building an enterprise data model.
