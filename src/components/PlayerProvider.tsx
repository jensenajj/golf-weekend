"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { supabase } from "@/lib/supabase";
import { Player } from "@/lib/types";
import {
  getStoredPlayerId,
  getStoredPlayerIdServerSnapshot,
  setStoredPlayerId,
  subscribeStoredPlayerId,
} from "@/lib/identity";

type PlayerContextValue = {
  players: Player[];
  loading: boolean;
  currentPlayerId: string | null;
  currentPlayer: Player | null;
  setCurrentPlayerId: (id: string) => void;
  refreshPlayers: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const currentPlayerId = useSyncExternalStore(
    subscribeStoredPlayerId,
    getStoredPlayerId,
    getStoredPlayerIdServerSnapshot
  );

  const refreshPlayers = useCallback(() => {
    supabase
      .from("players")
      .select("*")
      .order("name", { ascending: true })
      .then(
        ({ data, error }) => {
          if (!error && data) {
            setPlayers(data);
          }
          setLoading(false);
        },
        () => setLoading(false)
      );
  }, []);

  useEffect(() => {
    refreshPlayers();
  }, [refreshPlayers]);

  const setCurrentPlayerId = useCallback((id: string) => {
    setStoredPlayerId(id);
  }, []);

  const currentPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerId) ?? null,
    [players, currentPlayerId]
  );

  const value = useMemo(
    () => ({
      players,
      loading,
      currentPlayerId,
      currentPlayer,
      setCurrentPlayerId,
      refreshPlayers,
    }),
    [players, loading, currentPlayerId, currentPlayer, setCurrentPlayerId, refreshPlayers]
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayers() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayers must be used within PlayerProvider");
  return ctx;
}
