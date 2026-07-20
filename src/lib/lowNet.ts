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
      return { round, complete: false, lowNet: null, winnerIds: [] };
    }

    const netTotals: Record<string, number> = {};
    for (const playerId of fieldIds) {
      const scores = data.holeScores.filter(
        (s) => s.round_id === round.id && s.player_id === playerId
      );
      if (scores.length !== 18) {
        return { round, complete: false, lowNet: null, winnerIds: [] };
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
      return { round, complete: false, lowNet: null, winnerIds: [] };
    }
    const lowNet = Math.min(...values);
    const winnerIds = Object.entries(netTotals)
      .filter(([, net]) => net === lowNet)
      .map(([id]) => id);

    return { round, complete: true, lowNet, winnerIds };
  });
}
