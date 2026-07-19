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
