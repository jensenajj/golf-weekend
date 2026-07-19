export type RoundFormat = "individual" | "scramble";

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
};

export type Group = {
  id: string;
  round_id: string;
  name: string;
  team_score: number | null;
  sort_order: number;
};

export type GroupMember = {
  group_id: string;
  player_id: string;
};

export type HoleScore = {
  id: string;
  round_id: string;
  player_id: string;
  hole: number;
  strokes: number;
  updated_at: string;
};

export const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);
