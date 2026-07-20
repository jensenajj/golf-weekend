import { COURSES } from "./courseData";
import { FullData } from "./data";
import { effectiveHandicap, netStrokes } from "./handicap";
import { roundFieldPlayerIds } from "./skins";
import { Round } from "./types";

export type LowNetResult = {
  round: Round;
  complete: boolean; // every field player has all 18 holes in
  lowNet: number | null;
  winnerIds: string[]; // more than one on a tie, split the prize
  netTotals: Record<string, number>; // empty unless complete
};

// Low Net is decided per individual (non-scramble) round, across the full
// field (both groups combined) -- whoever's 18-hole net total is lowest
// wins. Only counts once every field player has finished all 18 holes,
// same convention as skins and match-play payouts.
export function computeLowNet(data: FullData): LowNetResult[] {
  const individualRounds = data.rounds.filter((r) => r.format === "individual");

  return individualRounds.map((round) => {
    const course = round.course ? COURSES[round.course] : undefined;
    const hasHandicapData = course ? course.holes.every((h) => h.handicap != null) : false;
    const fieldIds = roundFieldPlayerIds(data, round.id);

    if (!course || !hasHandicapData || fieldIds.length === 0) {
      return { round, complete: false, lowNet: null, winnerIds: [], netTotals: {} };
    }

    const netTotals: Record<string, number> = {};
    for (const playerId of fieldIds) {
      const scores = data.holeScores.filter(
        (s) => s.round_id === round.id && s.player_id === playerId
      );
      if (scores.length !== 18) {
        return { round, complete: false, lowNet: null, winnerIds: [], netTotals: {} };
      }
      const player = data.players.find((p) => p.id === playerId);
      if (!player) continue;
      const hcp = effectiveHandicap(playerId, player.handicap, round.id, data.roundHandicaps);
      let net = 0;
      for (const s of scores) {
        const holeInfo = course.holes.find((h) => h.hole === s.hole);
        net += netStrokes(s.strokes, hcp, holeInfo?.handicap) ?? s.strokes;
      }
      netTotals[playerId] = net;
    }

    const values = Object.values(netTotals);
    if (values.length === 0) {
      return { round, complete: false, lowNet: null, winnerIds: [], netTotals: {} };
    }
    const lowNet = Math.min(...values);
    const winnerIds = Object.entries(netTotals)
      .filter(([, net]) => net === lowNet)
      .map(([id]) => id);

    return { round, complete: true, lowNet, winnerIds, netTotals };
  });
}

export type WeekendLowNetResult = {
  complete: boolean; // every individual round is complete
  total: number | null; // the winning combined net total
  championIds: string[]; // more than one on a tie, split the prize
};

// The weekend-long "Champ" prize: whoever's net total, summed across all
// three individual rounds (Friday/Saturday/Sunday AM), is lowest. Only
// decided once every individual round is complete -- a round still in
// progress means the weekend total isn't final yet either.
export function computeWeekendLowNet(data: FullData): WeekendLowNetResult {
  const results = computeLowNet(data);
  if (results.length === 0 || results.some((r) => !r.complete)) {
    return { complete: false, total: null, championIds: [] };
  }

  const totals: Record<string, number> = {};
  for (const r of results) {
    for (const [playerId, net] of Object.entries(r.netTotals)) {
      totals[playerId] = (totals[playerId] ?? 0) + net;
    }
  }

  const values = Object.values(totals);
  if (values.length === 0) {
    return { complete: false, total: null, championIds: [] };
  }
  const total = Math.min(...values);
  const championIds = Object.entries(totals)
    .filter(([, v]) => v === total)
    .map(([id]) => id);

  return { complete: true, total, championIds };
}
