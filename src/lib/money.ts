import { Round } from "./types";

// Individual AM rounds step up in stakes over the weekend; scrambles stay
// at the flat $20 default they've always had.
const DEFAULT_WIN_AMOUNT: Record<string, number> = {
  Friday: 20,
  Saturday: 30,
  Sunday: 40,
};

export function defaultWinAmount(round: Round): number {
  return round.format === "individual" ? (DEFAULT_WIN_AMOUNT[round.day] ?? 20) : 20;
}

// Tie always splits what the win-side pot would've been (win x 4 players)
// across all 8 involved -- which works out to exactly win / 2, so it's
// derived rather than independently editable/stored.
export function tieAmountFor(winAmount: number): number {
  return winAmount / 2;
}
