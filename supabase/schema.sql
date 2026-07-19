-- Golf weekend app schema
-- Run this in the Supabase project's SQL Editor (Database > SQL Editor > New query).

create extension if not exists "pgcrypto";

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  handicap numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  day text not null,
  session text not null check (session in ('AM', 'PM')),
  format text not null check (format in ('individual', 'scramble')),
  sort_order int not null
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  name text not null,
  team_score int,
  sort_order int not null default 0
);

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (group_id, player_id)
);

create table if not exists hole_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  hole int not null check (hole between 1 and 18),
  strokes int not null check (strokes > 0),
  updated_at timestamptz not null default now(),
  unique (round_id, player_id, hole)
);

-- Seed the fixed weekend schedule (safe to re-run).
insert into rounds (label, day, session, format, sort_order)
values
  ('Friday AM', 'Friday', 'AM', 'individual', 1),
  ('Friday PM', 'Friday', 'PM', 'scramble', 2),
  ('Saturday AM', 'Saturday', 'AM', 'individual', 3),
  ('Saturday PM', 'Saturday', 'PM', 'scramble', 4),
  ('Sunday AM', 'Sunday', 'AM', 'individual', 5)
on conflict do nothing;

-- Seed the 8 players (handicaps default to 0 — set the real values in Admin).
insert into players (name, handicap)
values
  ('Jensen', 0),
  ('Pickels', 0),
  ('Quinn', 0),
  ('Jaren', 0),
  ('Steve', 0),
  ('Riley', 0),
  ('Cheaty', 0),
  ('Cheese', 0)
on conflict do nothing;

-- Row Level Security.
-- This app has no login system by design (private trip, unguessable URL).
-- These policies grant the public anon key full read/write on every table,
-- which is what lets any player's phone read and write shared data without
-- an account. Do not point a shared/production anon key with real user data
-- at this schema, and don't reuse this Supabase project for anything else.
alter table players enable row level security;
alter table rounds enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table hole_scores enable row level security;

drop policy if exists "public_all_players" on players;
create policy "public_all_players" on players for all using (true) with check (true);

drop policy if exists "public_all_rounds" on rounds;
create policy "public_all_rounds" on rounds for all using (true) with check (true);

drop policy if exists "public_all_groups" on groups;
create policy "public_all_groups" on groups for all using (true) with check (true);

drop policy if exists "public_all_group_members" on group_members;
create policy "public_all_group_members" on group_members for all using (true) with check (true);

drop policy if exists "public_all_hole_scores" on hole_scores;
create policy "public_all_hole_scores" on hole_scores for all using (true) with check (true);
