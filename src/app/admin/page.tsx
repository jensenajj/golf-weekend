"use client";

import { useState } from "react";
import { PlayersPanel } from "@/components/admin/PlayersPanel";
import { MatchupsPanel } from "@/components/admin/MatchupsPanel";
import { ScoresPanel } from "@/components/admin/ScoresPanel";

const TABS = [
  { id: "players", label: "Players & Handicaps" },
  { id: "matchups", label: "Matchups" },
  { id: "scores", label: "Edit Scores" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>("players");

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "bg-emerald-600 text-white"
                : "bg-neutral-800 text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "players" && <PlayersPanel />}
      {tab === "matchups" && <MatchupsPanel />}
      {tab === "scores" && <ScoresPanel />}
    </div>
  );
}
