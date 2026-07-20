import { CourseData, COURSES } from "./courseData";
import { supabase } from "./supabase";
import { FullData } from "./data";
import { effectiveHandicap } from "./handicap";
import { MatchResult, allHolesEntered, netFor, scoreMatch } from "./matchplay";
import { HOLES, Player, Round, Team } from "./types";

export const RANK_LABELS = ["A", "B", "C", "D"] as const;
export type RankLabel = (typeof RANK_LABELS)[number];

// A team's 4 members ranked by handicap ascending -- lowest handicap is the
// "A man", highest is the "D man". Ties broken by name for a stable order.
// Uses effectiveHandicap so a round that's already locked handicaps in
// stays consistent, even though in practice teams get set before any
// scores exist.
export function rankedTeamMembers(data: FullData, round: Round, teamId: string): Player[] {
  const memberIds = data.teamMembers
    .filter((m) => m.team_id === teamId)
    .map((m) => m.player_id);
  return memberIds
    .map((id) => data.players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))
    .sort((a, b) => {
      const hcpA = effectiveHandicap(a.id, a.handicap, round.id, data.roundHandicaps);
      const hcpB = effectiveHandicap(b.id, b.handicap, round.id, data.roundHandicaps);
      if (hcpA !== hcpB) return hcpA - hcpB;
      return a.name.localeCompare(b.name);
    });
}

export function roundTeams(data: FullData, roundId: string): Team[] {
  return data.teams
    .filter((t) => t.round_id === roundId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export type SinglesMatchup = {
  rank: RankLabel;
  playerA: Player;
  playerB: Player;
  result: MatchResult;
};

export type SinglesResult = {
  complete: boolean;
  matchups: SinglesMatchup[];
  totalA: number;
  totalB: number;
};

// The A/B/C/D singles match play format: each team's players are ranked by
// handicap, then rank plays rank (A vs A, B vs B, ...) as an individual net
// match worth 1 point/hole (0.5 each on a tied hole, via the existing
// scoreMatch used for group-vs-group). The 4 players' points sum into each
// team's total. Returns null if either team isn't staffed with exactly 4
// players yet (setup still in progress).
export function computeSinglesMatch(
  data: FullData,
  round: Round,
  teamAId: string,
  teamBId: string
): SinglesResult | null {
  const rankedA = rankedTeamMembers(data, round, teamAId);
  const rankedB = rankedTeamMembers(data, round, teamBId);
  if (rankedA.length !== 4 || rankedB.length !== 4) return null;

  const complete = allHolesEntered(
    data,
    round.id,
    [...rankedA, ...rankedB].map((p) => p.id)
  );
  if (!complete) {
    return { complete: false, matchups: [], totalA: 0, totalB: 0 };
  }

  const course: CourseData | undefined = round.course ? COURSES[round.course] : undefined;
  let totalA = 0;
  let totalB = 0;
  const matchups: SinglesMatchup[] = RANK_LABELS.map((rank, i) => {
    const playerA = rankedA[i];
    const playerB = rankedB[i];
    const result = scoreMatch(
      {
        label: playerA.name,
        byHole: HOLES.map((h) => netFor(data, round, course, playerA.id, h)),
      },
      {
        label: playerB.name,
        byHole: HOLES.map((h) => netFor(data, round, course, playerB.id, h)),
      }
    );
    totalA += result.ptsA;
    totalB += result.ptsB;
    return { rank, playerA, playerB, result };
  });

  return { complete: true, matchups, totalA, totalB };
}

// Regenerates a round's on-course groups/carts from its team assignment:
// the A/B players from both teams ride/play together (so A can play
// against A), and the C/D players from both teams form the other physical
// foursome. Deletes the round's existing groups (cascades to
// group_members/carts/cart_members) and recreates them, so it's always in
// sync with the latest team membership. Only call once both teams have all
// 4 members -- callers should check rankedA/rankedB.length === 4 first.
export async function syncOnCourseGroups(
  round: Round,
  teamA: Team,
  teamB: Team,
  rankedA: Player[],
  rankedB: Player[]
): Promise<void> {
  if (rankedA.length !== 4 || rankedB.length !== 4) return;

  const { data: existingGroups } = await supabase
    .from("groups")
    .select("id")
    .eq("round_id", round.id);
  const existingIds = (existingGroups ?? []).map((g) => g.id);
  if (existingIds.length > 0) {
    await supabase.from("groups").delete().in("id", existingIds);
  }

  const { data: abGroup } = await supabase
    .from("groups")
    .insert({ round_id: round.id, name: "A/B Group", sort_order: 1 })
    .select()
    .single();
  const { data: cdGroup } = await supabase
    .from("groups")
    .insert({ round_id: round.id, name: "C/D Group", sort_order: 2 })
    .select()
    .single();
  if (!abGroup || !cdGroup) return;

  await supabase.from("group_members").insert([
    { group_id: abGroup.id, player_id: rankedA[0].id },
    { group_id: abGroup.id, player_id: rankedA[1].id },
    { group_id: abGroup.id, player_id: rankedB[0].id },
    { group_id: abGroup.id, player_id: rankedB[1].id },
    { group_id: cdGroup.id, player_id: rankedA[2].id },
    { group_id: cdGroup.id, player_id: rankedA[3].id },
    { group_id: cdGroup.id, player_id: rankedB[2].id },
    { group_id: cdGroup.id, player_id: rankedB[3].id },
  ]);

  const { data: cartAB1 } = await supabase
    .from("carts")
    .insert({ group_id: abGroup.id, name: `${teamA.name} (A+B)`, sort_order: 1 })
    .select()
    .single();
  const { data: cartAB2 } = await supabase
    .from("carts")
    .insert({ group_id: abGroup.id, name: `${teamB.name} (A+B)`, sort_order: 2 })
    .select()
    .single();
  const { data: cartCD1 } = await supabase
    .from("carts")
    .insert({ group_id: cdGroup.id, name: `${teamA.name} (C+D)`, sort_order: 1 })
    .select()
    .single();
  const { data: cartCD2 } = await supabase
    .from("carts")
    .insert({ group_id: cdGroup.id, name: `${teamB.name} (C+D)`, sort_order: 2 })
    .select()
    .single();

  const cartMemberRows = [
    cartAB1 && [
      { cart_id: cartAB1.id, player_id: rankedA[0].id },
      { cart_id: cartAB1.id, player_id: rankedA[1].id },
    ],
    cartAB2 && [
      { cart_id: cartAB2.id, player_id: rankedB[0].id },
      { cart_id: cartAB2.id, player_id: rankedB[1].id },
    ],
    cartCD1 && [
      { cart_id: cartCD1.id, player_id: rankedA[2].id },
      { cart_id: cartCD1.id, player_id: rankedA[3].id },
    ],
    cartCD2 && [
      { cart_id: cartCD2.id, player_id: rankedB[2].id },
      { cart_id: cartCD2.id, player_id: rankedB[3].id },
    ],
  ]
    .filter((rows): rows is { cart_id: string; player_id: string }[] => Boolean(rows))
    .flat();

  if (cartMemberRows.length > 0) {
    await supabase.from("cart_members").insert(cartMemberRows);
  }
}
