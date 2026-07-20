import { CourseData, COURSES } from "./courseData";
import { supabase } from "./supabase";
import { FullData } from "./data";
import { allHolesEntered, bestBallByHole, scoreMatch } from "./matchplay";
import { Round, Team, TeamMember } from "./types";

// The 2 player ids on a team assigned to a given on-course group slot (1 or
// 2). Unordered -- only used to feed bestBallByHole, which doesn't care
// about order. Takes a plain TeamMember[] (not full FullData) since Admin's
// MatchupsPanel manages its own team-members state independent of the
// FullData shape Games/Money use.
export function teamSlot(teamMembers: TeamMember[], teamId: string, slot: 1 | 2): string[] {
  return teamMembers
    .filter((m) => m.team_id === teamId && m.group_slot === slot)
    .map((m) => m.player_id);
}

export type CartPairsGroupResult = {
  totalA: number;
  totalB: number;
};

export type CartPairsResult = {
  complete: boolean;
  group1: CartPairsGroupResult | null;
  group2: CartPairsGroupResult | null;
  totalA: number;
  totalB: number;
};

// The Cart Pairs format: each team's 4 are manually split into 2 pairs (one
// per on-course group slot). Within each slot, the two teams' pairs play
// best-net-ball-of-2 match play against each other -- exactly the same
// scoring the "Cart vs Cart" section already does (bestBallByHole with
// n=1, then scoreMatch) -- and the two slots' points sum into team totals.
// Returns null if either team isn't split 2-and-2 across both slots yet.
export function computeCartPairsMatch(
  data: FullData,
  round: Round,
  teamAId: string,
  teamBId: string
): CartPairsResult | null {
  const a1 = teamSlot(data.teamMembers, teamAId, 1);
  const a2 = teamSlot(data.teamMembers, teamAId, 2);
  const b1 = teamSlot(data.teamMembers, teamBId, 1);
  const b2 = teamSlot(data.teamMembers, teamBId, 2);
  if (a1.length !== 2 || a2.length !== 2 || b1.length !== 2 || b2.length !== 2) return null;

  const complete = allHolesEntered(data, round.id, [...a1, ...a2, ...b1, ...b2]);
  if (!complete) {
    return { complete: false, group1: null, group2: null, totalA: 0, totalB: 0 };
  }

  const course: CourseData | undefined = round.course ? COURSES[round.course] : undefined;
  const g1 = scoreMatch(
    { label: "Group 1 A", byHole: bestBallByHole(data, round, course, a1, 1) },
    { label: "Group 1 B", byHole: bestBallByHole(data, round, course, b1, 1) }
  );
  const g2 = scoreMatch(
    { label: "Group 2 A", byHole: bestBallByHole(data, round, course, a2, 1) },
    { label: "Group 2 B", byHole: bestBallByHole(data, round, course, b2, 1) }
  );

  return {
    complete: true,
    group1: { totalA: g1.ptsA, totalB: g1.ptsB },
    group2: { totalA: g2.ptsA, totalB: g2.ptsB },
    totalA: g1.ptsA + g2.ptsA,
    totalB: g1.ptsB + g2.ptsB,
  };
}

// Regenerates a round's on-course groups/carts from its Cart Pairs
// assignment: Group 1 = both teams' slot-1 pair, Group 2 = both teams'
// slot-2 pair, each with one cart per team. Same delete-and-recreate
// pattern as lib/singlesMatch.ts's syncOnCourseGroups. Only call once both
// teams are split 2-and-2 across both slots.
export async function syncCartPairGroups(
  round: Round,
  teamA: Team,
  teamB: Team,
  teamMembers: TeamMember[]
) {
  const a1 = teamSlot(teamMembers, teamA.id, 1);
  const a2 = teamSlot(teamMembers, teamA.id, 2);
  const b1 = teamSlot(teamMembers, teamB.id, 1);
  const b2 = teamSlot(teamMembers, teamB.id, 2);
  if (a1.length !== 2 || a2.length !== 2 || b1.length !== 2 || b2.length !== 2) return;

  const { data: existingGroups } = await supabase
    .from("groups")
    .select("id")
    .eq("round_id", round.id);
  const existingIds = (existingGroups ?? []).map((g) => g.id);
  if (existingIds.length > 0) {
    await supabase.from("groups").delete().in("id", existingIds);
  }

  const { data: group1 } = await supabase
    .from("groups")
    .insert({ round_id: round.id, name: "Group 1", sort_order: 1 })
    .select()
    .single();
  const { data: group2 } = await supabase
    .from("groups")
    .insert({ round_id: round.id, name: "Group 2", sort_order: 2 })
    .select()
    .single();
  if (!group1 || !group2) return;

  await supabase.from("group_members").insert([
    { group_id: group1.id, player_id: a1[0] },
    { group_id: group1.id, player_id: a1[1] },
    { group_id: group1.id, player_id: b1[0] },
    { group_id: group1.id, player_id: b1[1] },
    { group_id: group2.id, player_id: a2[0] },
    { group_id: group2.id, player_id: a2[1] },
    { group_id: group2.id, player_id: b2[0] },
    { group_id: group2.id, player_id: b2[1] },
  ]);

  const { data: cart1A } = await supabase
    .from("carts")
    .insert({ group_id: group1.id, name: teamA.name, sort_order: 1 })
    .select()
    .single();
  const { data: cart1B } = await supabase
    .from("carts")
    .insert({ group_id: group1.id, name: teamB.name, sort_order: 2 })
    .select()
    .single();
  const { data: cart2A } = await supabase
    .from("carts")
    .insert({ group_id: group2.id, name: teamA.name, sort_order: 1 })
    .select()
    .single();
  const { data: cart2B } = await supabase
    .from("carts")
    .insert({ group_id: group2.id, name: teamB.name, sort_order: 2 })
    .select()
    .single();

  const cartMemberRows = [
    cart1A && [
      { cart_id: cart1A.id, player_id: a1[0] },
      { cart_id: cart1A.id, player_id: a1[1] },
    ],
    cart1B && [
      { cart_id: cart1B.id, player_id: b1[0] },
      { cart_id: cart1B.id, player_id: b1[1] },
    ],
    cart2A && [
      { cart_id: cart2A.id, player_id: a2[0] },
      { cart_id: cart2A.id, player_id: a2[1] },
    ],
    cart2B && [
      { cart_id: cart2B.id, player_id: b2[0] },
      { cart_id: cart2B.id, player_id: b2[1] },
    ],
  ]
    .filter((rows): rows is { cart_id: string; player_id: string }[] => Boolean(rows))
    .flat();

  if (cartMemberRows.length > 0) {
    await supabase.from("cart_members").insert(cartMemberRows);
  }
}
