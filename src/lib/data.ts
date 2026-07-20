import { supabase } from "./supabase";
import {
  Cart,
  CartMember,
  Group,
  GroupMember,
  HoleScore,
  MoneySettings,
  Player,
  Round,
  RoundHandicap,
  RoundPayout,
  ScrambleScore,
  Team,
  TeamMember,
} from "./types";

export type FullData = {
  players: Player[];
  rounds: Round[];
  groups: Group[];
  groupMembers: GroupMember[];
  carts: Cart[];
  cartMembers: CartMember[];
  teams: Team[];
  teamMembers: TeamMember[];
  holeScores: HoleScore[];
  scrambleScores: ScrambleScore[];
  roundHandicaps: RoundHandicap[];
  roundPayouts: RoundPayout[];
  moneySettings: MoneySettings | null;
};

const EMPTY: FullData = {
  players: [],
  rounds: [],
  groups: [],
  groupMembers: [],
  carts: [],
  cartMembers: [],
  teams: [],
  teamMembers: [],
  holeScores: [],
  scrambleScores: [],
  roundHandicaps: [],
  roundPayouts: [],
  moneySettings: null,
};

export async function fetchAll(): Promise<FullData> {
  try {
    const [
      players,
      rounds,
      groups,
      groupMembers,
      carts,
      cartMembers,
      teams,
      teamMembers,
      holeScores,
      scrambleScores,
      roundHandicaps,
      roundPayouts,
      moneySettings,
    ] = await Promise.all([
      supabase.from("players").select("*").order("name"),
      supabase.from("rounds").select("*").order("sort_order"),
      supabase.from("groups").select("*").order("sort_order"),
      supabase.from("group_members").select("*"),
      supabase.from("carts").select("*").order("sort_order"),
      supabase.from("cart_members").select("*"),
      supabase.from("teams").select("*").order("sort_order"),
      supabase.from("team_members").select("*"),
      supabase.from("hole_scores").select("*"),
      supabase.from("scramble_scores").select("*"),
      supabase.from("round_handicaps").select("*"),
      supabase.from("round_payouts").select("*"),
      supabase.from("money_settings").select("*").eq("id", "default").maybeSingle(),
    ]);

    return {
      players: players.data ?? [],
      rounds: rounds.data ?? [],
      groups: groups.data ?? [],
      groupMembers: groupMembers.data ?? [],
      carts: carts.data ?? [],
      cartMembers: cartMembers.data ?? [],
      teams: teams.data ?? [],
      teamMembers: teamMembers.data ?? [],
      holeScores: holeScores.data ?? [],
      scrambleScores: scrambleScores.data ?? [],
      roundHandicaps: roundHandicaps.data ?? [],
      roundPayouts: roundPayouts.data ?? [],
      moneySettings: moneySettings.data ?? null,
    };
  } catch {
    return EMPTY;
  }
}
