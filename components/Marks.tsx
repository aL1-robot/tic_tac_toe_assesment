"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import type { BoardState, Mark, WinningLine } from "@/lib/game";
import { StickCarver, type StickCarverHandle } from "./StickCarver";

type MarksProps = {
  board: BoardState;
  winningLine: WinningLine | null;
  /** Called once the carver is idle after a new mark is drawn. */
  onCarveIdle?: () => void;
};

/** Random jitter in [-2, 2] – matches HTML original */
function jitter() {
  return parseFloat((Math.random() * 4 - 2).toFixed(1));
}

function xPaths(x: number, y: number): [string, string] {
  return [
    `M${x - 26 + jitter()} ${y - 26 + jitter()} Q${x + 2} ${y - 2} ${x + 27 + jitter()} ${y + 26 + jitter()}`,
    `M${x + 26 + jitter()} ${y - 27 + jitter()} Q${x - 2} ${y + 1} ${x - 27 + jitter()} ${y + 26 + jitter()}`,
  ];
}

function oPath(x: number, y: number): string {
  const s = jitter();
  return (
    `M${x + 3} ${y - 30} ` +
    `C${x + 36 + s} ${y - 30} ${x + 36} ${y + 31} ${x - 2} ${y + 31} ` +
    `C${x - 37} ${y + 31} ${x - 37 + s} ${y - 28} ${x + 8} ${y - 30}`
  );
}

function cellCenter(index: number): [number, number] {
  return [50 + (index % 3) * 100, 50 + Math.floor(index / 3) * 100];
}

function winLineD(winning: WinningLine): string {
  const [ax, ay] = cellCenter(winning[0]);
  const [bx, by] = cellCenter(winning[2]);
  return `M${ax} ${ay} L${bx} ${by}`;
}

export function Marks({ board, winningLine, onCarveIdle }: MarksProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const stickGroupRef = useRef<SVGGElement>(null);
  const carverRef = useRef<StickCarverHandle>(null);

  // track previously-rendered board cells so we know what's new
  const prevBoardRef = useRef<BoardState>(Array(9).fill(null));
  // keep refs to each mark <g> so we can remove them on reset
  const markEls = useRef<(SVGGElement | null)[]>(Array(9).fill(null));
  // keep ref to win-line path
  const winLineRef = useRef<SVGPathElement | null>(null);

  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  // ── draw a new mark into the SVG and queue it for carving ─────────────────
  const drawMark = useCallback(
    (index: number, mark: Mark, marksGroup: SVGGElement) => {
      const svg = svgRef.current;
      const carver = carverRef.current;
      if (!svg || !carver) return;

      const NS = "http://www.w3.org/2000/svg";
      const [x, y] = cellCenter(index);
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", `mark ${mark}`);
      g.setAttribute("filter", "url(#rough)");

      const pathDs: string[] = mark === "X" ? xPaths(x, y) : [oPath(x, y)];
      const pathEls: SVGPathElement[] = pathDs.map((d) => {
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", d);
        g.appendChild(p);
        return p;
      });

      marksGroup.appendChild(g);
      markEls.current[index] = g;

      carver.carve(pathEls, 230);
      if (onCarveIdle) carver.whenIdle(onCarveIdle);
    },
    [onCarveIdle]
  );

  // ── draw the win line ──────────────────────────────────────────────────────
  const drawWinLine = useCallback(
    (wl: WinningLine, hitsGroup: SVGGElement) => {
      const NS = "http://www.w3.org/2000/svg";
      const carver = carverRef.current;
      if (!carver) return;
      const p = document.createElementNS(NS, "path");
      p.setAttribute("class", "win-line");
      p.setAttribute("d", winLineD(wl));
      hitsGroup.appendChild(p);
      winLineRef.current = p;
      carver.carve([p], 340);
    },
    []
  );

  // ── respond to board changes ───────────────────────────────────────────────
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const marksGroup = svg.querySelector<SVGGElement>("#marks-group");
    const hitsGroup = svg.querySelector<SVGGElement>("#hits-group");
    if (!marksGroup || !hitsGroup) return;

    const prev = prevBoardRef.current;

    // detect a board reset (all cells cleared)
    const wasReset = board.every((c) => c === null) && prev.some((c) => c !== null);
    if (wasReset) {
      carverRef.current?.cancelCarve();
      // remove all mark elements (tide wash handles visual removal)
      Array.from(marksGroup.children).forEach((c) => c.remove());
      // remove win line
      if (winLineRef.current) { winLineRef.current.remove(); winLineRef.current = null; }
      markEls.current = Array(9).fill(null);
      prevBoardRef.current = [...board];
      return;
    }

    // find newly placed cells
    board.forEach((cell, i) => {
      if (cell !== null && prev[i] === null) {
        drawMark(i, cell, marksGroup);
      }
    });

    // winning line
    if (winningLine && !winLineRef.current) {
      drawWinLine(winningLine, hitsGroup);
    }

    prevBoardRef.current = [...board];
  });

  // ── clean up win line when it disappears ───────────────────────────────────
  useEffect(() => {
    if (!winningLine && winLineRef.current) {
      winLineRef.current.remove();
      winLineRef.current = null;
    }
  }, [winningLine]);

  return (
    <>
      <StickCarver
        ref={carverRef}
        stickGroupRef={stickGroupRef}
        reducedMotion={reducedMotion}
      />
      <svg
        ref={svgRef}
        className="board-art"
        viewBox="0 0 300 300"
        aria-hidden="true"
      >
        <defs>
          <filter id="rough" filterUnits="userSpaceOnUse" x="-30" y="-30" width="360" height="360" colorInterpolationFilters="sRGB">
            {/* step 1: coarse noise for displacement */}
            <feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves="2" seed="4" result="n" />
            {/* step 2: warp the stroke paths */}
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="d" />
            {/* step 3: fine noise → mask for the ridge areas */}
            <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed="9" result="g" />
            <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 3.5" result="m" />
            <feComposite in="d" in2="m" operator="in" result="c" />
            {/* step 4: ridge (dilate + blur → warm light fill, masked out from centre) */}
            <feMorphology in="c" operator="dilate" radius="1.6" result="dl" />
            <feGaussianBlur in="dl" stdDeviation="1.7" result="bl" />
            <feFlood floodColor="#f7edcf" floodOpacity=".6" />
            <feComposite in2="bl" operator="in" result="r0" />
            <feComposite in="r0" in2="c" operator="out" result="ridge" />
            {/* step 5: rim light (shifted down 1.8px, masked) */}
            <feOffset in="c" dx="0" dy="1.8" result="cs" />
            <feComposite in="cs" in2="c" operator="out" result="rim0" />
            <feFlood floodColor="#fff8e1" floodOpacity=".75" />
            <feComposite in2="rim0" operator="in" result="rim" />
            {/* step 6: shadow lip (top of groove where offset overlaps) */}
            <feComposite in="c" in2="cs" operator="out" result="top0" />
            <feFlood floodColor="#000" floodOpacity=".5" />
            <feComposite in2="top0" operator="in" result="lip" />
            {/* composite all layers: ridge → rim → carved centre → shadow lip */}
            <feMerge>
              <feMergeNode in="ridge" />
              <feMergeNode in="rim" />
              <feMergeNode in="c" />
              <feMergeNode in="lip" />
            </feMerge>
          </filter>
        </defs>

        {/* grid lines */}
        <g className="grid-lines" filter="url(#rough)">
          <path d="M100 16 Q103 150 99 284" />
          <path d="M201 14 Q198 150 202 286" />
          <path d="M16 101 Q150 98 284 102" />
          <path d="M14 199 Q150 203 286 198" />
        </g>

        {/* marks are imperatively appended here */}
        <g id="marks-group" />

        {/* win-line is imperatively appended here */}
        <g id="hits-group" />

        {/* the branch / stick */}
        <g
          ref={stickGroupRef}
          className="stick"
          style={{ opacity: 0 }}
        >
          <image
            href="/beach/stick.webp"
            x="-135"
            y="-2.3"
            width="138.18"
            height="145.21"
          />
        </g>
      </svg>
    </>
  );
}
