"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlayers } from "@/components/PlayerProvider";
import { supabase } from "@/lib/supabase";
import { HOLES, Round, Group } from "@/lib/types";
import { ScoreGrid } from "@/components/ScoreGrid";

type HoleValues = Record<number, string>;

function emptyHoles(): HoleValues {
  const h: HoleValues = {};
  for (const hole of HOLES) h[hole] = "";
  return h;
}

function ScrambleGrid({ roundId, groupId }: { roundId: string; groupId: string }) {
  const [values, setValues] = useState<HoleValues>(emptyHoles());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("scramble_scores")
      .select("hole, strokes")
      .eq("round_id", roundId)
      .eq("group_id", groupId)
      .then(
        ({ data }) => {
          if (cancelled) return;
          const next = emptyHoles();
          for (const row of data ?? []) next[row.hole] = String(row.strokes);
          setValues(next);
          setLoading(false);
        },
        () => {
          if (!cancelled) setLoading(false);
        }
      );
    return () => {
      cancelled = true;
    };
  }, [roundId, groupId]);

  const gross = useMemo(
    () =>
      HOLES.reduce((sum, h) => {
        const v = parseInt(values[h], 10);
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0),
    [values]
  );
  const holesEntered = HOLES.filter((h) => values[h] !== "").length;

  async function save() {
    setSaving(true);
    const toUpsert = HOLES.filter((h) => values[h] !== "").map((h) => ({
      round_id: roundId,
      group_id: groupId,
      hole: h,
      strokes: parseInt(values[h], 10),
    }));
    const holesToClear = HOLES.filter((h) => values[h] === "");

    if (toUpsert.length > 0) {
      await supabase
        .from("scramble_scores")
        .upsert(toUpsert, { onConflict: "group_id,hole" });
    }
    if (holesToClear.length > 0) {
      await supabase
        .from("scramble_scores")
        .delete()
        .eq("round_id", roundId)
        .eq("group_id", groupId)
        .in("hole", holesToClear);
    }
    setSaving(false);
    setSavedAt(Date.now());
  }

  if (loading) return <p className="text-neutral-400">Loading scores…</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[HOLES.slice(0, 9), HOLES.slice(9, 18)].map((nine, idx) => (
          <div key={idx} className="space-y-1.5">
            <p className="text-xs font-medium text-neutral-500">
              {idx === 0 ? "Front 9" : "Back 9"}
            </p>
            {nine.map((hole) => (
              <div key={hole} className="flex items-center gap-2">
                <label className="w-6 text-sm text-neutral-400">{hole}</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={values[hole]}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                    setValues((prev) => ({ ...prev, [hole]: v }));
                  }}
                  className="w-14 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-center text-sm"
                  placeholder="–"
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
        <div className="text-sm text-neutral-400">
          {holesEntered}/18 holes · Gross{" "}
          <span className="text-neutral-100 font-medium">{gross}</span>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {savedAt && !saving && <p className="text-xs text-emerald-400">Saved.</p>}
    </div>
  );
}

export function ScoresPanel() {
  const { players } = usePlayers();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("rounds").select("*").order("sort_order"),
      supabase.from("groups").select("*").order("sort_order"),
    ]).then(([r, g]) => {
      setRounds(r.data ?? []);
      setGroups(g.data ?? []);
      if (r.data && r.data.length > 0) setRoundId(r.data[0].id);
    });
  }, []);

  const round = rounds.find((r) => r.id === roundId) ?? null;
  const playerId = selectedPlayerId ?? players[0]?.id ?? null;
  const player = players.find((p) => p.id === playerId) ?? null;
  const roundGroups = groups
    .filter((g) => g.round_id === roundId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const groupId = selectedGroupId ?? roundGroups[0]?.id ?? null;

  if (players.length === 0) {
    return <p className="text-sm text-neutral-500">Add players first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {round?.format === "scramble" ? (
          <select
            value={groupId ?? ""}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          >
            {roundGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : (
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
        )}
        <div className="flex gap-2 overflow-x-auto">
          {rounds.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setRoundId(r.id);
                setSelectedGroupId(null);
              }}
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

      {round?.format === "scramble" ? (
        groupId ? (
          <ScrambleGrid key={`${roundId}-${groupId}`} roundId={round.id} groupId={groupId} />
        ) : (
          <p className="text-sm text-neutral-500">
            No teams set for this round yet — add them in Admin → Matchups.
          </p>
        )
      ) : roundId && player ? (
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
