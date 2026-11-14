"use client";

export type GameMode = "two" | "easy" | "hard" | "online";

type ModeSelectProps = {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
};

export function ModeSelect({ mode, onChange }: ModeSelectProps) {
  return (
    <select
      className="b alt mode-select"
      value={mode}
      aria-label="Game mode"
      onChange={(event) => onChange(event.target.value as GameMode)}
    >
      <option value="two">Two players</option>
      <option value="easy">Bot: easy</option>
      <option value="hard">Bot: hard</option>
      <option value="online">Online</option>
    </select>
  );
}
