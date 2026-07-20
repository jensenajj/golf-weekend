"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAll, FullData } from "@/lib/data";
import { grossTotal, netScore } from "@/lib/scoring";
import { effectiveHandicap } from "@/lib/handicap";
import { scrambleHolesEntered, scrambleToPar } from "@/lib/scramble";
import { COURSES } from "@/lib/courseData";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { Player, Round } from "@/lib/types";

type ScoreMode = "net" | "gross";

type PlayerLine = {
  player: Player;
  perRound: Record<string, { gross: number; holes: number; net: number; handicap: number } | null>;
  totalNet: number;
  totalGross: number;
  roundsStarted: number;
};

function buildLeaderboard(data: FullData, mode: ScoreMode): PlayerLine[] {
  const individualRounds = data.rounds.filter((r) => r.format === "individual");

  return data.players
    .map((player) => {
      const perRound: PlayerLine["perRound"] = {};
      let totalNet = 0;
      let totalGross = 0;
      let roundsStarted = 0;

      for (const round of individualRounds) {
        const scores = data.holeScores.filter(
          (s) => s.round_id === round.id && s.player_id === player.id
        );
        if (scores.length === 0) {
          perRound[round.id] = null;
          continue;
        }
        const handicap = effectiveHandicap(player.id, player.handicap, round.id, data.roundHandicaps);
        const gross = grossTotal(scores);
        const net = netScore(gross, handicap);
        perRound[round.id] = { gross, holes: scores.length, net, handicap };
        totalNet += net;
        totalGross += gross;
        roundsStarted += 1;
      }

      return { player, perRound, totalNet, totalGross, roundsStarted };
    })
    .sort((a, b) => {
      if (a.roundsStarted === 0 && b.roundsStarted === 0) return 0;
      if (a.roundsStarted === 0) return 1;
      if (b.roundsStarted === 0) return -1;
      return mode === "net" ? a.totalNet - b.totalNet : a.totalGross - b.totalGross;
    });
}

function RoundBadge({ round }: { round: Round }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        round.format === "scramble"
          ? "bg-purple-900/60 text-purple-200"
          : "bg-emerald-900/60 text-emerald-200"
      }`}
    >
      {round.format === "scramble" ? "Scramble" : "Individual"}
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<FullData | null>(null);
  const [mode, setMode] = useState<ScoreMode>("net");

  const load = useCallback(() => {
    fetchAll().then(setData);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(
    ["hole_scores", "scramble_scores", "players", "groups", "group_members", "round_handicaps"],
    load
  );

  if (!data) {
    return <p className="text-neutral-400">Loading…</p>;
  }

  if (data.players.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-neutral-300">
          No players yet. Head to Admin to add the 8 players and their
          handicaps.
        </p>
      </div>
    );
  }

  const leaderboard = buildLeaderboard(data, mode);
  const individualRounds = data.rounds.filter((r) => r.format === "individual");

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Leaderboard
          </h2>
          <div className="flex gap-1 rounded-full bg-neutral-800 p-0.5">
            {(["net", "gross"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  mode === m
                    ? "bg-emerald-600 text-white"
                    : "text-neutral-400"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Player</th>
                <th className="px-3 py-2 text-right font-medium">Hcp</th>
                {individualRounds.map((r) => (
                  <th key={r.id} className="px-3 py-2 text-right font-medium">
                    {r.day.slice(0, 3)} {r.session}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium capitalize">
                  Total {mode}
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(({ player, perRound, totalNet, totalGross, roundsStarted }, i) => (
                <tr
                  key={player.id}
                  className={i % 2 === 0 ? "bg-neutral-950" : "bg-neutral-900/40"}
                >
                  <td className="px-3 py-2 font-medium">{player.name}</td>
                  <td className="px-3 py-2 text-right text-neutral-400">
                    {player.handicap}
                  </td>
                  {individualRounds.map((r) => {
                    const cell = perRound[r.id];
                    return (
                      <td key={r.id} className="px-3 py-2 text-right text-neutral-300">
                        {cell ? (
                          <span
                            title={`${cell.holes}/18 holes, gross ${cell.gross}, net ${cell.net}, hcp used ${cell.handicap}`}
                          >
                            {mode === "net" ? cell.net : cell.gross}
                            {cell.holes < 18 && (
                              <span className="text-neutral-500">*</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-neutral-600">–</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-semibold">
                    {roundsStarted > 0 ? (mode === "net" ? totalNet : totalGross) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Net = gross strokes − handicap, applied per round. * = round in progress (fewer than 18
          holes entered). The Hcp column is each player&apos;s current handicap — once a round
          starts, that round locks in whatever handicap was set at the time (hover a score to see
          it), so later handicap changes only affect rounds that haven&apos;t started yet.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Rounds &amp; Matchups
        </h2>
        <div className="space-y-3">
          {data.rounds.map((round) => {
            const groups = data.groups
              .filter((g) => g.round_id === round.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            const course = round.course ? COURSES[round.course] : undefined;
            return (
              <div
                key={round.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">
                    {round.label}
                    {round.course && (
                      <span className="ml-2 text-xs font-normal text-neutral-500">
                        {round.course}
                      </span>
                    )}
                  </span>
                  <RoundBadge round={round} />
                </div>
                {groups.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    No matchups set yet.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm text-neutral-300">
                    {groups.map((g) => {
                      const members = data.groupMembers
                        .filter((m) => m.group_id === g.id)
                        .map(
                          (m) =>
                            data.players.find((p) => p.id === m.player_id)?.name
                        )
                        .filter(Boolean);
                      const toPar =
                        round.format === "scramble"
                          ? scrambleToPar(data, round, course, g.id)
                          : null;
                      const holesIn =
                        round.format === "scramble" ? scrambleHolesEntered(data, g.id) : 0;
                      return (
                        <li key={g.id} className="flex justify-between">
                          <span>
                            <span className="text-neutral-500">{g.name}:</span>{" "}
                            {members.join(", ") || "—"}
                          </span>
                          {round.format === "scramble" && toPar != null && (
                            <span className="font-medium text-neutral-100">
                              {toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : toPar}
                              <span className="text-neutral-500"> ({holesIn}/18)</span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
