import { supabase } from "./supabase";
import { Cart, CartMember, Group, GroupMember, HoleScore, Player, Round } from "./types";

export type FullData = {
  players: Player[];
  rounds: Round[];
  groups: Group[];
  groupMembers: GroupMember[];
  carts: Cart[];
  cartMembers: CartMember[];
  holeScores: HoleScore[];
};

const EMPTY: FullData = {
  players: [],
  rounds: [],
  groups: [],
  groupMembers: [],
  carts: [],
  cartMembers: [],
  holeScores: [],
};

export async function fetchAll(): Promise<FullData> {
  try {
    const [players, rounds, groups, groupMembers, carts, cartMembers, holeScores] =
      await Promise.all([
        supabase.from("players").select("*").order("name"),
        supabase.from("rounds").select("*").order("sort_order"),
        supabase.from("groups").select("*").order("sort_order"),
        supabase.from("group_members").select("*"),
        supabase.from("carts").select("*").order("sort_order"),
        supabase.from("cart_members").select("*"),
        supabase.from("hole_scores").select("*"),
      ]);

    return {
      players: players.data ?? [],
      rounds: rounds.data ?? [],
      groups: groups.data ?? [],
      groupMembers: groupMembers.data ?? [],
      carts: carts.data ?? [],
      cartMembers: cartMembers.data ?? [],
      holeScores: holeScores.data ?? [],
    };
  } catch {
    return EMPTY;
  }
}
