import { supabase } from "./supabase";
import { RoundHandicap } from "./types";

// The handicap actually used for scoring a given round: the value "locked
// in" for that (round, player) if one exists, otherwise the player's
// current global handicap. This is what keeps an already-played round's
// net scores stable even after the global handicap changes later.
export function effectiveHandicap(
  playerId: string,
  globalHandicap: number,
  roundId: string,
  roundHandicaps: RoundHandicap[]
): number {
  const locked = roundHandicaps.find(
    (rh) => rh.round_id === roundId && rh.player_id === playerId
  );
  return locked?.handicap ?? globalHandicap;
}

// Called when a player's first score for a round is saved. Snapshots their
// current global handicap as that round's locked value — but only if one
// isn't already locked in, so this never clobbers an existing lock (whether
// auto-locked earlier or set manually from Admin).
export async function lockRoundHandicapIfNeeded(
  roundId: string,
  playerId: string,
  currentHandicap: number
) {
  await supabase
    .from("round_handicaps")
    .upsert(
      { round_id: roundId, player_id: playerId, handicap: currentHandicap },
      { onConflict: "round_id,player_id", ignoreDuplicates: true }
    );
}

// Standard handicap stroke allocation: a player with handicap H gets one
// stroke on each of the H hardest holes (by stroke index, 1 = hardest).
// If H > 18, every hole gets floor(H/18) strokes, plus one more on the
// (H mod 18) hardest holes. holeHandicap is the hole's 1-18 stroke index.
export function strokesReceived(
  playerHandicap: number,
  holeHandicap: number | null | undefined
): number {
  if (holeHandicap == null || !Number.isFinite(playerHandicap)) return 0;
  const base = Math.floor(playerHandicap / 18);
  const remainder = playerHandicap % 18;
  return base + (holeHandicap <= remainder ? 1 : 0);
}

export function netStrokes(
  gross: number | null,
  playerHandicap: number,
  holeHandicap: number | null | undefined
): number | null {
  if (gross == null) return null;
  return gross - strokesReceived(playerHandicap, holeHandicap);
}
