"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayers } from "@/components/PlayerProvider";

export function PlayersPanel() {
  const { players, refreshPlayers } = usePlayers();
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPlayer() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    setError(null);
    const { error } = await supabase.from("players").insert({
      name: trimmed,
      handicap: handicap === "" ? 0 : Number(handicap),
    });
    setAdding(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setHandicap("");
    refreshPlayers();
  }

  async function updateHandicap(id: string, value: string) {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    await supabase.from("players").update({ handicap: num }).eq("id", id);
    refreshPlayers();
  }

  async function removePlayer(id: string) {
    await supabase.from("players").delete().eq("id", id);
    refreshPlayers();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
        <p className="mb-2 text-sm font-medium text-neutral-300">Add player</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
          <input
            value={handicap}
            onChange={(e) => setHandicap(e.target.value.replace(/[^0-9.-]/g, ""))}
            placeholder="Handicap"
            inputMode="decimal"
            className="w-24 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
          <button
            onClick={addPlayer}
            disabled={adding || !name.trim()}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      <div className="space-y-2">
        {players.length === 0 && (
          <p className="text-sm text-neutral-500">No players yet.</p>
        )}
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2"
          >
            <span className="font-medium">{p.name}</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-neutral-400">
                Hcp
                <input
                  defaultValue={p.handicap}
                  onBlur={(e) => updateHandicap(p.id, e.target.value)}
                  inputMode="decimal"
                  className="w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-center"
                />
              </label>
              <button
                onClick={() => removePlayer(p.id)}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
