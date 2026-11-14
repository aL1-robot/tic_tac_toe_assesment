"use client";

import { useEffect, useState } from "react";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

export type LobbyPlayer = { key: string; name: string; isYou: boolean };

export function usePresenceLobby(userId: string | null, username: string | null) {
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      return;
    }

    const presenceKey = userId ?? crypto.randomUUID();
    const channel = createClient().channel("lobby", {
      config: { presence: { key: presenceKey } },
    });
    let active = true;

    const syncPlayers = () => {
      if (!active) return;
      const state = channel.presenceState<{ name?: string }>();
      const roster = Object.entries(state).map(([key, presences]) => ({
        key,
        name: presences[0]?.name || "Guest",
        isYou: key === presenceKey,
      }));
      roster.sort((a, b) => Number(b.isYou) - Number(a.isYou) || a.name.localeCompare(b.name));
      setPlayers(roster);
    };

    channel
      .on("presence", { event: "sync" }, syncPlayers)
      .subscribe(async (status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          const trackStatus = await channel.track({ name: username ?? "Guest" });
          if (trackStatus !== "ok") {
            console.error("Could not publish lobby presence.", trackStatus);
            setConnected(false);
          }
          syncPlayers();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    return () => {
      active = false;
      void createClient().removeChannel(channel);
    };
  }, [userId, username]);

  return { players, connected };
}
