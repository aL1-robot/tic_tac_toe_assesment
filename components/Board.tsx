"use client";

import type { BoardState, WinningLine } from "@/lib/game";
import { Marks } from "./Marks";

type BoardProps = {
  board: BoardState;
  winningLine: WinningLine | null;
  canPlay: boolean;
  onCellClick: (cell: number) => void;
  onCarveIdle?: () => void;
  tideKey: string | number;
};

export function Board({ board, winningLine, canPlay, onCellClick, onCarveIdle, tideKey }: BoardProps) {
  return (
    <div className="tablet">
      <div className="sandbed" aria-hidden="true" />
      <Marks board={board} winningLine={winningLine} onCarveIdle={onCarveIdle} />
      <div className="cell-grid" role="group" aria-label="Game board">
        {board.map((mark, index) => (
          <button
            key={index}
            className="cell"
            type="button"
            aria-label={`Cell ${index + 1}${mark ? `, ${mark}` : ", empty"}`}
            disabled={!canPlay || mark !== null}
            onClick={() => onCellClick(index)}
          />
        ))}
      </div>
      <TideWash key={tideKey} active={tideKey !== "idle"} />
      <div className="prop fan" aria-hidden="true" />
      <div className="prop spiral" aria-hidden="true" />
      <div className="prop stone s1" aria-hidden="true" />
      <div className="prop stone s2" aria-hidden="true" />
      <svg className="prop weed" viewBox="0 0 50 150" aria-hidden="true">
        <g fill="none" stroke="#56683a" strokeWidth="4" strokeLinecap="round">
          <path d="M22 148C14 120 32 100 20 74S28 28 24 4" />
          <path d="M22 120C34 108 42 100 46 86M21 96C10 84 7 72 8 60M24 68C36 57 40 46 40 35M23 45C13 34 11 22 13 13" />
        </g>
      </svg>
    </div>
  );
}

function TideWash({ active }: { active: boolean }) {
  return (
    <div className="tideclip" aria-hidden="true">
      <div className={`tide${active ? " go" : ""}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tide-gradient" x1="0" x2="1">
              <stop offset="0" stopColor="#2f7f98" stopOpacity=".5" />
              <stop offset=".75" stopColor="#3d93a8" stopOpacity=".55" />
              <stop offset="1" stopColor="#bfe6ea" stopOpacity=".8" />
            </linearGradient>
          </defs>
          <path
            d="M0 0H90Q95 6 90 12T90 24T90 36T90 48T90 60T90 72T90 84T90 96L90 100H0Z"
            fill="url(#tide-gradient)"
          />
          <path
            d="M90 0Q95 6 90 12T90 24T90 36T90 48T90 60T90 72T90 84T90 96L90 100"
            fill="none"
            stroke="#fff"
            strokeOpacity=".9"
            strokeWidth="4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className={`wet${active ? " go" : ""}`} />
    </div>
  );
}
