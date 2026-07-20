import { COURSES } from "./courseData";
import { FullData } from "./data";
import { effectiveHandicap, strokesReceived } from "./handicap";
import { Player } from "./types";

export type ScoreMode = "gross" | "net";

export type PlayerStats = {
  player: Player;
  holesPlayed: number;
  roundsPlayed: number; // complete 18-hole rounds, what avgScore is averaged over
  avgScore: number | null; // average total score per 18 holes
  birdies: number;
  pars: number;
  bogeys: number;
  doubles: number;
  others: number;
  par3Avg: number | null;
  par4Avg: number | null;
  par5Avg: number | null;
};

// Classic score-vs-par buckets. "Other" catches everything outside the
// four named categories: eagle-or-better on one side, triple-bogey-or-
// worse on the other. In net mode, buckets are relative to net score.
type Bucket = "birdies" | "pars" | "bogeys" | "doubles" | "others";

function bucketFor(score: number, par: number): Bucket {
  const diff = score - par;
  if (diff === -1) return "birdies";
  if (diff === 0) return "pars";
  if (diff === 1) return "bogeys";
  if (diff === 2) return "doubles";
  return "others";
}

// All stats here are pooled across every individual round played (Friday
// AM, Saturday AM, Sunday AM combined) -- scrambles have no per-player
// score. Net mode uses each round's locked handicap (or the player's
// current handicap for a round that hasn't locked yet), same as everywhere
// else in the app.
export function computePlayerStats(data: FullData, mode: ScoreMode): PlayerStats[] {
  const individualRounds = data.rounds.filter((r) => r.format === "individual");

  return data.players.map((player) => {
    let holesPlayed = 0;
    let roundsPlayed = 0;
    let roundTotalSum = 0;
    let birdies = 0;
    let pars = 0;
    let bogeys = 0;
    let doubles = 0;
    let others = 0;
    let par3Sum = 0;
    let par3Holes = 0;
    let par4Sum = 0;
    let par4Holes = 0;
    let par5Sum = 0;
    let par5Holes = 0;

    for (const round of individualRounds) {
      const course = round.course ? COURSES[round.course] : undefined;
      if (!course) continue;

      const scores = data.holeScores.filter(
        (s) => s.round_id === round.id && s.player_id === player.id
      );
      if (scores.length === 0) continue;

      const hcp = effectiveHandicap(player.id, player.handicap, round.id, data.roundHandicaps);

      let roundGross = 0;
      let roundNet = 0;
      for (const s of scores) {
        const holeInfo = course.holes.find((h) => h.hole === s.hole);
        if (!holeInfo) continue;
        const par = holeInfo.par;
        const score =
          mode === "net" ? s.strokes - strokesReceived(hcp, holeInfo.handicap) : s.strokes;

        holesPlayed += 1;
        roundGross += s.strokes;
        roundNet += score;

        switch (bucketFor(score, par)) {
          case "birdies":
            birdies += 1;
            break;
          case "pars":
            pars += 1;
            break;
          case "bogeys":
            bogeys += 1;
            break;
          case "doubles":
            doubles += 1;
            break;
          case "others":
            others += 1;
            break;
        }

        if (par === 3) {
          par3Sum += score;
          par3Holes += 1;
        } else if (par === 4) {
          par4Sum += score;
          par4Holes += 1;
        } else if (par === 5) {
          par5Sum += score;
          par5Holes += 1;
        }
      }

      if (scores.length === 18) {
        roundsPlayed += 1;
        roundTotalSum += mode === "net" ? roundNet : roundGross;
      }
    }

    return {
      player,
      holesPlayed,
      roundsPlayed,
      avgScore: roundsPlayed > 0 ? roundTotalSum / roundsPlayed : null,
      birdies,
      pars,
      bogeys,
      doubles,
      others,
      par3Avg: par3Holes > 0 ? par3Sum / par3Holes : null,
      par4Avg: par4Holes > 0 ? par4Sum / par4Holes : null,
      par5Avg: par5Holes > 0 ? par5Sum / par5Holes : null,
    };
  });
}
