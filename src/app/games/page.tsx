"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAll, FullData } from "@/lib/data";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { COURSES } from "@/lib/courseData";
import { effectiveHandicap, strokesReceived } from "@/lib/handicap";

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

type MatchSide = {
  label: string;
  byHole: (number | null)[]; // index 0 = hole 1
};

type MatchResult = {
  ptsA: number;
  ptsB: number;
  holeWinners: ("A" | "B" | "T" | null)[];
};

function scoreMatch(a: MatchSide, b: MatchSide): MatchResult {
  let ptsA = 0;
  let ptsB = 0;
  const holeWinners: ("A" | "B" | "T" | null)[] = HOLES.map((_, i) => {
    const va = a.byHole[i];
    const vb = b.byHole[i];
    if (va == null || vb == null) return null;
    if (va < vb) {
      ptsA += 1;
      return "A";
    }
    if (vb < va) {
      ptsB += 1;
      return "B";
    }
    ptsA += 0.5;
    ptsB += 0.5;
    return "T";
  });
  return { ptsA, ptsB, holeWinners };
}

function MatchTable({ a, b }: { a: MatchSide; b: MatchSide }) {
  const result = scoreMatch(a, b);
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="text-sm">
        <thead className="bg-neutral-900 text-neutral-400">
          <tr>
            <th className="min-w-[110px] px-2 py-1.5 text-left sticky left-0 bg-neutral-900">
              &nbsp;
            </th>
            {HOLES.map((h) => (
              <th key={h} className="min-w-[32px] px-1 py-1.5 text-center">
                {h}
              </th>
            ))}
            <th className="min-w-[48px] px-2 py-1.5 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {[a, b].map((side, idx) => (
            <tr key={side.label} className="border-t border-neutral-800">
              <td className="px-2 py-1.5 text-left font-medium sticky left-0 bg-neutral-950">
                {side.label}
              </td>
              {side.byHole.map((v, i) => {
                const winner = result.holeWinners[i];
                const won = winner === (idx === 0 ? "A" : "B");
                const tied = winner === "T";
                return (
                  <td
                    key={i}
                    className={`px-1 py-1.5 text-center ${
                      won
                        ? "bg-emerald-500/15 font-semibold text-emerald-300"
                        : tied
                          ? "bg-neutral-700/30"
                          : ""
                    }`}
                  >
                    {v ?? "–"}
                  </td>
                );
              })}
              <td className="px-2 py-1.5 text-center font-semibold">
                {idx === 0 ? result.ptsA : result.ptsB}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GamesPage() {
  const [data, setData] = useState<FullData | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAll().then((d) => {
      setData(d);
      setRoundId((prev) => prev ?? (d.rounds.length > 0 ? d.rounds[0].id : null));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(
    ["rounds", "groups", "group_members", "carts", "cart_members", "hole_scores", "round_handicaps"],
    load
  );

  if (!data) return <p className="text-neutral-400">Loading…</p>;

  const round = data.rounds.find((r) => r.id === roundId) ?? null;
  const course = round?.course ? COURSES[round.course] : undefined;

  function holeHandicap(hole: number) {
    return course?.holes.find((h) => h.hole === hole)?.handicap ?? null;
  }

  function netFor(playerId: string, hole: number): number | null {
    if (!round) return null;
    const row = data!.holeScores.find(
      (s) => s.round_id === round.id && s.player_id === playerId && s.hole === hole
    );
    if (row == null) return null;
    const player = data!.players.find((p) => p.id === playerId);
    if (!player) return null;
    const hcp = effectiveHandicap(player.id, player.handicap, round.id, data!.roundHandicaps);
    return row.strokes - strokesReceived(hcp, holeHandicap(hole));
  }

  function bestBallByHole(playerIds: string[], n: number): (number | null)[] {
    return HOLES.map((h) => {
      const nets = playerIds
        .map((id) => netFor(id, h))
        .filter((v): v is number => v != null)
        .sort((x, y) => x - y);
      if (nets.length === 0) return null;
      return nets.slice(0, n).reduce((sum, v) => sum + v, 0);
    });
  }

  const roundGroups = round
    ? data.groups.filter((g) => g.round_id === round.id).sort((a, b) => a.sort_order - b.sort_order)
    : [];

  const hasHandicapData = course ? course.holes.every((h) => h.handicap != null) : false;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto">
        {data.rounds.map((r) => (
          <button
            key={r.id}
            onClick={() => setRoundId(r.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              roundId === r.id
                ? "bg-emerald-600 text-white"
                : "bg-neutral-800 text-neutral-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {!round ? null : round.format !== "individual" ? (
        <p className="text-sm text-neutral-500">
          Match play games apply to individually-scored rounds only — {round.label} is a
          scramble.
        </p>
      ) : !course ? (
        <p className="text-sm text-amber-400">No yardage data found for &quot;{round.course}&quot;.</p>
      ) : !hasHandicapData ? (
        <p className="text-sm text-amber-400">
          {`Hole handicaps aren't set for ${round.course} yet, so per-hole net scores (and therefore these games) aren't available. Add them via the course data first.`}
        </p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Group vs Group — best 2 net balls of 4
            </h2>
            {roundGroups.length !== 2 ? (
              <p className="text-sm text-neutral-500">
                Needs exactly 2 groups for this round (found {roundGroups.length}) — set them
                up in Admin → Matchups.
              </p>
            ) : (
              <MatchTable
                a={{
                  label: roundGroups[0].name,
                  byHole: bestBallByHole(
                    data.groupMembers
                      .filter((m) => m.group_id === roundGroups[0].id)
                      .map((m) => m.player_id),
                    2
                  ),
                }}
                b={{
                  label: roundGroups[1].name,
                  byHole: bestBallByHole(
                    data.groupMembers
                      .filter((m) => m.group_id === roundGroups[1].id)
                      .map((m) => m.player_id),
                    2
                  ),
                }}
              />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Cart vs Cart — best net ball
            </h2>
            {roundGroups.map((g) => {
              const groupCarts = data.carts
                .filter((c) => c.group_id === g.id)
                .sort((a, b) => a.sort_order - b.sort_order);
              return (
                <div key={g.id} className="space-y-1.5">
                  <p className="text-sm font-medium text-neutral-300">{g.name}</p>
                  {groupCarts.length !== 2 ? (
                    <p className="text-sm text-neutral-500">
                      Needs exactly 2 carts (found {groupCarts.length}) — assign them in
                      Admin → Matchups.
                    </p>
                  ) : (
                    <MatchTable
                      a={{
                        label: groupCarts[0].name,
                        byHole: bestBallByHole(
                          data.cartMembers
                            .filter((m) => m.cart_id === groupCarts[0].id)
                            .map((m) => m.player_id),
                          1
                        ),
                      }}
                      b={{
                        label: groupCarts[1].name,
                        byHole: bestBallByHole(
                          data.cartMembers
                            .filter((m) => m.cart_id === groupCarts[1].id)
                            .map((m) => m.player_id),
                          1
                        ),
                      }}
                    />
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
