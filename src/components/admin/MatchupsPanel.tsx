"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayers } from "@/components/PlayerProvider";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { Cart, CartMember, Group, GroupMember, Round } from "@/lib/types";

export function MatchupsPanel() {
  const { players } = usePlayers();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [cartMembers, setCartMembers] = useState<CartMember[]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      supabase.from("rounds").select("*").order("sort_order"),
      supabase.from("groups").select("*").order("sort_order"),
      supabase.from("group_members").select("*"),
      supabase.from("carts").select("*").order("sort_order"),
      supabase.from("cart_members").select("*"),
    ]).then(([r, g, m, c, cm]) => {
      setRounds(r.data ?? []);
      setGroups(g.data ?? []);
      setMembers(m.data ?? []);
      setCarts(c.data ?? []);
      setCartMembers(cm.data ?? []);
      setRoundId((prev) => prev ?? (r.data && r.data.length > 0 ? r.data[0].id : null));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(["groups", "group_members", "carts", "cart_members"], load);

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

                  {round.format === "individual" && (
                    <>
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
        </>
      )}
    </div>
  );
}
