"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

export type OnlineGame = Database["public"]["Tables"]["games"]["Row"];

function isNewer(candidate: OnlineGame, current: OnlineGame | null): boolean {
  return current === null || Date.parse(candidate.updated_at) >= Date.parse(current.updated_at);
}

function asGame(value: unknown): OnlineGame | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("x_player" in value) ||
    typeof value.x_player !== "string" ||
    !("o_player" in value) ||
    (value.o_player !== null && typeof value.o_player !== "string") ||
    !("board" in value) ||
    typeof value.board !== "string" ||
    value.board.length !== 9 ||
    !("turn" in value) ||
    (value.turn !== "X" && value.turn !== "O") ||
    !("status" in value) ||
    (value.status !== "waiting" && value.status !== "active" && value.status !== "finished") ||
    !("updated_at" in value) ||
    typeof value.updated_at !== "string" ||
    !("created_at" in value) ||
    typeof value.created_at !== "string" ||
    !("last_move_at" in value) ||
    typeof value.last_move_at !== "string" ||
    !("winner" in value) ||
    (value.winner !== null && value.winner !== "X" && value.winner !== "O" && value.winner !== "draw") ||
    !("winning_line" in value) ||
    (value.winning_line !== null &&
      (!Array.isArray(value.winning_line) || value.winning_line.some((cell) => typeof cell !== "number"))) ||
    !("end_reason" in value) ||
    (value.end_reason !== null &&
      value.end_reason !== "line" &&
      value.end_reason !== "full" &&
      value.end_reason !== "resign" &&
      value.end_reason !== "timeout")
  ) {
    return null;
  }
  return {
    id: value.id,
    x_player: value.x_player,
    o_player: value.o_player,
    board: value.board,
    turn: value.turn,
    status: value.status,
    winner: value.winner,
    winning_line: value.winning_line,
    end_reason: value.end_reason,
    created_at: value.created_at,
    updated_at: value.updated_at,
    last_move_at: value.last_move_at,
  };
}

function errorMessage(error: { message: string }): string {
  const known: Record<string, string> = {
    not_your_turn: "It’s not your turn.",
    cell_taken: "That spot is already taken.",
    game_not_active: "This game has already ended.",
    game_not_found: "This game is no longer available.",
    invalid_cell: "That spot isn’t valid.",
    not_waiting_for_opponent: "You can only claim a win on your opponent’s turn.",
    too_early: "It’s too soon to claim a win.",
  };
  for (const [code, message] of Object.entries(known)) {
    if (error.message.includes(code)) return message;
  }
  return "Couldn’t update the game. Please try again.";
}

export function useOnlineGame(enabled: boolean, userId: string | null) {
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const latestGame = useRef<OnlineGame | null>(null);
  const opponentId =
    game && userId
      ? game.x_player === userId
        ? game.o_player
        : game.x_player
      : null;
  const opponentName =
    opponentId && opponentProfile?.id === opponentId ? opponentProfile.name : null;

  const applyGame = useCallback((next: OnlineGame) => {
    if (!isNewer(next, latestGame.current)) return;
    latestGame.current = next;
    setGame(next);
  }, []);

  const refreshGame = useCallback(async (gameId: string) => {
    try {
      const { data, error: queryError } = await createClient()
        .from("games")
        .select("*")
        .eq("id", gameId)
        .maybeSingle();
      if (queryError) throw queryError;
      if (!data) {
        latestGame.current = null;
        setGame(null);
        setOpponentProfile(null);
        setNotice("This game is no longer available. Search again to find an opponent.");
        return;
      }
      const next = asGame(data);
      if (!next) throw new Error("The game service returned an invalid game.");
      applyGame(next);
      setError(null);
    } catch (cause) {
      console.error("Could not refresh the online game.", cause);
      setError("Couldn’t refresh the game. Check your connection and try again.");
    }
  }, [applyGame]);

  const findGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    if (!hasSupabaseConfig()) {
      setError("Online play needs Supabase configuration.");
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await createClient().rpc("find_or_create_game", {});
      if (rpcError) throw rpcError;
      const next = asGame(data);
      if (!next) throw new Error("The matchmaking service returned an invalid game.");
      latestGame.current = next;
      setGame(next);
    } catch (cause) {
      console.error("Could not find or create an online game.", cause);
      setError(
        cause instanceof Error && cause.message.includes("NEXT_PUBLIC_")
          ? "Online play needs Supabase configuration."
          : cause && typeof cause === "object" && "message" in cause
            ? errorMessage({ message: String(cause.message) })
            : "Couldn’t find a game. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !userId) return;
    void Promise.resolve().then(() => findGame());
  }, [enabled, findGame, userId]);

  useEffect(() => {
    const gameId = game?.id;
    if (!enabled || !gameId || !userId) return;

    const supabase = createClient();
    let active = true;
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          if (!active) return;
          if (payload.eventType === "DELETE") {
            latestGame.current = null;
            setGame(null);
            setOpponentProfile(null);
            setNotice("This waiting game expired. Search again to find an opponent.");
            return;
          }
          const next = asGame(payload.new);
          if (next) applyGame(next);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refreshGame(gameId);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Online game realtime subscription failed.", status);
          setError("Connection interrupted. Reconnect to keep receiving moves.");
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [applyGame, enabled, game?.id, refreshGame, userId]);

  const waitingGameId = game?.status === "waiting" ? game.id : null;
  useEffect(() => {
    if (!enabled || !waitingGameId) return;
    const timer = window.setInterval(() => void refreshGame(waitingGameId), 15_000);
    return () => window.clearInterval(timer);
  }, [enabled, refreshGame, waitingGameId]);

  useEffect(() => {
    if (!enabled || !opponentId) return;
    let active = true;
    void createClient()
      .from("profiles")
      .select("username")
      .eq("id", opponentId)
      .single()
      .then(({ data, error: profileError }) => {
        if (!active) return;
        if (profileError) {
          console.error("Could not load the opponent profile.", profileError);
          setOpponentProfile({ id: opponentId, name: "Opponent" });
        } else {
          setOpponentProfile({ id: opponentId, name: data.username });
        }
      });
    return () => {
      active = false;
    };
  }, [enabled, opponentId]);

  const callGameRpc = useCallback(
    async (
      action: "make_move" | "resign_game" | "claim_timeout",
      cell?: number,
    ): Promise<boolean> => {
      if (!game) return false;
      setError(null);
      try {
        const supabase = createClient();
        const result =
          action === "make_move"
            ? await supabase.rpc("make_move", { p_game_id: game.id, p_cell: cell ?? -1 })
            : action === "resign_game"
              ? await supabase.rpc("resign_game", { p_game_id: game.id })
              : await supabase.rpc("claim_timeout", { p_game_id: game.id });
        if (result.error) throw result.error;
        const next = asGame(result.data);
        if (!next) throw new Error("The game service returned an invalid game.");
        applyGame(next);
        return true;
      } catch (cause) {
        console.error(`Online game ${action} failed.`, cause);
        setError(
          cause && typeof cause === "object" && "message" in cause
            ? errorMessage({ message: String(cause.message) })
            : "Couldn’t update the game. Please try again.",
        );
        return false;
      }
    },
    [applyGame, game],
  );

  const cancelWaiting = useCallback(async () => {
    if (!game) return;
    setError(null);
    try {
      const { error: rpcError } = await createClient().rpc("cancel_waiting_game", {
        p_game_id: game.id,
      });
      if (rpcError) throw rpcError;
      latestGame.current = null;
      setGame(null);
      setNotice("Search canceled.");
    } catch (cause) {
      console.error("Could not cancel matchmaking.", cause);
      setError("Couldn’t cancel the search. Please try again.");
    }
  }, [game]);

  return {
    game,
    opponentName,
    loading,
    error,
    notice,
    findGame,
    makeMove: (cell: number) => callGameRpc("make_move", cell),
    resign: () => callGameRpc("resign_game"),
    claimTimeout: () => callGameRpc("claim_timeout"),
    cancelWaiting,
  };
}
