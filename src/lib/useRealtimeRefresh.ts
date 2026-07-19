"use client";

import { useEffect } from "react";
import { supabase } from "./supabase";

export function useRealtimeRefresh(tables: string[], onChange: () => void) {
  useEffect(() => {
    const channel = supabase.channel(`refresh-${tables.join("-")}`);
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onChange()
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);
}
