import { HoleScore } from "./types";

export function grossTotal(scores: HoleScore[]): number {
  return scores.reduce((sum, s) => sum + s.strokes, 0);
}

export function netScore(gross: number, handicap: number): number {
  return Math.round((gross - handicap) * 10) / 10;
}

export function holesPlayed(scores: HoleScore[]): number {
  return scores.length;
}
