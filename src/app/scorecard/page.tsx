"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAll, FullData } from "@/lib/data";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { supabase } from "@/lib/supabase";
import { COURSES, DEFAULT_TEE, TeeName } from "@/lib/courseData";

const FRONT = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const BACK = [10, 11, 12, 13, 14, 15, 16, 17, 18];

function cellClass(extra = "") {
  return `min-w-[34px] px-1.5 py-1 text-center ${extra}`;
}

export default function ScorecardPage() {
  const [data, setData] = useState<FullData | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAll().then((d) => {
      setData(d);
      setRoundId((prev) => prev ?? (d.rounds.length > 0 ? d.rounds[0].id : null));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(["rounds", "groups", "group_members", "hole_scores"], load);

  if (!data) return <p className="text-neutral-400">Loading…</p>;

  const round = data.rounds.find((r) => r.id === roundId) ?? null;
  const roundGroups = round
    ? data.groups
        .filter((g) => g.round_id === round.id)
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const group = roundGroups.find((g) => g.id === groupId) ?? roundGroups[0] ?? null;

  const course = round?.course ? COURSES[round.course] : undefined;
  const tee = (course?.tees.includes(round?.tee as TeeName) ? round?.tee : DEFAULT_TEE) as
    | TeeName
    | undefined;

  async function setTee(value: string) {
    if (!round) return;
    await supabase.from("rounds").update({ tee: value }).eq("id", round.id);
    load();
  }

  const memberIds = group
    ? data.groupMembers.filter((m) => m.group_id === group.id).map((m) => m.player_id)
    : [];
  const members = memberIds
    .map((id) => data.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  function strokesFor(playerId: string, hole: number) {
    if (!round) return null;
    const row = data!.holeScores.find(
      (s) => s.round_id === round.id && s.player_id === playerId && s.hole === hole
    );
    return row?.strokes ?? null;
  }

  function sumRange(playerId: string, holes: number[]) {
    const vals = holes.map((h) => strokesFor(playerId, h)).filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
  }

  function sumYards(holes: number[]) {
    if (!course || !tee) return null;
    return holes.reduce((sum, h) => {
      const holeData = course.holes.find((c) => c.hole === h);
      return sum + (holeData?.yards[tee] ?? 0);
    }, 0);
  }

  function sumPar(holes: number[]) {
    if (!course) return null;
    return holes.reduce((sum, h) => {
      const holeData = course.holes.find((c) => c.hole === h);
      return sum + (holeData?.par ?? 0);
    }, 0);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {data.rounds.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setRoundId(r.id);
              setGroupId(null);
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              roundId === r.id
                ? "bg-emerald-600 text-white"
                : "bg-neutral-800 text-neutral-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {round && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {round.label}
                {round.course && (
                  <span className="ml-2 text-sm font-normal text-neutral-500">
                    {round.course}
                  </span>
                )}
              </p>
            </div>
            {course && (
              <label className="flex items-center gap-1.5 text-sm text-neutral-400">
                Tees
                <select
                  value={tee}
                  onChange={(e) => setTee(e.target.value)}
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
                >
                  {course.tees.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {roundGroups.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No {round.format === "scramble" ? "teams" : "groups"} set for this round yet —
              add them in Admin → Matchups.
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto">
              {roundGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGroupId(g.id)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                    group?.id === g.id
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-800 text-neutral-300"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {!course && (
            <p className="text-sm text-amber-400">
              No yardage data found for &quot;{round.course}&quot;.
            </p>
          )}

          {course && group && round.format === "scramble" && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
              <p className="font-medium">{group.name}</p>
              <p className="text-sm text-neutral-400">
                {members.map((m) => m.name).join(", ") || "No players assigned"}
              </p>
              {group.team_score != null && (
                <p className="mt-1 text-sm text-neutral-300">
                  Team score: <span className="font-medium">{group.team_score}</span>
                </p>
              )}
            </div>
          )}

          {course && group && (
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="text-sm">
                <thead className="bg-neutral-900 text-neutral-400">
                  <tr>
                    <th className={cellClass("text-left sticky left-0 bg-neutral-900")}>Hole</th>
                    {FRONT.map((h) => (
                      <th key={h} className={cellClass()}>{h}</th>
                    ))}
                    <th className={cellClass("font-semibold")}>OUT</th>
                    {BACK.map((h) => (
                      <th key={h} className={cellClass()}>{h}</th>
                    ))}
                    <th className={cellClass("font-semibold")}>IN</th>
                    <th className={cellClass("font-semibold")}>TOT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-neutral-800 text-neutral-400">
                    <td className={cellClass("text-left sticky left-0 bg-neutral-950")}>Par</td>
                    {FRONT.map((h) => (
                      <td key={h} className={cellClass()}>
                        {course.holes.find((c) => c.hole === h)?.par}
                      </td>
                    ))}
                    <td className={cellClass("font-semibold")}>{sumPar(FRONT)}</td>
                    {BACK.map((h) => (
                      <td key={h} className={cellClass()}>
                        {course.holes.find((c) => c.hole === h)?.par}
                      </td>
                    ))}
                    <td className={cellClass("font-semibold")}>{sumPar(BACK)}</td>
                    <td className={cellClass("font-semibold")}>{sumPar([...FRONT, ...BACK])}</td>
                  </tr>
                  <tr className="border-t border-neutral-800 text-neutral-500">
                    <td className={cellClass("text-left sticky left-0 bg-neutral-950")}>Yds</td>
                    {FRONT.map((h) => (
                      <td key={h} className={cellClass()}>
                        {course.holes.find((c) => c.hole === h)?.yards[tee!]}
                      </td>
                    ))}
                    <td className={cellClass("font-semibold")}>{sumYards(FRONT)}</td>
                    {BACK.map((h) => (
                      <td key={h} className={cellClass()}>
                        {course.holes.find((c) => c.hole === h)?.yards[tee!]}
                      </td>
                    ))}
                    <td className={cellClass("font-semibold")}>{sumYards(BACK)}</td>
                    <td className={cellClass("font-semibold")}>
                      {sumYards([...FRONT, ...BACK])}
                    </td>
                  </tr>

                  {round.format === "individual" &&
                    (members.length > 0 ? members : []).map((m) => (
                      <tr key={m.id} className="border-t border-neutral-800">
                        <td className={cellClass("text-left sticky left-0 bg-neutral-950 font-medium")}>
                          {m.name}
                        </td>
                        {FRONT.map((h) => (
                          <td key={h} className={cellClass()}>
                            {strokesFor(m.id, h) ?? "–"}
                          </td>
                        ))}
                        <td className={cellClass("font-semibold")}>
                          {sumRange(m.id, FRONT) ?? "–"}
                        </td>
                        {BACK.map((h) => (
                          <td key={h} className={cellClass()}>
                            {strokesFor(m.id, h) ?? "–"}
                          </td>
                        ))}
                        <td className={cellClass("font-semibold")}>
                          {sumRange(m.id, BACK) ?? "–"}
                        </td>
                        <td className={cellClass("font-semibold")}>
                          {sumRange(m.id, [...FRONT, ...BACK]) ?? "–"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {round.format === "individual" && group && members.length === 0 && (
            <p className="text-sm text-neutral-500">
              No players assigned to {group.name} yet — add them in Admin → Matchups.
            </p>
          )}
        </>
      )}
    </div>
  );
}
