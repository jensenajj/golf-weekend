import { COURSES } from "./courseData";
import { FullData } from "./data";
import { netFor } from "./matchplay";
import { HOLES, Round } from "./types";

export type HoleSkin = {
  round: Round;
  hole: number;
  decided: boolean; // every field player has a score for this hole
  winnerId: string | null; // null = push (tie) or not decided yet
};

// Everyone assigned to any group in this round — the field the skin is
// contested among.
export function roundFieldPlayerIds(data: FullData, roundId: string): string[] {
  const groupIds = data.groups.filter((g) => g.round_id === roundId).map((g) => g.id);
  const ids = new Set<string>();
  for (const m of data.groupMembers) {
    if (groupIds.includes(m.group_id)) ids.add(m.player_id);
  }
  return [...ids];
}

export type SkinsSummary = {
  skinsByPlayer: Record<string, number>;
  totalSkins: number;
  holes: HoleSkin[];
};

export function computeAllSkins(data: FullData): SkinsSummary {
  const skinsByPlayer: Record<string, number> = {};
  let totalSkins = 0;
  const holes: HoleSkin[] = [];

  const individualRounds = data.rounds.filter((r) => r.format === "individual");

  for (const round of individualRounds) {
    const course = round.course ? COURSES[round.course] : undefined;
    const hasHandicapData = course ? course.holes.every((h) => h.handicap != null) : false;
    if (!course || !hasHandicapData) continue;

    const fieldIds = roundFieldPlayerIds(data, round.id);
    if (fieldIds.length < 2) continue;

    for (const hole of HOLES) {
      const nets = fieldIds.map((id) => ({ id, net: netFor(data, round, course, id, hole) }));
      const decided = nets.every((n) => n.net != null);
      if (!decided) {
        holes.push({ round, hole, decided: false, winnerId: null });
        continue;
      }
      const minNet = Math.min(...nets.map((n) => n.net!));
      const lowest = nets.filter((n) => n.net === minNet);
      const winnerId = lowest.length === 1 ? lowest[0].id : null;
      if (winnerId) {
        skinsByPlayer[winnerId] = (skinsByPlayer[winnerId] ?? 0) + 1;
        totalSkins += 1;
      }
      holes.push({ round, hole, decided: true, winnerId });
    }
  }

  return { skinsByPlayer, totalSkins, holes };
}
