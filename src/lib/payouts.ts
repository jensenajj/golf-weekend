import { COURSES } from "./courseData";
import { FullData } from "./data";
import { allHolesEntered, bestBallByHole, sumByHole } from "./matchplay";
import { scrambleComplete, scrambleTotal } from "./scramble";
import { computeAllSkins } from "./skins";
import { computeLowNet, computeWeekendLowNet } from "./lowNet";
import { computeSinglesMatch, rankedTeamMembers, roundTeams } from "./singlesMatch";
import { computeCartPairsMatch, teamSlot } from "./cartPairsMatch";
import { defaultWinAmount, tieAmountFor } from "./money";
import { Player, Round } from "./types";

export type RoundPayoutResult = {
  round: Round;
  status: "not-set-up" | "in-progress" | "final";
  winnerIds: string[];
  tied: boolean;
  perPlayer: Record<string, number>;
};

export function payoutAmountsFor(data: FullData, round: Round) {
  const row = data.roundPayouts.find((p) => p.round_id === round.id);
  const win = row?.win_amount ?? defaultWinAmount(round);
  return {
    win,
    tie: tieAmountFor(win),
    lowNetPrize: row?.low_net_amount ?? 20,
  };
}

// Decides a round's winner (and per-player payout) using whichever rule
// applies to its format: Singles/Cart Pairs match play totals, scramble
// team strokes, or Group vs Group's best-2-net-balls-of-4 total (lower
// wins) -- see each branch for the reasoning specific to that format.
export function computeRoundPayout(data: FullData, round: Round): RoundPayoutResult {
  const { win, tie } = payoutAmountsFor(data, round);
  const perPlayer: Record<string, number> = {};

  // Singles (A/B/C/D) and Cart Pairs match play both take over a round's
  // money result the moment it has 2 fully-staffed teams of the matching
  // team_format -- see lib/singlesMatch.ts / lib/cartPairsMatch.ts. The
  // on-course groups (used for scoring/carts/skins/low-net) stay
  // independent of this and are unaffected.
  const teams = roundTeams(data, round.id);
  if (round.format === "individual" && teams.length === 2 && round.team_format === "singles") {
    const rankedA = rankedTeamMembers(data, round, teams[0].id);
    const rankedB = rankedTeamMembers(data, round, teams[1].id);
    if (rankedA.length !== 4 || rankedB.length !== 4) {
      return { round, status: "not-set-up", winnerIds: [], tied: false, perPlayer };
    }
    const singles = computeSinglesMatch(data, round, teams[0].id, teams[1].id);
    if (!singles) {
      return { round, status: "not-set-up", winnerIds: [], tied: false, perPlayer };
    }
    if (!singles.complete) {
      return { round, status: "in-progress", winnerIds: [], tied: false, perPlayer };
    }
    const membersA = rankedA.map((p) => p.id);
    const membersB = rankedB.map((p) => p.id);
    if (singles.totalA === singles.totalB) {
      for (const id of [...membersA, ...membersB]) perPlayer[id] = tie;
      return { round, status: "final", winnerIds: [], tied: true, perPlayer };
    }
    const winners = singles.totalA > singles.totalB ? membersA : membersB;
    for (const id of winners) perPlayer[id] = win;
    return { round, status: "final", winnerIds: winners, tied: false, perPlayer };
  }

  if (
    round.format === "individual" &&
    teams.length === 2 &&
    round.team_format === "cart_pairs"
  ) {
    const membersA = data.teamMembers
      .filter((m) => m.team_id === teams[0].id)
      .map((m) => m.player_id);
    const membersB = data.teamMembers
      .filter((m) => m.team_id === teams[1].id)
      .map((m) => m.player_id);
    const a1 = teamSlot(data.teamMembers, teams[0].id, 1);
    const a2 = teamSlot(data.teamMembers, teams[0].id, 2);
    const b1 = teamSlot(data.teamMembers, teams[1].id, 1);
    const b2 = teamSlot(data.teamMembers, teams[1].id, 2);
    if (a1.length !== 2 || a2.length !== 2 || b1.length !== 2 || b2.length !== 2) {
      return { round, status: "not-set-up", winnerIds: [], tied: false, perPlayer };
    }
    const cartPairs = computeCartPairsMatch(data, round, teams[0].id, teams[1].id);
    if (!cartPairs) {
      return { round, status: "not-set-up", winnerIds: [], tied: false, perPlayer };
    }
    if (!cartPairs.complete) {
      return { round, status: "in-progress", winnerIds: [], tied: false, perPlayer };
    }
    if (cartPairs.totalA === cartPairs.totalB) {
      for (const id of [...membersA, ...membersB]) perPlayer[id] = tie;
      return { round, status: "final", winnerIds: [], tied: true, perPlayer };
    }
    const winners = cartPairs.totalA > cartPairs.totalB ? membersA : membersB;
    for (const id of winners) perPlayer[id] = win;
    return { round, status: "final", winnerIds: winners, tied: false, perPlayer };
  }

  const groups = data.groups
    .filter((g) => g.round_id === round.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (groups.length !== 2) {
    return { round, status: "not-set-up", winnerIds: [], tied: false, perPlayer };
  }

  const membersOf = (groupId: string) =>
    data.groupMembers.filter((m) => m.group_id === groupId).map((m) => m.player_id);
  const membersA = membersOf(groups[0].id);
  const membersB = membersOf(groups[1].id);

  if (round.format === "scramble") {
    if (!scrambleComplete(data, groups[0].id) || !scrambleComplete(data, groups[1].id)) {
      return { round, status: "in-progress", winnerIds: [], tied: false, perPlayer };
    }
    const scoreA = scrambleTotal(data, groups[0].id)!;
    const scoreB = scrambleTotal(data, groups[1].id)!;
    if (scoreA === scoreB) {
      for (const id of [...membersA, ...membersB]) perPlayer[id] = tie;
      return { round, status: "final", winnerIds: [], tied: true, perPlayer };
    }
    const winners = scoreA < scoreB ? membersA : membersB;
    for (const id of winners) perPlayer[id] = win;
    return { round, status: "final", winnerIds: winners, tied: false, perPlayer };
  }

  // individual round: Group vs Group, best 2 net balls of 4 -- the team
  // with the lower total score (summed across all 18 holes) wins, same
  // total shown on the Scorecard's "Team Score" row and Games' team cards.
  const course = round.course ? COURSES[round.course] : undefined;
  const hasHandicapData = course ? course.holes.every((h) => h.handicap != null) : false;
  if (!course || !hasHandicapData) {
    return { round, status: "not-set-up", winnerIds: [], tied: false, perPlayer };
  }
  if (!allHolesEntered(data, round.id, [...membersA, ...membersB])) {
    return { round, status: "in-progress", winnerIds: [], tied: false, perPlayer };
  }
  const totalA = sumByHole(bestBallByHole(data, round, course, membersA, 2))!;
  const totalB = sumByHole(bestBallByHole(data, round, course, membersB, 2))!;
  if (totalA === totalB) {
    for (const id of [...membersA, ...membersB]) perPlayer[id] = tie;
    return { round, status: "final", winnerIds: [], tied: true, perPlayer };
  }
  const winners = totalA < totalB ? membersA : membersB;
  for (const id of winners) perPlayer[id] = win;
  return { round, status: "final", winnerIds: winners, tied: false, perPlayer };
}

export type PlayerTotal = {
  player: Player;
  perRound: Record<string, number>;
  skinsCount: number;
  skinsAmount: number;
  champAmount: number;
  total: number;
};

// Every player's total winnings so far -- round match/tie payouts, each
// round's own low-net prize, skins, and the weekend champ prize, all
// folded together. The single source of truth for "how much has each
// player won", used by both the Money page's Winnings table and the
// Dashboard's leaderboard $$$ column.
export function computePlayerTotals(data: FullData): PlayerTotal[] {
  const results = data.rounds.map((r) => computeRoundPayout(data, r));
  const skinsPot = data.moneySettings?.skins_pot ?? 100;
  const champPrize = data.moneySettings?.champ_prize ?? 60;
  const skins = computeAllSkins(data);
  const skinValue = skins.totalSkins > 0 ? skinsPot / skins.totalSkins : 0;
  const lowNetResults = computeLowNet(data);
  const weekendLowNet = computeWeekendLowNet(data);

  return data.players.map((p) => {
    const perRound: Record<string, number> = {};
    let total = 0;
    for (const r of results) {
      const matchAmount = r.perPlayer[p.id] ?? 0;
      const lnr = lowNetResults.find((x) => x.round.id === r.round.id);
      const roundLowNetAmount =
        lnr?.complete && lnr.winnerIds.includes(p.id)
          ? payoutAmountsFor(data, r.round).lowNetPrize / lnr.winnerIds.length
          : 0;
      const amount = matchAmount + roundLowNetAmount;
      perRound[r.round.id] = amount;
      total += amount;
    }
    const skinsCount = skins.skinsByPlayer[p.id] ?? 0;
    const skinsAmount = skinsCount * skinValue;
    total += skinsAmount;
    const champAmount =
      weekendLowNet.complete && weekendLowNet.championIds.includes(p.id)
        ? champPrize / weekendLowNet.championIds.length
        : 0;
    total += champAmount;
    return { player: p, perRound, skinsCount, skinsAmount, champAmount, total };
  });
}
