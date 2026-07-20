"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { fetchAll, FullData } from "@/lib/data";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { supabase } from "@/lib/supabase";
import { COURSES, DEFAULT_TEE, TeeName, hasHandicapData } from "@/lib/courseData";
import { effectiveHandicap, lockRoundHandicapIfNeeded, strokesReceived } from "@/lib/handicap";
import { scrambleHolesEntered, scrambleStrokesFor, scrambleToPar } from "@/lib/scramble";
import { computeAllSkins } from "@/lib/skins";
import { usePlayers } from "@/components/PlayerProvider";
import { Player } from "@/lib/types";

const FRONT = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const BACK = [10, 11, 12, 13, 14, 15, 16, 17, 18];

function cellClass(extra = "") {
  return `min-w-[36px] px-1.5 py-1 text-center ${extra}`;
}

function strokeBg(n: number) {
  if (n >= 2) return "bg-sky-500/25";
  if (n === 1) return "bg-sky-500/10";
  return "";
}

function skinBg(won: boolean) {
  return won ? "bg-amber-400/30 ring-1 ring-inset ring-amber-400" : "";
}

function statusRing(status: CellStatus | undefined) {
  if (status === "error") return "ring-2 ring-inset ring-red-500";
  if (status === "saving") return "ring-1 ring-inset ring-amber-400";
  if (status === "saved") return "ring-1 ring-inset ring-emerald-400";
  return "";
}

type CellStatus = "saving" | "saved" | "error";

function cellKey(roundId: string, playerId: string, hole: number) {
  return `${roundId}:${playerId}:${hole}`;
}

export default function ScorecardPage() {
  const { currentPlayer } = usePlayers();
  const [data, setData] = useState<FullData | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [cellStatus, setCellStatus] = useState<Record<string, CellStatus>>({});

  const load = useCallback(() => {
    fetchAll().then((d) => {
      setData(d);
      setRoundId((prev) => prev ?? (d.rounds.length > 0 ? d.rounds[0].id : null));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(
    [
      "rounds",
      "groups",
      "group_members",
      "carts",
      "cart_members",
      "hole_scores",
      "scramble_scores",
      "round_handicaps",
    ],
    load
  );

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
  const showHandicap =
    round?.format === "individual" && course ? hasHandicapData(course) : false;

  const skinWinnerByHole = new Map<number, string>();
  if (round?.format === "individual") {
    for (const s of computeAllSkins(data).holes) {
      if (s.round.id === round.id && s.winnerId) skinWinnerByHole.set(s.hole, s.winnerId);
    }
  }
  function isSkinWinner(playerId: string, hole: number) {
    return skinWinnerByHole.get(hole) === playerId;
  }

  async function setTee(value: string) {
    if (!round) return;
    await supabase.from("rounds").update({ tee: value }).eq("id", round.id);
    load();
  }

  async function claimScorekeeper() {
    if (!group || !currentPlayer) return;
    await supabase
      .from("groups")
      .update({ scorekeeper_id: currentPlayer.id })
      .eq("id", group.id);
    load();
  }

  async function releaseScorekeeper() {
    if (!group) return;
    await supabase.from("groups").update({ scorekeeper_id: null }).eq("id", group.id);
    load();
  }

  const memberIds = group
    ? data.groupMembers.filter((m) => m.group_id === group.id).map((m) => m.player_id)
    : [];
  const members = memberIds
    .map((id) => data.players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));

  const groupCarts = group
    ? data.carts.filter((c) => c.group_id === group.id).sort((a, b) => a.sort_order - b.sort_order)
    : [];

  const failedCells = round
    ? Object.entries(cellStatus)
        .filter(([key, status]) => status === "error" && key.startsWith(`${round.id}:`))
        .map(([key]) => {
          const [, playerId, holeStr] = key.split(":");
          return {
            key,
            hole: Number(holeStr),
            playerName: data.players.find((p) => p.id === playerId)?.name ?? "?",
          };
        })
        .sort((a, b) => a.hole - b.hole)
    : [];

  function cartLabel() {
    return groupCarts
      .map((c) => {
        const names = data!.cartMembers
          .filter((cm) => cm.cart_id === c.id)
          .map((cm) => data!.players.find((p) => p.id === cm.player_id)?.name)
          .filter(Boolean)
          .join(", ");
        return `${c.name}: ${names || "—"}`;
      })
      .join(" · ");
  }

  function strokesFor(playerId: string, hole: number) {
    if (!round) return null;
    const row = data!.holeScores.find(
      (s) => s.round_id === round.id && s.player_id === playerId && s.hole === hole
    );
    return row?.strokes ?? null;
  }

  function holeInfo(hole: number) {
    return course?.holes.find((c) => c.hole === hole);
  }

  function roundHandicapFor(playerId: string, globalHandicap: number) {
    if (!round) return globalHandicap;
    return effectiveHandicap(playerId, globalHandicap, round.id, data!.roundHandicaps);
  }

  function isLocked(playerId: string) {
    if (!round) return false;
    return data!.roundHandicaps.some(
      (rh) => rh.round_id === round.id && rh.player_id === playerId
    );
  }

  const canEdit = Boolean(group && currentPlayer && group.scorekeeper_id === currentPlayer.id);

  async function saveWithStatus(key: string, action: () => Promise<{ error: unknown }>) {
    setCellStatus((prev) => ({ ...prev, [key]: "saving" }));
    try {
      const result = await action();
      if (result.error) throw result.error;

      setCellStatus((prev) => ({ ...prev, [key]: "saved" }));
      setTimeout(() => {
        setCellStatus((prev) => {
          if (prev[key] !== "saved") return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 1500);
      load();
    } catch {
      setCellStatus((prev) => ({ ...prev, [key]: "error" }));
    }
  }

  async function saveScore(playerId: string, hole: number, raw: string) {
    if (!round) return;
    const trimmed = raw.trim();
    if (trimmed !== "") {
      const strokes = parseInt(trimmed, 10);
      if (!Number.isFinite(strokes) || strokes <= 0) return;
    }

    const key = cellKey(round.id, playerId, hole);
    await saveWithStatus(key, async () => {
      const result =
        trimmed === ""
          ? await supabase
              .from("hole_scores")
              .delete()
              .eq("round_id", round.id)
              .eq("player_id", playerId)
              .eq("hole", hole)
          : await supabase.from("hole_scores").upsert(
              { round_id: round.id, player_id: playerId, hole, strokes: parseInt(trimmed, 10) },
              { onConflict: "round_id,player_id,hole" }
            );

      if (!result.error && trimmed !== "") {
        const player = data!.players.find((p) => p.id === playerId);
        if (player) {
          await lockRoundHandicapIfNeeded(round.id, playerId, player.handicap);
        }
      }
      return result;
    });
  }

  async function saveScrambleScore(groupId: string, hole: number, raw: string) {
    if (!round) return;
    const trimmed = raw.trim();
    if (trimmed !== "") {
      const strokes = parseInt(trimmed, 10);
      if (!Number.isFinite(strokes) || strokes <= 0) return;
    }

    const key = cellKey(round.id, groupId, hole);
    await saveWithStatus(key, async () =>
      trimmed === ""
        ? await supabase
            .from("scramble_scores")
            .delete()
            .eq("round_id", round.id)
            .eq("group_id", groupId)
            .eq("hole", hole)
        : await supabase.from("scramble_scores").upsert(
            { round_id: round.id, group_id: groupId, hole, strokes: parseInt(trimmed, 10) },
            { onConflict: "group_id,hole" }
          )
    );
  }

  function sumGross(playerId: string, holes: number[]) {
    const vals = holes
      .map((h) => strokesFor(playerId, h))
      .filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
  }

  function sumNet(playerId: string, handicap: number, holes: number[]) {
    if (!showHandicap) return null;
    const vals = holes
      .map((h) => {
        const gross = strokesFor(playerId, h);
        if (gross == null) return null;
        return gross - strokesReceived(handicap, holeInfo(h)?.handicap);
      })
      .filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
  }

  function sumYards(holes: number[]) {
    if (!course || !tee) return null;
    return holes.reduce((sum, h) => sum + (holeInfo(h)?.yards[tee] ?? 0), 0);
  }

  function sumPar(holes: number[]) {
    if (!course) return null;
    return holes.reduce((sum, h) => sum + (holeInfo(h)?.par ?? 0), 0);
  }

  function scrambleTotalFor(holes: number[]) {
    if (!group) return null;
    const vals = holes
      .map((h) => scrambleStrokesFor(data!, group.id, h))
      .filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
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
            <p className="font-semibold">
              {round.label}
              {round.course && (
                <span className="ml-2 text-sm font-normal text-neutral-500">
                  {round.course}
                </span>
              )}
            </p>
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

          {group && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm">
              <div>
                {group.scorekeeper_id ? (
                  <span className="text-neutral-300">
                    Scorekeeper:{" "}
                    <span className="font-medium text-neutral-100">
                      {data.players.find((p) => p.id === group.scorekeeper_id)?.name}
                    </span>
                    {currentPlayer?.id === group.scorekeeper_id && " (you)"}
                  </span>
                ) : (
                  <span className="text-neutral-500">No scorekeeper claimed yet.</span>
                )}
              </div>
              {currentPlayer && memberIds.includes(currentPlayer.id) && (
                <>
                  {group.scorekeeper_id === currentPlayer.id ? (
                    <button
                      onClick={releaseScorekeeper}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Release
                    </button>
                  ) : !group.scorekeeper_id ? (
                    <button
                      onClick={claimScorekeeper}
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
                    >
                      Become scorekeeper
                    </button>
                  ) : null}
                </>
              )}
            </div>
          )}

          {round.format === "individual" && groupCarts.length > 0 && (
            <p className="text-xs text-neutral-500">{cartLabel()}</p>
          )}

          {group && round.format === "scramble" && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
              <p className="font-medium">{group.name}</p>
              <p className="text-sm text-neutral-400">
                {members.map((m) => m.name).join(", ") || "No players assigned"}
              </p>
              <p className="mt-1 text-sm text-neutral-300">
                Thru {scrambleHolesEntered(data, group.id)}/18
                {(() => {
                  const toPar = scrambleToPar(data, round, course, group.id);
                  if (toPar == null) return null;
                  return (
                    <>
                      {" · "}
                      <span className="font-medium">
                        {toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : toPar}
                      </span>{" "}
                      to par
                    </>
                  );
                })()}
              </p>
            </div>
          )}

          {round.format === "individual" && !showHandicap && (
            <p className="text-xs text-amber-400">
              {`Hole handicaps (stroke index) aren't set for ${round.course} yet, so per-hole net scores and stroke indicators aren't shown here. Round totals on the Dashboard still use each player's flat handicap.`}
            </p>
          )}

          {failedCells.length > 0 && (
            <div className="rounded-xl border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              <p className="font-medium">
                {failedCells.length} score{failedCells.length > 1 ? "s" : ""} didn&apos;t save
                — check your connection and re-enter:
              </p>
              <p className="mt-0.5 text-red-400">
                {failedCells.map((c) => `${c.playerName} hole ${c.hole}`).join(", ")}
              </p>
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
                      <td key={h} className={cellClass()}>{holeInfo(h)?.par}</td>
                    ))}
                    <td className={cellClass("font-semibold")}>{sumPar(FRONT)}</td>
                    {BACK.map((h) => (
                      <td key={h} className={cellClass()}>{holeInfo(h)?.par}</td>
                    ))}
                    <td className={cellClass("font-semibold")}>{sumPar(BACK)}</td>
                    <td className={cellClass("font-semibold")}>{sumPar([...FRONT, ...BACK])}</td>
                  </tr>
                  <tr className="border-t border-neutral-800 text-neutral-500">
                    <td className={cellClass("text-left sticky left-0 bg-neutral-950")}>Yds</td>
                    {FRONT.map((h) => (
                      <td key={h} className={cellClass()}>{holeInfo(h)?.yards[tee!]}</td>
                    ))}
                    <td className={cellClass("font-semibold")}>{sumYards(FRONT)}</td>
                    {BACK.map((h) => (
                      <td key={h} className={cellClass()}>{holeInfo(h)?.yards[tee!]}</td>
                    ))}
                    <td className={cellClass("font-semibold")}>{sumYards(BACK)}</td>
                    <td className={cellClass("font-semibold")}>
                      {sumYards([...FRONT, ...BACK])}
                    </td>
                  </tr>
                  {showHandicap && (
                    <tr className="border-t border-neutral-800 text-neutral-600">
                      <td className={cellClass("text-left sticky left-0 bg-neutral-950")}>Hcp</td>
                      {FRONT.map((h) => (
                        <td key={h} className={cellClass()}>{holeInfo(h)?.handicap}</td>
                      ))}
                      <td className={cellClass()} />
                      {BACK.map((h) => (
                        <td key={h} className={cellClass()}>{holeInfo(h)?.handicap}</td>
                      ))}
                      <td className={cellClass()} />
                      <td className={cellClass()} />
                    </tr>
                  )}

                  {round.format === "individual" &&
                    members.map((m) => {
                      const hcp = roundHandicapFor(m.id, m.handicap);
                      const locked = isLocked(m.id);
                      return (
                      <Fragment key={m.id}>
                        <tr className="border-t border-neutral-800">
                          <td className={cellClass("text-left sticky left-0 bg-neutral-950 font-medium")}>
                            {m.name}
                            <span
                              className="ml-1 font-normal text-neutral-500"
                              title={
                                locked
                                  ? `Handicap locked at ${hcp} for this round`
                                  : `Following current handicap (${hcp}) — locks once a score is entered`
                              }
                            >
                              ({hcp}
                              {locked ? "🔒" : ""})
                            </span>
                          </td>
                          {FRONT.map((h) => {
                            const strokes = strokesReceived(hcp, holeInfo(h)?.handicap);
                            const val = strokesFor(m.id, h);
                            const won = isSkinWinner(m.id, h);
                            const status = round ? cellStatus[cellKey(round.id, m.id, h)] : undefined;
                            return (
                              <td
                                key={h}
                                className={cellClass(
                                  `${won ? skinBg(true) : strokeBg(strokes)} ${statusRing(status)}`
                                )}
                                title={won ? "Won the skin on this hole" : undefined}
                              >
                                {canEdit ? (
                                  <input
                                    defaultValue={val ?? ""}
                                    onBlur={(e) => saveScore(m.id, h, e.target.value)}
                                    inputMode="numeric"
                                    className="w-8 bg-transparent text-center outline-none"
                                  />
                                ) : (
                                  val ?? "–"
                                )}
                              </td>
                            );
                          })}
                          <td className={cellClass("font-semibold")}>
                            {sumGross(m.id, FRONT) ?? "–"}
                          </td>
                          {BACK.map((h) => {
                            const strokes = strokesReceived(hcp, holeInfo(h)?.handicap);
                            const val = strokesFor(m.id, h);
                            const won = isSkinWinner(m.id, h);
                            const status = round ? cellStatus[cellKey(round.id, m.id, h)] : undefined;
                            return (
                              <td
                                key={h}
                                className={cellClass(
                                  `${won ? skinBg(true) : strokeBg(strokes)} ${statusRing(status)}`
                                )}
                                title={won ? "Won the skin on this hole" : undefined}
                              >
                                {canEdit ? (
                                  <input
                                    defaultValue={val ?? ""}
                                    onBlur={(e) => saveScore(m.id, h, e.target.value)}
                                    inputMode="numeric"
                                    className="w-8 bg-transparent text-center outline-none"
                                  />
                                ) : (
                                  val ?? "–"
                                )}
                              </td>
                            );
                          })}
                          <td className={cellClass("font-semibold")}>
                            {sumGross(m.id, BACK) ?? "–"}
                          </td>
                          <td className={cellClass("font-semibold")}>
                            {sumGross(m.id, [...FRONT, ...BACK]) ?? "–"}
                          </td>
                        </tr>
                        {showHandicap && (
                          <tr key={`${m.id}-net`} className="text-xs text-sky-300/80">
                            <td className={cellClass("text-left sticky left-0 bg-neutral-950 pl-4")}>
                              net
                            </td>
                            {FRONT.map((h) => {
                              const gross = strokesFor(m.id, h);
                              const net =
                                gross != null
                                  ? gross - strokesReceived(hcp, holeInfo(h)?.handicap)
                                  : null;
                              return (
                                <td key={h} className={cellClass(skinBg(isSkinWinner(m.id, h)))}>
                                  {net ?? "–"}
                                </td>
                              );
                            })}
                            <td className={cellClass("font-semibold")}>
                              {sumNet(m.id, hcp, FRONT) ?? "–"}
                            </td>
                            {BACK.map((h) => {
                              const gross = strokesFor(m.id, h);
                              const net =
                                gross != null
                                  ? gross - strokesReceived(hcp, holeInfo(h)?.handicap)
                                  : null;
                              return (
                                <td key={h} className={cellClass(skinBg(isSkinWinner(m.id, h)))}>
                                  {net ?? "–"}
                                </td>
                              );
                            })}
                            <td className={cellClass("font-semibold")}>
                              {sumNet(m.id, hcp, BACK) ?? "–"}
                            </td>
                            <td className={cellClass("font-semibold")}>
                              {sumNet(m.id, hcp, [...FRONT, ...BACK]) ?? "–"}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                      );
                    })}

                  {round.format === "scramble" && group && (
                    <tr className="border-t border-neutral-800">
                      <td className={cellClass("text-left sticky left-0 bg-neutral-950 font-medium")}>
                        {group.name}
                      </td>
                      {FRONT.map((h) => {
                        const val = scrambleStrokesFor(data, group.id, h);
                        const status = round ? cellStatus[cellKey(round.id, group.id, h)] : undefined;
                        return (
                          <td key={h} className={cellClass(statusRing(status))}>
                            {canEdit ? (
                              <input
                                defaultValue={val ?? ""}
                                onBlur={(e) => saveScrambleScore(group.id, h, e.target.value)}
                                inputMode="numeric"
                                className="w-8 bg-transparent text-center outline-none"
                              />
                            ) : (
                              val ?? "–"
                            )}
                          </td>
                        );
                      })}
                      <td className={cellClass("font-semibold")}>
                        {scrambleTotalFor(FRONT) ?? "–"}
                      </td>
                      {BACK.map((h) => {
                        const val = scrambleStrokesFor(data, group.id, h);
                        const status = round ? cellStatus[cellKey(round.id, group.id, h)] : undefined;
                        return (
                          <td key={h} className={cellClass(statusRing(status))}>
                            {canEdit ? (
                              <input
                                defaultValue={val ?? ""}
                                onBlur={(e) => saveScrambleScore(group.id, h, e.target.value)}
                                inputMode="numeric"
                                className="w-8 bg-transparent text-center outline-none"
                              />
                            ) : (
                              val ?? "–"
                            )}
                          </td>
                        );
                      })}
                      <td className={cellClass("font-semibold")}>
                        {scrambleTotalFor(BACK) ?? "–"}
                      </td>
                      <td className={cellClass("font-semibold")}>
                        {scrambleTotalFor([...FRONT, ...BACK]) ?? "–"}
                      </td>
                    </tr>
                  )}
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
