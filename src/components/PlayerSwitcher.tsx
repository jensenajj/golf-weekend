"use client";

import { useState } from "react";
import { usePlayers } from "./PlayerProvider";

export function PlayerSwitcher() {
  const { players, currentPlayer, setCurrentPlayerId, loading } = usePlayers();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <span className="text-sm text-neutral-400">Loading…</span>;
  }

  if (players.length === 0) {
    return (
      <span className="text-sm text-neutral-400">
        No players yet — add them in Admin
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-100"
      >
        {currentPlayer ? (
          <>
            Playing as <span className="text-emerald-400">{currentPlayer.name}</span>
          </>
        ) : (
          <span className="text-amber-400">Who are you?</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-xl">
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setCurrentPlayerId(p.id);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-neutral-800 ${
                p.id === currentPlayer?.id
                  ? "text-emerald-400"
                  : "text-neutral-200"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
