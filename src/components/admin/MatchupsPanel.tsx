"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayers } from "@/components/PlayerProvider";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { Group, GroupMember, Round } from "@/lib/types";

export function MatchupsPanel() {
  const { players } = usePlayers();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      supabase.from("rounds").select("*").order("sort_order"),
      supabase.from("groups").select("*").order("sort_order"),
      supabase.from("group_members").select("*"),
    ]).then(([r, g, m]) => {
      setRounds(r.data ?? []);
      setGroups(g.data ?? []);
      setMembers(m.data ?? []);
      setRoundId((prev) => prev ?? (r.data && r.data.length > 0 ? r.data[0].id : null));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(["groups", "group_members"], load);

  const round = rounds.find((r) => r.id === roundId) ?? null;
  const roundGroups = groups
    .filter((g) => g.round_id === roundId)
    .sort((a, b) => a.sort_order - b.sort_order);

  async function addGroup() {
    if (!roundId) return;
    const nextIndex = roundGroups.length + 1;
    const defaultName =
      round?.format === "scramble" ? `Team ${nextIndex}` : `Group ${nextIndex}`;
    await supabase.from("groups").insert({
      round_id: roundId,
      name: defaultName,
      sort_order: nextIndex,
    });
    load();
  }

  async function renameGroup(id: string, name: string) {
    if (!name.trim()) return;
    await supabase.from("groups").update({ name: name.trim() }).eq("id", id);
    load();
  }

  async function setTeamScore(id: string, value: string) {
    const score = value === "" ? null : Number(value);
    await supabase
      .from("groups")
      .update({ team_score: Number.isFinite(score as number) ? score : null })
      .eq("id", id);
    load();
  }

  async function deleteGroup(id: string) {
    await supabase.from("groups").delete().eq("id", id);
    load();
  }

  async function toggleMember(groupId: string, playerId: string, inGroup: boolean) {
    if (inGroup) {
      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("player_id", playerId);
    } else {
      await supabase
        .from("group_members")
        .insert({ group_id: groupId, player_id: playerId });
    }
    load();
  }

  if (players.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Add players first before building matchups.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {rounds.map((r) => (
          <button
            key={r.id}
            onClick={() => setRoundId(r.id)}
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
          <button
            onClick={addGroup}
            className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700"
          >
            + Add {round.format === "scramble" ? "team" : "group"}
          </button>

          <div className="space-y-3">
            {roundGroups.map((g) => {
              const memberIds = new Set(
                members.filter((m) => m.group_id === g.id).map((m) => m.player_id)
              );
              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={g.name}
                      onBlur={(e) => renameGroup(g.id, e.target.value)}
                      className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm font-medium"
                    />
                    {round.format === "scramble" && (
                      <input
                        defaultValue={g.team_score ?? ""}
                        onBlur={(e) => setTeamScore(g.id, e.target.value)}
                        placeholder="Score"
                        inputMode="numeric"
                        className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-center"
                      />
                    )}
                    <button
                      onClick={() => deleteGroup(g.id)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {players.map((p) => {
                      const active = memberIds.has(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleMember(g.id, p.id, active)}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            active
                              ? "bg-emerald-600 text-white"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {roundGroups.length === 0 && (
              <p className="text-sm text-neutral-500">
                No groups yet for {round.label}.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
