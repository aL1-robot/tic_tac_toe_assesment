"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

export type LeaderboardEntry = Database["public"]["Views"]["leaderboard"]["Row"];

export function useLeaderboard() {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(() => hasSupabaseConfig());
  const [error, setError] = useState<string | null>(() =>
    hasSupabaseConfig() ? null : "Leaderboard is unavailable until Supabase is configured.",
  );

  const refresh = useCallback(async () => {
    if (!hasSupabaseConfig()) {
      setRows([]);
      setLoading(false);
      setError("Leaderboard is unavailable until Supabase is configured.");
      return;
    }

    const { data, error: queryError } = await createClient()
      .from("leaderboard")
      .select("user_id, username, wins, draws, losses, points, rank")
      .order("rank", { ascending: true });

    if (queryError) {
      console.error("Could not load the leaderboard.", queryError);
      setError("Couldn’t load the leaderboard. Try again.");
    } else {
      setRows(data ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    void Promise.resolve().then(() => refresh());

    const supabase = createClient();
    const channel = supabase
      .channel("leaderboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_stats" },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Leaderboard realtime subscription failed.", status);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { rows, loading, error, refresh };
}
