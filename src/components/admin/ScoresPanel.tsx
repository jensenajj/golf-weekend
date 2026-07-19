"use client";

import { useEffect, useState } from "react";
import { usePlayers } from "@/components/PlayerProvider";
import { supabase } from "@/lib/supabase";
import { Round } from "@/lib/types";
import { ScoreGrid } from "@/app/score/page";

export function ScoresPanel() {
  const { players } = usePlayers();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("rounds")
      .select("*")
      .eq("format", "individual")
      .order("sort_order")
      .then(({ data }) => {
        setRounds(data ?? []);
        if (data && data.length > 0) setRoundId(data[0].id);
      });
  }, []);

  const playerId = selectedPlayerId ?? players[0]?.id ?? null;
  const player = players.find((p) => p.id === playerId) ?? null;

  if (players.length === 0) {
    return <p className="text-sm text-neutral-500">Add players first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={playerId ?? ""}
          onChange={(e) => setSelectedPlayerId(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
      </div>

      {roundId && player ? (
        <ScoreGrid
          key={`${roundId}-${player.id}`}
          roundId={roundId}
          playerId={player.id}
          handicap={player.handicap}
        />
      ) : (
        <p className="text-sm text-neutral-500">Pick a player and round.</p>
      )}
    </div>
  );
}
