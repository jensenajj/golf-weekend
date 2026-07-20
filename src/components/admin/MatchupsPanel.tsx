"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayers } from "@/components/PlayerProvider";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { RANK_LABELS, syncOnCourseGroups } from "@/lib/singlesMatch";
import { Cart, CartMember, Group, GroupMember, Player, Round, Team, TeamMember } from "@/lib/types";

export function MatchupsPanel() {
  const { players } = usePlayers();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [cartMembers, setCartMembers] = useState<CartMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      supabase.from("rounds").select("*").order("sort_order"),
      supabase.from("groups").select("*").order("sort_order"),
      supabase.from("group_members").select("*"),
      supabase.from("carts").select("*").order("sort_order"),
      supabase.from("cart_members").select("*"),
      supabase.from("teams").select("*").order("sort_order"),
      supabase.from("team_members").select("*"),
    ]).then(([r, g, m, c, cm, t, tm]) => {
      setRounds(r.data ?? []);
      setGroups(g.data ?? []);
      setMembers(m.data ?? []);
      setCarts(c.data ?? []);
      setCartMembers(cm.data ?? []);
      setTeams(t.data ?? []);
      setTeamMembers(tm.data ?? []);
      setRoundId((prev) => prev ?? (r.data && r.data.length > 0 ? r.data[0].id : null));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(
    ["groups", "group_members", "carts", "cart_members", "teams", "team_members"],
    load
  );

  const round = rounds.find((r) => r.id === roundId) ?? null;
  const roundGroups = groups
    .filter((g) => g.round_id === roundId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const roundTeams = teams
    .filter((t) => t.round_id === roundId)
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

  async function setScorekeeper(groupId: string, playerId: string) {
    await supabase
      .from("groups")
      .update({ scorekeeper_id: playerId || null })
      .eq("id", groupId);
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
      // Drop them from any cart in this group too, since they're no longer a member.
      const groupCartIds = carts.filter((c) => c.group_id === groupId).map((c) => c.id);
      if (groupCartIds.length > 0) {
        await supabase
          .from("cart_members")
          .delete()
          .eq("player_id", playerId)
          .in("cart_id", groupCartIds);
      }
    } else {
      await supabase
        .from("group_members")
        .insert({ group_id: groupId, player_id: playerId });
    }
    load();
  }

  async function addCart(groupId: string) {
    const nextIndex = carts.filter((c) => c.group_id === groupId).length + 1;
    const letter = String.fromCharCode(64 + nextIndex); // 1->A, 2->B, ...
    await supabase.from("carts").insert({
      group_id: groupId,
      name: `Cart ${letter}`,
      sort_order: nextIndex,
    });
    load();
  }

  async function renameCart(id: string, name: string) {
    if (!name.trim()) return;
    await supabase.from("carts").update({ name: name.trim() }).eq("id", id);
    load();
  }

  async function deleteCart(id: string) {
    await supabase.from("carts").delete().eq("id", id);
    load();
  }

  async function toggleCartMember(cartId: string, playerId: string, inCart: boolean) {
    if (inCart) {
      await supabase
        .from("cart_members")
        .delete()
        .eq("cart_id", cartId)
        .eq("player_id", playerId);
    } else {
      await supabase.from("cart_members").insert({ cart_id: cartId, player_id: playerId });
    }
    load();
  }

  function rankedMembers(teamId: string): Player[] {
    const ids = new Set(
      teamMembers.filter((m) => m.team_id === teamId).map((m) => m.player_id)
    );
    return players
      .filter((p) => ids.has(p.id))
      .sort((a, b) => a.handicap - b.handicap || a.name.localeCompare(b.name));
  }

  async function setUpTeams() {
    if (!roundId) return;
    await supabase.from("teams").insert([
      { round_id: roundId, name: "Team 1", sort_order: 1 },
      { round_id: roundId, name: "Team 2", sort_order: 2 },
    ]);
    load();
  }

  async function removeTeams() {
    if (roundTeams.length === 0) return;
    await supabase
      .from("teams")
      .delete()
      .in("id", roundTeams.map((t) => t.id));
    load();
  }

  async function renameTeam(id: string, name: string) {
    if (!name.trim()) return;
    await supabase.from("teams").update({ name: name.trim() }).eq("id", id);
    load();
  }

  async function toggleTeamMember(teamId: string, playerId: string, onTeam: boolean) {
    if (onTeam) {
      await supabase
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .eq("player_id", playerId);
    } else {
      // A player can only be on one of the round's two teams at a time.
      const otherTeamIds = roundTeams.map((t) => t.id).filter((id) => id !== teamId);
      if (otherTeamIds.length > 0) {
        await supabase
          .from("team_members")
          .delete()
          .eq("player_id", playerId)
          .in("team_id", otherTeamIds);
      }
      await supabase.from("team_members").insert({ team_id: teamId, player_id: playerId });
    }

    const { data: freshMembers } = await supabase.from("team_members").select("*");
    const nextMembers = freshMembers ?? [];
    setTeamMembers(nextMembers);

    if (round && roundTeams.length === 2) {
      const rank = (teamId2: string) => {
        const ids = new Set(
          nextMembers.filter((m) => m.team_id === teamId2).map((m) => m.player_id)
        );
        return players
          .filter((p) => ids.has(p.id))
          .sort((a, b) => a.handicap - b.handicap || a.name.localeCompare(b.name));
      };
      const rankedA = rank(roundTeams[0].id);
      const rankedB = rank(roundTeams[1].id);
      if (rankedA.length === 4 && rankedB.length === 4) {
        await syncOnCourseGroups(round, roundTeams[0], roundTeams[1], rankedA, rankedB);
      }
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
              const groupMembers = players.filter((p) => memberIds.has(p.id));
              const groupCarts = carts
                .filter((c) => c.group_id === g.id)
                .sort((a, b) => a.sort_order - b.sort_order);

              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={g.name}
                      onBlur={(e) => renameGroup(g.id, e.target.value)}
                      className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm font-medium"
                    />
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

                  <label className="flex items-center gap-2 text-xs text-neutral-400">
                    Scorekeeper
                    <select
                      value={g.scorekeeper_id ?? ""}
                      onChange={(e) => setScorekeeper(g.id, e.target.value)}
                      className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100"
                    >
                      <option value="">None yet</option>
                      {groupMembers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {round.format === "individual" && (
                    <>
                      <div className="space-y-1.5 border-t border-neutral-800 pt-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-neutral-500">Carts</p>
                          <button
                            onClick={() => addCart(g.id)}
                            className="text-xs text-emerald-400 hover:text-emerald-300"
                          >
                            + Add cart
                          </button>
                        </div>
                        {groupCarts.length === 0 && (
                          <p className="text-xs text-neutral-600">No carts assigned yet.</p>
                        )}
                        {groupCarts.map((c) => {
                          const cartMemberIds = new Set(
                            cartMembers
                              .filter((cm) => cm.cart_id === c.id)
                              .map((cm) => cm.player_id)
                          );
                          return (
                            <div key={c.id} className="flex items-center gap-2">
                              <input
                                defaultValue={c.name}
                                onBlur={(e) => renameCart(c.id, e.target.value)}
                                className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
                              />
                              <div className="flex flex-1 flex-wrap gap-1">
                                {groupMembers.map((p) => {
                                  const active = cartMemberIds.has(p.id);
                                  return (
                                    <button
                                      key={p.id}
                                      onClick={() => toggleCartMember(c.id, p.id, active)}
                                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                        active
                                          ? "bg-sky-600 text-white"
                                          : "bg-neutral-800 text-neutral-400"
                                      }`}
                                    >
                                      {p.name}
                                    </button>
                                  );
                                })}
                              </div>
                              <button
                                onClick={() => deleteCart(c.id)}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Delete
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            {roundGroups.length === 0 && (
              <p className="text-sm text-neutral-500">
                No groups yet for {round.label}.
              </p>
            )}
          </div>

          {round.format === "individual" && (
            <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/20 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Singles Match Play (optional)</p>
                  <p className="text-xs text-neutral-500">
                    Set up 2 teams of 4. Once both are full, the A/B/C/D-ranked (by handicap)
                    on-course Groups/Carts above get regenerated automatically so A can play A,
                    B play B, etc. — and Games/Money switch this round to the singles format.
                  </p>
                </div>
                {roundTeams.length === 0 ? (
                  <button
                    onClick={setUpTeams}
                    className="shrink-0 rounded-full bg-neutral-800 px-3 py-1.5 text-xs font-medium hover:bg-neutral-700"
                  >
                    + Set up teams
                  </button>
                ) : (
                  <button
                    onClick={removeTeams}
                    className="shrink-0 text-xs text-red-400 hover:text-red-300"
                  >
                    Remove teams
                  </button>
                )}
              </div>

              {roundTeams.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {roundTeams.map((t) => {
                    const ranked = rankedMembers(t.id);
                    const memberIds = new Set(ranked.map((p) => p.id));
                    return (
                      <div
                        key={t.id}
                        className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3"
                      >
                        <input
                          defaultValue={t.name}
                          onBlur={(e) => renameTeam(t.id, e.target.value)}
                          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm font-medium"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {players.map((p) => {
                            const active = memberIds.has(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => toggleTeamMember(t.id, p.id, active)}
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
                        {ranked.length > 0 && (
                          <p className="text-xs text-neutral-500">
                            {ranked
                              .map((p, i) => `${RANK_LABELS[i]}: ${p.name} (${p.handicap})`)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
