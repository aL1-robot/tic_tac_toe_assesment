"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { GameMode } from "@/components/ModeSelect";

const STORAGE_KEY = "tide:mode";
const CHANGE_EVENT = "tide-mode-change";

function isGameMode(value: string | null): value is GameMode {
  return value === "two" || value === "easy" || value === "hard" || value === "online";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function getSnapshot(): GameMode {
  const saved = window.sessionStorage.getItem(STORAGE_KEY);
  return isGameMode(saved) ? saved : "two";
}

function getServerSnapshot(): GameMode {
  return "two";
}

export function useSelectedMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setMode = useCallback((nextMode: GameMode) => {
    if (nextMode === "two") window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, nextMode);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [mode, setMode] as const;
}
