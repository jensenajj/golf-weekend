"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAll, FullData } from "@/lib/data";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { COURSES } from "@/lib/courseData";
import { allHolesEntered, bestBallByHole, scoreMatch } from "@/lib/matchplay";
import { scrambleComplete, scrambleTotal } from "@/lib/scramble";
import { computeAllSkins } from "@/lib/skins";
import { computeLowNet, computeWeekendLowNet } from "@/lib/lowNet";
import { defaultWinAmount, tieAmountFor } from "@/lib/money";
import { Round } from "@/lib/types";

function formatMoney(v: number): string {
  return Number.isInteger(v) ? `${v}` : v.toFixed(2);
}

type RoundPayoutResult = {
  round: Round;
  status: "not-set-up" | "in-progress" | "final";
  winnerLabel: string | null;
  tied: boolean;
  perPlayer: Record<string, number>;
};

function payoutAmountsFor(data: FullData, round: Round) {
  const row = data.roundPayouts.find((p) => p.round_id === round.id);
  const win = row?.win_amount ?? defaultWinAmount(round);
  return {
    win,
    tie: tieAmountFor(win),
    lowNetPrize: row?.low_net_amount ?? 20,
  };
}

function computeRoundPayout(data: FullData, round: Round): RoundPayoutResult {
  const groups = data.groups
    .filter((g) => g.round_id === round.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const { win, tie } = payoutAmountsFor(data, round);
  const perPlayer: Record<string, number> = {};

  if (groups.length !== 2) {
    return { round, status: "not-set-up", winnerLabel: null, tied: false, perPlayer };
  }

  const membersOf = (groupId: string) =>
    data.groupMembers.filter((m) => m.group_id === groupId).map((m) => m.player_id);
  const membersA = membersOf(groups[0].id);
  const membersB = membersOf(groups[1].id);

  if (round.format === "scramble") {
    if (!scrambleComplete(data, groups[0].id) || !scrambleComplete(data, groups[1].id)) {
      return { round, status: "in-progress", winnerLabel: null, tied: false, perPlayer };
    }
    const scoreA = scrambleTotal(data, groups[0].id)!;
    const scoreB = scrambleTotal(data, groups[1].id)!;
    if (scoreA === scoreB) {
      for (const id of [...membersA, ...membersB]) perPlayer[id] = tie;
      return { round, status: "final", winnerLabel: null, tied: true, perPlayer };
    }
    const winners = scoreA < scoreB ? membersA : membersB;
    const winnerName = scoreA < scoreB ? groups[0].name : groups[1].name;
    for (const id of winners) perPlayer[id] = win;
    return { round, status: "final", winnerLabel: winnerName, tied: false, perPlayer };
  }

  // individual round: Group vs Group best-2-net-balls-of-4
  const course = round.course ? COURSES[round.course] : undefined;
  const hasHandicapData = course ? course.holes.every((h) => h.handicap != null) : false;
  if (!course || !hasHandicapData) {
    return { round, status: "not-set-up", winnerLabel: null, tied: false, perPlayer };
  }
  if (!allHolesEntered(data, round.id, [...membersA, ...membersB])) {
    return { round, status: "in-progress", winnerLabel: null, tied: false, perPlayer };
  }
  const result = scoreMatch(
    { label: groups[0].name, byHole: bestBallByHole(data, round, course, membersA, 2) },
    { label: groups[1].name, byHole: bestBallByHole(data, round, course, membersB, 2) }
  );
  if (result.ptsA === result.ptsB) {
    for (const id of [...membersA, ...membersB]) perPlayer[id] = tie;
    return { round, status: "final", winnerLabel: null, tied: true, perPlayer };
  }
  const winners = result.ptsA > result.ptsB ? membersA : membersB;
  const winnerName = result.ptsA > result.ptsB ? groups[0].name : groups[1].name;
  for (const id of winners) perPlayer[id] = win;
  return { round, status: "final", winnerLabel: winnerName, tied: false, perPlayer };
}

export default function MoneyPage() {
  const [data, setData] = useState<FullData | null>(null);

  const load = useCallback(() => {
    fetchAll().then(setData);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(
    [
      "rounds",
      "groups",
      "group_members",
      "hole_scores",
      "scramble_scores",
      "round_handicaps",
      "round_payouts",
      "money_settings",
    ],
    load
  );

  if (!data) return <p className="text-neutral-400">Loading…</p>;

  if (data.players.length === 0) {
    return <p className="text-neutral-300">No players yet — add them in Admin.</p>;
  }

  const totalPot = data.moneySettings?.total_pot ?? 800;
  const skinsPot = data.moneySettings?.skins_pot ?? 100;
  const champPrize = data.moneySettings?.champ_prize ?? 60;
  const results = data.rounds.map((r) => computeRoundPayout(data, r));
  const skins = computeAllSkins(data);
  const skinValue = skins.totalSkins > 0 ? skinsPot / skins.totalSkins : 0;
  const skinsPaidOut = skins.totalSkins > 0 ? skinsPot : 0;
  const lowNetResults = computeLowNet(data);
  const weekendLowNet = computeWeekendLowNet(data);

  const lowNetPaidOut = lowNetResults.reduce((sum, r) => {
    if (!r.complete || r.winnerIds.length === 0) return sum;
    return sum + payoutAmountsFor(data, r.round).lowNetPrize;
  }, 0);
  const champPaidOut = weekendLowNet.complete ? champPrize : 0;

  const paidOut =
    results.reduce((sum, r) => sum + Object.values(r.perPlayer).reduce((s, v) => s + v, 0), 0) +
    skinsPaidOut +
    lowNetPaidOut +
    champPaidOut;
  const remaining = totalPot - paidOut;

  const playerTotals = data.players
    .map((p) => {
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
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Total Pot</p>
          <p className="mt-1 text-2xl font-semibold">${totalPot}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Paid Out</p>
          <p className="mt-1 text-2xl font-semibold">${formatMoney(paidOut)}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Remaining</p>
          <p className="mt-1 text-2xl font-semibold">${formatMoney(remaining)}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Winnings
        </h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Player</th>
                {results.map((r) => (
                  <th key={r.round.id} className="px-3 py-2 text-right font-medium">
                    {r.round.day.slice(0, 3)} {r.round.session}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Skins</th>
                <th className="px-3 py-2 text-right font-medium">Champ</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {playerTotals.map(
                ({ player, perRound, skinsCount, skinsAmount, champAmount, total }, i) => (
                  <tr
                    key={player.id}
                    className={i % 2 === 0 ? "bg-neutral-950" : "bg-neutral-900/40"}
                  >
                    <td className="px-3 py-2 font-medium">{player.name}</td>
                    {results.map((r) => (
                      <td key={r.round.id} className="px-3 py-2 text-right text-neutral-300">
                        {perRound[r.round.id] > 0 ? `$${formatMoney(perRound[r.round.id])}` : (
                          <span className="text-neutral-600">–</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right text-neutral-300">
                      {skinsCount > 0 ? (
                        <span title={`${skinsCount} skin${skinsCount > 1 ? "s" : ""}`}>
                          ${formatMoney(skinsAmount)}
                        </span>
                      ) : (
                        <span className="text-neutral-600">–</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-300">
                      {champAmount > 0 ? (
                        `$${formatMoney(champAmount)}`
                      ) : (
                        <span className="text-neutral-600">–</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-400">
                      ${formatMoney(total)}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Round Status
        </h2>
        <div className="space-y-2">
          {results.map((r) => {
            const { win, tie } = payoutAmountsFor(data, r.round);
            return (
              <div
                key={r.round.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {r.round.label}
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    ${win} win / ${tie} tie
                  </span>
                </span>
                {r.status === "not-set-up" && (
                  <span className="text-neutral-500">Not set up yet</span>
                )}
                {r.status === "in-progress" && (
                  <span className="text-amber-400">In progress</span>
                )}
                {r.status === "final" && r.tied && (
                  <span className="text-neutral-300">Tied — ${tie} each to all 8</span>
                )}
                {r.status === "final" && !r.tied && (
                  <span className="text-emerald-400">{r.winnerLabel} wins</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          A round&apos;s payout only counts once its result is final (all scores in for AM
          rounds, both team scores in for scrambles) — in-progress rounds show as pending and
          don&apos;t pay out yet.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Low Net
        </h2>
        <div className="space-y-2">
          {lowNetResults.map((r) => {
            const { lowNetPrize } = payoutAmountsFor(data, r.round);
            const winnerNames = r.winnerIds
              .map((id) => data.players.find((p) => p.id === id)?.name)
              .filter(Boolean)
              .join(", ");
            return (
              <div
                key={r.round.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {r.round.label}
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    ${lowNetPrize} to lowest net
                  </span>
                </span>
                {!r.complete ? (
                  <span className="text-amber-400">In progress</span>
                ) : r.winnerIds.length > 1 ? (
                  <span className="text-emerald-400">
                    {winnerNames} tie at {r.lowNet} — ${formatMoney(lowNetPrize / r.winnerIds.length)}{" "}
                    each
                  </span>
                ) : (
                  <span className="text-emerald-400">
                    {winnerNames} wins at {r.lowNet}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Whoever&apos;s 18-hole net total is lowest across the full field (both groups) for
          that round wins — only counts once every player in the round has entered all 18
          holes. A tie splits the prize evenly among the tied players. These amounts show up
          folded into that round&apos;s own column in the Winnings table above, not as a
          separate column.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Champ
        </h2>
        <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm">
          <span className="font-medium">
            Weekend Low Net
            <span className="ml-2 text-xs font-normal text-neutral-500">
              ${champPrize} to the lowest combined net across Friday, Saturday, and Sunday AM
            </span>
          </span>
          {!weekendLowNet.complete ? (
            <span className="text-amber-400">In progress</span>
          ) : weekendLowNet.championIds.length > 1 ? (
            <span className="text-emerald-400">
              {weekendLowNet.championIds
                .map((id) => data.players.find((p) => p.id === id)?.name)
                .filter(Boolean)
                .join(", ")}{" "}
              tie at {weekendLowNet.total} — ${formatMoney(
                champPrize / weekendLowNet.championIds.length
              )}{" "}
              each
            </span>
          ) : (
            <span className="text-emerald-400">
              {data.players.find((p) => p.id === weekendLowNet.championIds[0])?.name} wins at{" "}
              {weekendLowNet.total}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          The weekend&apos;s low net champion — net totals from Friday AM, Saturday AM, and
          Sunday AM added together, lowest wins. Only decided once all three individual rounds
          are complete. Separate from each round&apos;s own Low Net prize above.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Skins
        </h2>
        <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm">
          <span className="font-medium">
            Skins pot
            <span className="ml-2 text-xs font-normal text-neutral-500">
              ${formatMoney(skinsPot)} total
            </span>
          </span>
          <span className={skins.totalSkins > 0 ? "text-emerald-400" : "text-neutral-500"}>
            {skins.totalSkins > 0
              ? `${skins.totalSkins} skin${skins.totalSkins > 1 ? "s" : ""} — $${formatMoney(skinValue)} each`
              : "No skins decided yet"}
          </span>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          A hole&apos;s skin needs everyone in that round to have entered it, and only counts
          once — a tie for lowest net is a push (no skin). The value per skin recalculates as
          more skins are won across Friday AM, Saturday AM, and Sunday AM, so it may still
          change until all three are complete.
        </p>
      </section>
    </div>
  );
}
