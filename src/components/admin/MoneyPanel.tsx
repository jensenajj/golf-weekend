"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { MoneySettings, Round, RoundPayout } from "@/lib/types";

export function MoneyPanel() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [payouts, setPayouts] = useState<RoundPayout[]>([]);
  const [settings, setSettings] = useState<MoneySettings | null>(null);

  const load = useCallback(() => {
    Promise.all([
      supabase.from("rounds").select("*").order("sort_order"),
      supabase.from("round_payouts").select("*"),
      supabase.from("money_settings").select("*").eq("id", "default").maybeSingle(),
    ]).then(([r, p, s]) => {
      setRounds(r.data ?? []);
      setPayouts(p.data ?? []);
      setSettings(s.data ?? null);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(["round_payouts", "money_settings"], load);

  async function setTotalPot(value: string) {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    await supabase.from("money_settings").upsert({ id: "default", total_pot: num });
    load();
  }

  async function setAmount(roundId: string, field: "win_amount" | "tie_amount", value: string) {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const existing = payouts.find((p) => p.round_id === roundId);
    await supabase.from("round_payouts").upsert(
      {
        round_id: roundId,
        win_amount: field === "win_amount" ? num : existing?.win_amount ?? 20,
        tie_amount: field === "tie_amount" ? num : existing?.tie_amount ?? 10,
      },
      { onConflict: "round_id" }
    );
    load();
  }

  const totalPot = settings?.total_pot ?? 800;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
        <label className="flex items-center justify-between text-sm">
          <span className="font-medium">Total pot</span>
          <span className="flex items-center gap-1">
            $
            <input
              key={totalPot}
              defaultValue={totalPot}
              onBlur={(e) => setTotalPot(e.target.value)}
              inputMode="decimal"
              className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-center"
            />
          </span>
        </label>
      </div>

      <p className="text-xs text-neutral-500">
        Win amount pays each player on the winning side (winning group for AM rounds, winning
        team for scrambles). Tie amount pays every player involved (all 8) instead if that
        round&apos;s game ends tied.
      </p>

      <div className="space-y-2">
        {rounds.map((r) => {
          const p = payouts.find((x) => x.round_id === r.id);
          const win = p?.win_amount ?? 20;
          const tie = p?.tie_amount ?? 10;
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2"
            >
              <span className="font-medium">
                {r.label}
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  {r.format === "scramble" ? "Scramble" : "Individual"}
                </span>
              </span>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1 text-neutral-400">
                  Win $
                  <input
                    key={`${r.id}-win-${win}`}
                    defaultValue={win}
                    onBlur={(e) => setAmount(r.id, "win_amount", e.target.value)}
                    inputMode="decimal"
                    className="w-14 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-center"
                  />
                </label>
                <label className="flex items-center gap-1 text-neutral-400">
                  Tie $
                  <input
                    key={`${r.id}-tie-${tie}`}
                    defaultValue={tie}
                    onBlur={(e) => setAmount(r.id, "tie_amount", e.target.value)}
                    inputMode="decimal"
                    className="w-14 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-center"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
