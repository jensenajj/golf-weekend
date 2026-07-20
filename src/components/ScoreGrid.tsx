"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { HOLES } from "@/lib/types";
import { netScore } from "@/lib/scoring";
import { lockRoundHandicapIfNeeded } from "@/lib/handicap";

type HoleValues = Record<number, string>;

function emptyHoles(): HoleValues {
  const h: HoleValues = {};
  for (const hole of HOLES) h[hole] = "";
  return h;
}

export function ScoreGrid({
  roundId,
  playerId,
  handicap,
}: {
  roundId: string;
  playerId: string;
  handicap: number;
}) {
  const [values, setValues] = useState<HoleValues>(emptyHoles());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [lockedHandicap, setLockedHandicap] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from("hole_scores")
        .select("hole, strokes")
        .eq("round_id", roundId)
        .eq("player_id", playerId),
      supabase
        .from("round_handicaps")
        .select("handicap")
        .eq("round_id", roundId)
        .eq("player_id", playerId)
        .maybeSingle(),
    ]).then(
      ([scores, roundHandicap]) => {
        if (cancelled) return;
        const next = emptyHoles();
        for (const row of scores.data ?? []) {
          next[row.hole] = String(row.strokes);
        }
        setValues(next);
        setLockedHandicap(roundHandicap.data?.handicap ?? null);
        setLoading(false);
      },
      () => {
        if (!cancelled) setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [roundId, playerId]);

  const effectiveHcp = lockedHandicap ?? handicap;

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
      player_id: playerId,
      hole: h,
      strokes: parseInt(values[h], 10),
    }));
    const holesToClear = HOLES.filter((h) => values[h] === "");

    if (toUpsert.length > 0) {
      await supabase
        .from("hole_scores")
        .upsert(toUpsert, { onConflict: "round_id,player_id,hole" });
      await lockRoundHandicapIfNeeded(roundId, playerId, handicap);
      const { data: locked } = await supabase
        .from("round_handicaps")
        .select("handicap")
        .eq("round_id", roundId)
        .eq("player_id", playerId)
        .maybeSingle();
      setLockedHandicap(locked?.handicap ?? null);
    }
    if (holesToClear.length > 0) {
      await supabase
        .from("hole_scores")
        .delete()
        .eq("round_id", roundId)
        .eq("player_id", playerId)
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
          {holesEntered}/18 holes · Gross <span className="text-neutral-100 font-medium">{gross}</span>
          {" · "}Net{" "}
          <span className="text-neutral-100 font-medium">
            {netScore(gross, effectiveHcp)}
          </span>
          <span
            className="ml-1 text-neutral-600"
            title={
              lockedHandicap != null
                ? `Handicap locked at ${effectiveHcp} for this round`
                : `Using current handicap (${effectiveHcp}) — locks once you save`
            }
          >
            (hcp {effectiveHcp}
            {lockedHandicap != null ? "🔒" : ""})
          </span>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {savedAt && !saving && (
        <p className="text-xs text-emerald-400">Saved.</p>
      )}
    </div>
  );
}
