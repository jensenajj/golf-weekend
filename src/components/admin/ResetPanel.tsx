"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Stage = "idle" | "confirming" | "working" | "done" | "error";

// Wipes everything that represents "this weekend's play" -- scores,
// on-course groups/carts, teams, and locked-in round handicaps -- so the
// whole app reads like a fresh weekend. Players/handicaps, round
// definitions (course, format, team_format), and Money settings (pot
// amounts, per-round win/tie amounts) are all untouched.
async function wipeWeekend() {
  const results = await Promise.all([
    supabase.from("hole_scores").delete().not("id", "is", null),
    supabase.from("scramble_scores").delete().not("id", "is", null),
    // Deleting groups/teams cascades to group_members/carts/cart_members
    // and team_members respectively.
    supabase.from("groups").delete().not("id", "is", null),
    supabase.from("teams").delete().not("id", "is", null),
    supabase.from("round_handicaps").delete().not("round_id", "is", null),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export function ResetPanel() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  async function runReset() {
    setStage("working");
    setError(null);
    try {
      await wipeWeekend();
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("error");
    }
  }

  if (stage === "confirming" || stage === "working") {
    return (
      <div className="space-y-4 rounded-xl border border-red-900/60 bg-red-950/20 p-4">
        <p className="text-sm font-medium text-red-300">
          This will permanently delete every hole score, scramble score, group, cart, team, and
          round-handicap lock — across all 5 rounds. There is no undo.
        </p>
        <p className="text-sm text-neutral-400">
          Players, their handicaps, round setup (course/format), and Money settings (pot
          amounts, win/tie amounts) are all kept exactly as they are.
        </p>
        <div className="flex gap-2">
          <button
            onClick={runReset}
            disabled={stage === "working"}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {stage === "working" ? "Wiping…" : "Yes, wipe everything"}
          </button>
          <button
            onClick={() => setStage("idle")}
            disabled={stage === "working"}
            className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
        <p className="text-sm font-medium text-emerald-300">
          Done — all scores, matchups, and round-handicap locks have been cleared. Every page
          will pick this up automatically.
        </p>
        <button
          onClick={() => setStage("idle")}
          className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        Wipes all hole scores, scramble scores, groups/carts, teams, and round-handicap locks
        for every round, so you can start the weekend over from scratch. Players, handicaps,
        round setup, and Money settings are untouched.
      </p>
      {stage === "error" && error && (
        <p className="text-sm text-red-400">Reset failed: {error}</p>
      )}
      <button
        onClick={() => setStage("confirming")}
        className="rounded-full bg-red-900/60 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-900"
      >
        Reset All Scores &amp; Matchups
      </button>
    </div>
  );
}
