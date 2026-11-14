"use client";

import { useEffect, useRef, useState } from "react";
import type { LobbyPlayer } from "@/hooks/usePresenceLobby";

type OnlinePillProps = {
  players: LobbyPlayer[];
  connected: boolean;
};

export function OnlinePill({ players, connected }: OnlinePillProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <div className="dd" ref={containerRef}>
      <button
        className="pill"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {connected ? `● ${players.length} online` : "Offline"}
      </button>
      {open && (
        <ul className="menu" aria-label="Online players">
          {!connected && <li>Not connected</li>}
          {connected &&
            players.map((player) => (
              <li key={player.key}>
                {player.name}
                {player.isYou ? " (you)" : ""}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
