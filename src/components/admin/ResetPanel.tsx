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

const CONFIRM_PHRASE = "RESET";

export function ResetPanel() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  function backToIdle() {
    setStage("idle");
    setConfirmText("");
  }

  async function runReset() {
    setStage("working");
    setError(null);
    try {
      await wipeWeekend();
      setConfirmText("");
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("error");
    }
  }

  if (stage === "confirming" || stage === "working") {
    const canConfirm = confirmText.trim() === CONFIRM_PHRASE;
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
        <label className="block space-y-1.5">
          <span className="text-sm text-neutral-400">
            Type <span className="font-mono font-semibold text-red-300">{CONFIRM_PHRASE}</span>{" "}
            to confirm.
          </span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={stage === "working"}
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder={CONFIRM_PHRASE}
            className="w-full max-w-[200px] rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-mono tracking-wider disabled:opacity-60"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={runReset}
            disabled={!canConfirm || stage === "working"}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-900 disabled:text-red-300/60 disabled:opacity-60"
          >
            {stage === "working" ? "Wiping…" : "Yes, wipe everything"}
          </button>
          <button
            onClick={backToIdle}
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
          onClick={backToIdle}
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
