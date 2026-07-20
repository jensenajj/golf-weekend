export type RoundFormat = "individual" | "scramble";
export type TeamFormat = "singles" | "cart_pairs";

export type Player = {
  id: string;
  name: string;
  handicap: number;
  created_at: string;
};

export type Round = {
  id: string;
  label: string;
  day: string;
  session: "AM" | "PM";
  format: RoundFormat;
  course: string | null;
  tee: string;
  sort_order: number;
  team_format: TeamFormat | null;
};

export type Group = {
  id: string;
  round_id: string;
  name: string;
  team_score: number | null;
  scorekeeper_id: string | null;
  sort_order: number;
};

export type GroupMember = {
  group_id: string;
  player_id: string;
};

export type Cart = {
  id: string;
  group_id: string;
  name: string;
  sort_order: number;
};

export type CartMember = {
  cart_id: string;
  player_id: string;
};

export type Team = {
  id: string;
  round_id: string;
  name: string;
  sort_order: number;
};

export type TeamMember = {
  team_id: string;
  player_id: string;
  group_slot: 1 | 2 | null;
};

export type HoleScore = {
  id: string;
  round_id: string;
  player_id: string;
  hole: number;
  strokes: number;
  updated_at: string;
};

export type ScrambleScore = {
  id: string;
  round_id: string;
  group_id: string;
  hole: number;
  strokes: number;
  updated_at: string;
};

export type RoundHandicap = {
  round_id: string;
  player_id: string;
  handicap: number;
  locked_at: string;
};

export type RoundPayout = {
  round_id: string;
  win_amount: number;
  low_net_amount: number;
};

export type MoneySettings = {
  id: string;
  total_pot: number;
  skins_pot: number;
  champ_prize: number;
};

export const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);
