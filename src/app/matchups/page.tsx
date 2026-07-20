"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAll, FullData } from "@/lib/data";
import { grossTotal, netScore } from "@/lib/scoring";
import { effectiveHandicap } from "@/lib/handicap";
import { scrambleToPar } from "@/lib/scramble";
import { roundTeams } from "@/lib/singlesMatch";
import { COURSES } from "@/lib/courseData";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { Group, Team } from "@/lib/types";

type Side = "A" | "B" | null;

// Team A always reads blue, Team B always reads red -- same convention
// used on Scorecard/Games, so team membership reads consistently everywhere.
function sideColor(side: Side): string {
  if (side === "A") return "text-sky-400";
  if (side === "B") return "text-red-400";
  return "";
}

// For team-format rounds (Singles/Cart Pairs), the on-course groups mix
// both teams together, so a group itself isn't "one side" -- only
// individual players are. Otherwise (plain individual or scramble), the
// two groups ARE the two sides.
function groupSide(roundGroups: Group[], teamsForRound: Team[], g: { id: string }): Side {
  if (teamsForRound.length === 2) return null;
  const idx = roundGroups.findIndex((rg) => rg.id === g.id);
  return idx === 0 ? "A" : idx === 1 ? "B" : null;
}

function playerSide(
  data: FullData,
  roundGroups: Group[],
  teamsForRound: Team[],
  group: { id: string },
  playerId: string
): Side {
  if (teamsForRound.length === 2) {
    if (
      data.teamMembers.some((m) => m.team_id === teamsForRound[0].id && m.player_id === playerId)
    ) {
      return "A";
    }
    if (
      data.teamMembers.some((m) => m.team_id === teamsForRound[1].id && m.player_id === playerId)
    ) {
      return "B";
    }
    return null;
  }
  return groupSide(roundGroups, teamsForRound, group);
}

export default function MatchupsPage() {
  const [data, setData] = useState<FullData | null>(null);

  const load = useCallback(() => {
    fetchAll().then(setData);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(
    [
      "groups",
      "group_members",
      "teams",
      "team_members",
      "hole_scores",
      "scramble_scores",
      "round_handicaps",
    ],
    load
  );

  if (!data) return <p className="text-neutral-400">Loading…</p>;

  if (data.rounds.length === 0) {
    return <p className="text-neutral-300">No rounds configured yet.</p>;
  }

  return (
    <div className="space-y-6">
      {data.rounds.map((round) => {
        const groups = data.groups
          .filter((g) => g.round_id === round.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const teamsForRound = roundTeams(data, round.id);
        const course = round.course ? COURSES[round.course] : undefined;

        return (
          <section key={round.id}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">
                {round.label}
                {round.course && (
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    {round.course}
                  </span>
                )}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  round.format === "scramble"
                    ? "bg-purple-900/60 text-purple-200"
                    : "bg-emerald-900/60 text-emerald-200"
                }`}
              >
                {round.format === "scramble" ? "Scramble" : "Individual"}
              </span>
            </div>

            {groups.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-800 px-4 py-6 text-center text-sm text-neutral-500">
                No matchups set for this round yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.map((g) => {
                  const memberIds = data.groupMembers
                    .filter((m) => m.group_id === g.id)
                    .map((m) => m.player_id);
                  const members = memberIds
                    .map((id) => data.players.find((p) => p.id === id))
                    .filter((p): p is NonNullable<typeof p> => Boolean(p));
                  const toPar =
                    round.format === "scramble"
                      ? scrambleToPar(data, round, course, g.id)
                      : null;

                  return (
                    <div
                      key={g.id}
                      className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className={`font-medium ${sideColor(groupSide(groups, teamsForRound, g))}`}>
                          {g.name}
                        </span>
                        {round.format === "scramble" && (
                          <span className="text-sm text-neutral-300">
                            {toPar != null
                              ? toPar === 0
                                ? "E"
                                : toPar > 0
                                  ? `+${toPar}`
                                  : toPar
                              : "No score yet"}
                          </span>
                        )}
                      </div>
                      {round.format === "individual" && (
                        <div className="mb-1 flex justify-between text-xs uppercase tracking-wide text-neutral-500">
                          <span>Player</span>
                          <span>Gross / Net</span>
                        </div>
                      )}
                      <ul className="space-y-1 text-sm text-neutral-300">
                        {members.map((p) => {
                          const nameClass = sideColor(
                            playerSide(data, groups, teamsForRound, g, p.id)
                          );
                          if (round.format !== "individual") {
                            return (
                              <li key={p.id} className={nameClass}>
                                {p.name}
                              </li>
                            );
                          }
                          const scores = data.holeScores.filter(
                            (s) => s.round_id === round.id && s.player_id === p.id
                          );
                          const gross = scores.length ? grossTotal(scores) : null;
                          const hcp = effectiveHandicap(
                            p.id,
                            p.handicap,
                            round.id,
                            data.roundHandicaps
                          );
                          return (
                            <li key={p.id} className="flex justify-between">
                              <span className={nameClass}>{p.name}</span>
                              <span className="text-neutral-500">
                                {gross != null ? `${gross}/${netScore(gross, hcp)}` : "–"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
