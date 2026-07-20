"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayers } from "@/components/PlayerProvider";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { Round, RoundHandicap } from "@/lib/types";

export function RoundHandicapsPanel() {
  const { players } = usePlayers();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundHandicaps, setRoundHandicaps] = useState<RoundHandicap[]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      supabase.from("rounds").select("*").eq("format", "individual").order("sort_order"),
      supabase.from("round_handicaps").select("*"),
    ]).then(([r, rh]) => {
      setRounds(r.data ?? []);
      setRoundHandicaps(rh.data ?? []);
      setRoundId((prev) => prev ?? (r.data && r.data.length > 0 ? r.data[0].id : null));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(["round_handicaps"], load);

  const round = rounds.find((r) => r.id === roundId) ?? null;

  async function setOverride(playerId: string, value: string) {
    if (!round) return;
    const num = Number(value);
    if (value.trim() === "" || !Number.isFinite(num)) return;
    await supabase
      .from("round_handicaps")
      .upsert(
        { round_id: round.id, player_id: playerId, handicap: num },
        { onConflict: "round_id,player_id" }
      );
    load();
  }

  async function resetToGlobal(playerId: string) {
    if (!round) return;
    await supabase
      .from("round_handicaps")
      .delete()
      .eq("round_id", round.id)
      .eq("player_id", playerId);
    load();
  }

  if (players.length === 0) {
    return <p className="text-sm text-neutral-500">Add players first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {rounds.map((r) => (
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

      <p className="text-xs text-neutral-500">
        A round locks in each player&apos;s current handicap automatically the moment their
        first score for it is saved. Editing here sets (or overrides) that round&apos;s value
        directly — it never touches the player&apos;s main handicap in Players &amp; Handicaps,
        and it has no effect on any other round.
      </p>

      {round && (
        <div className="space-y-2">
          {players.map((p) => {
            const locked = roundHandicaps.find(
              (rh) => rh.round_id === round.id && rh.player_id === p.id
            );
            const effective = locked?.handicap ?? p.handicap;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2"
              >
                <span className="font-medium">
                  {p.name}
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    {locked ? "🔒 locked for this round" : `following global (${p.handicap})`}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <input
                    key={`${round.id}-${p.id}-${effective}`}
                    defaultValue={effective}
                    onBlur={(e) => setOverride(p.id, e.target.value)}
                    inputMode="decimal"
                    className="w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-center text-sm"
                  />
                  {locked && (
                    <button
                      onClick={() => resetToGlobal(p.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
