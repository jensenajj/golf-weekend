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
  course text,
  tee text not null default 'Blue',
  sort_order int not null,
  unique (day, session)
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  name text not null,
  team_score int,
  -- The one player allowed to enter/edit gross scores for the whole group
  -- on the Scorecard view (self-claimed, or set here by admin).
  scorekeeper_id uuid references players(id) on delete set null,
  sort_order int not null default 0
);

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (group_id, player_id)
);

-- Carts subdivide a group (e.g. a foursome) into pairs for cart-vs-cart games.
create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table if not exists cart_members (
  cart_id uuid not null references carts(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (cart_id, player_id)
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

-- A player's handicap "locked in" for one specific round. Auto-created with
-- whatever players.handicap was at the moment of that player's first score
-- entry in the round (see lib/handicap.ts), so later changes to a player's
-- global handicap never retroactively change an already-played round's net
-- scores. Can also be set/overridden directly (e.g. from Admin) before or
-- after the round, independent of the global value and of other rounds.
create table if not exists round_handicaps (
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  handicap numeric not null,
  locked_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

-- Seed the fixed weekend schedule (safe to re-run).
insert into rounds (label, day, session, format, course, sort_order)
values
  ('Friday AM', 'Friday', 'AM', 'individual', 'Denison Golf Club', 1),
  ('Friday PM', 'Friday', 'PM', 'scramble', 'Denison Golf Club', 2),
  ('Saturday AM', 'Saturday', 'AM', 'individual', 'Virtues Golf Club', 3),
  ('Saturday PM', 'Saturday', 'PM', 'scramble', 'Virtues Golf Club', 4),
  ('Sunday AM', 'Sunday', 'AM', 'individual', 'Virtues Golf Club', 5)
on conflict (day, session) do nothing;

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
alter table carts enable row level security;
alter table cart_members enable row level security;
alter table hole_scores enable row level security;
alter table round_handicaps enable row level security;

drop policy if exists "public_all_players" on players;
create policy "public_all_players" on players for all using (true) with check (true);

drop policy if exists "public_all_rounds" on rounds;
create policy "public_all_rounds" on rounds for all using (true) with check (true);

drop policy if exists "public_all_groups" on groups;
create policy "public_all_groups" on groups for all using (true) with check (true);

drop policy if exists "public_all_group_members" on group_members;
create policy "public_all_group_members" on group_members for all using (true) with check (true);

drop policy if exists "public_all_carts" on carts;
create policy "public_all_carts" on carts for all using (true) with check (true);

drop policy if exists "public_all_cart_members" on cart_members;
create policy "public_all_cart_members" on cart_members for all using (true) with check (true);

drop policy if exists "public_all_hole_scores" on hole_scores;
create policy "public_all_hole_scores" on hole_scores for all using (true) with check (true);

drop policy if exists "public_all_round_handicaps" on round_handicaps;
create policy "public_all_round_handicaps" on round_handicaps for all using (true) with check (true);
