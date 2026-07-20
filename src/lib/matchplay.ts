import { CourseData } from "./courseData";
import { effectiveHandicap, strokesReceived } from "./handicap";
import { FullData } from "./data";
import { HOLES, Round } from "./types";

export type MatchSide = {
  label: string;
  byHole: (number | null)[]; // index 0 = hole 1
  labelClassName?: string; // e.g. a team color, applied to the row label
};

export type MatchResult = {
  ptsA: number;
  ptsB: number;
  holeWinners: ("A" | "B" | "T" | null)[];
};

export function scoreMatch(a: MatchSide, b: MatchSide): MatchResult {
  let ptsA = 0;
  let ptsB = 0;
  const holeWinners: ("A" | "B" | "T" | null)[] = HOLES.map((_, i) => {
    const va = a.byHole[i];
    const vb = b.byHole[i];
    if (va == null || vb == null) return null;
    if (va < vb) {
      ptsA += 1;
      return "A";
    }
    if (vb < va) {
      ptsB += 1;
      return "B";
    }
    ptsA += 0.5;
    ptsB += 0.5;
    return "T";
  });
  return { ptsA, ptsB, holeWinners };
}

export function netFor(
  data: FullData,
  round: Round,
  course: CourseData | undefined,
  playerId: string,
  hole: number
): number | null {
  const row = data.holeScores.find(
    (s) => s.round_id === round.id && s.player_id === playerId && s.hole === hole
  );
  if (row == null) return null;
  const player = data.players.find((p) => p.id === playerId);
  if (!player) return null;
  const holeHandicap = course?.holes.find((h) => h.hole === hole)?.handicap ?? null;
  const hcp = effectiveHandicap(player.id, player.handicap, round.id, data.roundHandicaps);
  return row.strokes - strokesReceived(hcp, holeHandicap);
}

export function bestBallByHole(
  data: FullData,
  round: Round,
  course: CourseData | undefined,
  playerIds: string[],
  n: number
): (number | null)[] {
  return HOLES.map((h) => {
    const nets = playerIds
      .map((id) => netFor(data, round, course, id, h))
      .filter((v): v is number => v != null)
      .sort((x, y) => x - y);
    if (nets.length === 0) return null;
    return nets.slice(0, n).reduce((sum, v) => sum + v, 0);
  });
}

// True once every one of the given players has all 18 holes entered for
// this round — used to decide when a game's result (and any money it pays
// out) is final rather than just a mid-round snapshot.
export function allHolesEntered(data: FullData, roundId: string, playerIds: string[]): boolean {
  if (playerIds.length === 0) return false;
  return playerIds.every((playerId) =>
    HOLES.every((h) =>
      data.holeScores.some(
        (s) => s.round_id === roundId && s.player_id === playerId && s.hole === h
      )
    )
  );
}

// Total of a bestBallByHole(...) result across whichever holes have a
// value — the plain stroke total behind a "lowest score wins" comparison.
export function sumByHole(byHole: (number | null)[]): number | null {
  const vals = byHole.filter((v): v is number => v != null);
  return vals.length > 0 ? vals.reduce((sum, v) => sum + v, 0) : null;
}

// A best-N-of-M team score (see bestBallByHole) expressed relative to par,
// with par multiplied by N per hole -- e.g. for N=2, an 8 on a par 4 (two
// players' net 4s) is even for the hole, not +4.
export function teamScoreToPar(
  byHole: (number | null)[],
  course: CourseData | undefined,
  n: number
): { toPar: number | null; thru: number } {
  if (!course) return { toPar: null, thru: 0 };
  let total = 0;
  let parSum = 0;
  let thru = 0;
  HOLES.forEach((h, i) => {
    const val = byHole[i];
    if (val == null) return;
    const par = course.holes.find((c) => c.hole === h)?.par;
    if (par == null) return;
    total += val;
    parSum += par * n;
    thru += 1;
  });
  return { toPar: thru > 0 ? total - parSum : null, thru };
}
