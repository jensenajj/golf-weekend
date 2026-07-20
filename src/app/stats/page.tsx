"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAll, FullData } from "@/lib/data";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { ScoreMode, computePlayerStats } from "@/lib/stats";

function fmt(v: number | null): string {
  return v == null ? "–" : v.toFixed(1);
}

export default function StatsPage() {
  const [data, setData] = useState<FullData | null>(null);
  const [mode, setMode] = useState<ScoreMode>("gross");

  const load = useCallback(() => {
    fetchAll().then(setData);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(["hole_scores", "players", "round_handicaps"], load);

  if (!data) return <p className="text-neutral-400">Loading…</p>;

  if (data.players.length === 0) {
    return <p className="text-neutral-300">No players yet — add them in Admin.</p>;
  }

  const stats = computePlayerStats(data, mode).sort((a, b) => {
    if (a.avgScore == null && b.avgScore == null) return 0;
    if (a.avgScore == null) return 1;
    if (b.avgScore == null) return -1;
    return a.avgScore - b.avgScore;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Scoring Stats
        </h2>
        <div className="flex gap-1 rounded-full bg-neutral-800 p-0.5">
          {(["gross", "net"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                mode === m ? "bg-emerald-600 text-white" : "text-neutral-400"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Player</th>
              <th className="px-3 py-2 text-right font-medium">Rounds</th>
              <th className="px-3 py-2 text-right font-medium">Avg / 18</th>
              <th className="px-3 py-2 text-right font-medium">Par 3 Avg</th>
              <th className="px-3 py-2 text-right font-medium">Par 4 Avg</th>
              <th className="px-3 py-2 text-right font-medium">Par 5 Avg</th>
              <th className="px-3 py-2 text-right font-medium">Birdies</th>
              <th className="px-3 py-2 text-right font-medium">Pars</th>
              <th className="px-3 py-2 text-right font-medium">Bogeys</th>
              <th className="px-3 py-2 text-right font-medium">Dbl</th>
              <th className="px-3 py-2 text-right font-medium">Other</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr
                key={s.player.id}
                className={i % 2 === 0 ? "bg-neutral-950" : "bg-neutral-900/40"}
              >
                <td className="px-3 py-2 font-medium">{s.player.name}</td>
                <td className="px-3 py-2 text-right text-neutral-400">{s.roundsPlayed}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmt(s.avgScore)}</td>
                <td className="px-3 py-2 text-right text-neutral-300">{fmt(s.par3Avg)}</td>
                <td className="px-3 py-2 text-right text-neutral-300">{fmt(s.par4Avg)}</td>
                <td className="px-3 py-2 text-right text-neutral-300">{fmt(s.par5Avg)}</td>
                <td className="px-3 py-2 text-right text-emerald-400">{s.birdies}</td>
                <td className="px-3 py-2 text-right text-neutral-300">{s.pars}</td>
                <td className="px-3 py-2 text-right text-neutral-300">{s.bogeys}</td>
                <td className="px-3 py-2 text-right text-neutral-300">{s.doubles}</td>
                <td className="px-3 py-2 text-right text-neutral-500">{s.others}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        Pooled across every individual round played (Friday AM, Saturday AM, Sunday AM
        combined) — scrambles aren&apos;t counted since there&apos;s no per-player score.
        Avg / 18 is the average total score across completed (18-hole) rounds only — a round
        still in progress doesn&apos;t drag it down. Birdie/Par/Bogey/Dbl are each exactly
        that score relative to par (net score in Net mode); &quot;Other&quot; catches
        everything outside those four (eagle-or-better, or triple-bogey-or-worse).
      </p>
    </div>
  );
}
