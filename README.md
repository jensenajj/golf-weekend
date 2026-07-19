# Golf Weekend

Score tracking, handicaps, matchups, and a dashboard for the weekend: Friday AM/PM,
Saturday AM/PM, Sunday AM. The two PM rounds are scrambles (team score only, no
individual scoring); the three AM rounds are individually scored, hole-by-hole.

There is no login system — it's a private app for a trip with 8 people, meant to be
reached via an unguessable URL. Anyone with the link can play any player's scores and
use the Admin panel. Don't reuse this Supabase project for anything else, and don't
point the anon key it uses at any schema with real personal data.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), create a free account/project.
2. In the project, open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the tables,
   seeds the 5 rounds, and sets up RLS policies that allow the app's anon key to read
   and write everything (see note above on why that's an intentional tradeoff here).
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon
   public** key.

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the values
from step 1.

## 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4. Add players and matchups

In the **Admin** tab: add the 8 players with their handicaps, then build matchups/
teams per round. Each player picks their own name once from the header ("Playing as")
and it's remembered on their phone (localStorage) — they use the **Score** tab to
enter their own hole-by-hole scores for the three individual rounds. Admin can edit
anyone's scores under Admin → Edit Scores, and can enter scramble team scores under
Admin → Matchups.

Scoring: net round score = gross strokes − handicap, applied per round. The dashboard
leaderboard sums net score across the individual rounds that have been started.

## 5. Deploy

Push this repo to GitHub, then import it on [vercel.com/new](https://vercel.com/new).
Add the same two `NEXT_PUBLIC_SUPABASE_*` environment variables in the Vercel project
settings. Share the resulting `*.vercel.app` URL with the group.
