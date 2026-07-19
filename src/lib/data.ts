import { supabase } from "./supabase";
import { Group, GroupMember, HoleScore, Player, Round } from "./types";

export type FullData = {
  players: Player[];
  rounds: Round[];
  groups: Group[];
  groupMembers: GroupMember[];
  holeScores: HoleScore[];
};

const EMPTY: FullData = {
  players: [],
  rounds: [],
  groups: [],
  groupMembers: [],
  holeScores: [],
};

export async function fetchAll(): Promise<FullData> {
  try {
    const [players, rounds, groups, groupMembers, holeScores] =
      await Promise.all([
        supabase.from("players").select("*").order("name"),
        supabase.from("rounds").select("*").order("sort_order"),
        supabase.from("groups").select("*").order("sort_order"),
        supabase.from("group_members").select("*"),
        supabase.from("hole_scores").select("*"),
      ]);

    return {
      players: players.data ?? [],
      rounds: rounds.data ?? [],
      groups: groups.data ?? [],
      groupMembers: groupMembers.data ?? [],
      holeScores: holeScores.data ?? [],
    };
  } catch {
    return EMPTY;
  }
}
