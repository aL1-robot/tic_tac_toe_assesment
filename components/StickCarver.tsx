"use client";

/**
 * StickCarver – ports the branch-carving animation system from the original
 * HTML prototype into React.  The component renders nothing itself; callers
 * use the ref handle to imperatively queue paths for the stick to draw.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

// ── physics constants (match the original HTML exactly) ──────────────────────
const IMG_ANG = 133.4;
const HOLD_ANG = 133;
const LEAN = 0.22;

export interface StickCarverHandle {
  /** Queue an array of SVGPathElements to be drawn by the stick. */
  carve(paths: SVGPathElement[], speed?: number): void;
  /** Cancel all pending carve operations and hide the stick. */
  cancelCarve(): void;
  /** Call fn immediately if idle, otherwise after the queue drains. */
  whenIdle(fn: () => void): void;
}

interface Props {
  /** The <g id="stick"> element rendered inside the board SVG. */
  stickGroupRef: React.RefObject<SVGGElement | null>;
  /** Whether the user prefers reduced motion. */
  reducedMotion: boolean;
}

export const StickCarver = forwardRef<StickCarverHandle, Props>(
  function StickCarver({ stickGroupRef, reducedMotion }, ref) {

    // mutable state lives in refs so animations don't stale-close over it
    const state = useRef({
      queue: [] as Array<{ paths: SVGPathElement[]; speed: number; tok: number }>,
      carving: false,
      cTok: 0,
      mTok: 0,
      cx: 0,
      cy: 0,
      shown: false,
      idleCbs: [] as Array<() => void>,
      tilt: HOLD_ANG - IMG_ANG,
      lastX: null as number | null,
      lastY: null as number | null,
    });

    // ── internal helpers ────────────────────────────────────────────────────

    function stick(): SVGGElement | null {
      return stickGroupRef.current;
    }

    function ease(k: number) {
      return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    }

    function put(x: number, y: number, wob: number) {
      const s = state.current;
      if (s.lastX !== null) {
        const dx = x - s.lastX;
        const dy = y - s.lastY!;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.25) {
          const hr = (HOLD_ANG * Math.PI) / 180;
          const hx = Math.cos(hr) - LEAN * (dx / d);
          const hy = Math.sin(hr) - LEAN * (dy / d);
          const want = (Math.atan2(hy, hx) * 180) / Math.PI - IMG_ANG;
          const df = ((want - s.tilt + 540) % 360) - 180;
          s.tilt += df * 0.06;
        }
      }
      s.lastX = x;
      s.lastY = y;
      s.cx = x;
      s.cy = y;
      stick()?.setAttribute(
        "transform",
        `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(s.tilt + wob).toFixed(2)})`
      );
    }

    function moveTo(
      x: number,
      y: number,
      ms: number,
      lift: number,
      cb?: () => void
    ) {
      const s = state.current;
      const m = ++s.mTok;
      const x0 = s.cx;
      const y0 = s.cy;
      let t0: number | null = null;

      function step(ts: number) {
        if (m !== s.mTok) return;
        if (t0 === null) t0 = ts;
        const k = Math.min(1, (ts - t0) / ms);
        const e = ease(k);
        put(
          x0 + (x - x0) * e,
          y0 + (y - y0) * e - lift * Math.sin(Math.PI * k),
          0
        );
        if (k < 1) requestAnimationFrame(step);
        else cb?.();
      }
      requestAnimationFrame(step);
    }

    function approach(x: number, y: number, cb: () => void) {
      const s = state.current;
      const el = stick();
      if (!el) { cb(); return; }
      if (!s.shown) {
        s.shown = true;
        s.lastX = null;
        s.tilt = HOLD_ANG - IMG_ANG;
        put(x - 14, y + 26, 0);
        el.style.opacity = "1";
        moveTo(x, y, 230, 0, cb);
      } else {
        moveTo(x, y, 170, 14, cb);
      }
    }

    function liftOut() {
      const s = state.current;
      if (!s.shown) return;
      s.shown = false;
      const el = stick();
      if (el) el.style.opacity = "0";
      moveTo(s.cx - 14, s.cy + 26, 260, 0);
    }

    function strokePath(
      p: SVGPathElement,
      speed: number,
      tok: number,
      cb: () => void
    ) {
      const s = state.current;
      const L = p.getTotalLength();
      const dur = Math.max(280, Math.min(1000, (L / speed) * 1000));
      let t0: number | null = null;
      const m = ++s.mTok;

      function step(ts: number) {
        if (tok !== s.cTok || m !== s.mTok) return;
        if (t0 === null) t0 = ts;
        const k = Math.min(1, (ts - t0) / dur);
        const e = ease(k);
        const pt = p.getPointAtLength(e * L);
        if (e > 0.003) p.style.visibility = "visible";
        p.style.strokeDashoffset = String(L * (1 - e));
        put(pt.x, pt.y, Math.sin(k * 5) * 0.3);
        if (k < 1) requestAnimationFrame(step);
        else cb();
      }
      requestAnimationFrame(step);
    }

    function prep(p: SVGPathElement) {
      const L = p.getTotalLength();
      p.style.strokeDasharray = `${L} ${L}`;
      p.style.strokeDashoffset = String(L);
      p.style.visibility = "hidden";
    }

    function pump() {
      const s = state.current;
      const job = s.queue.shift();
      if (job === undefined) {
        s.carving = false;
        liftOut();
        s.idleCbs.splice(0).forEach((f) => f());
        return;
      }
      const { paths: jobPaths, speed: jobSpeed, tok: jobTok } = job;
      s.carving = true;
      let i = 0;

      function next() {
        if (jobTok !== s.cTok) return;
        if (i >= jobPaths.length) { pump(); return; }
        const p = jobPaths[i++];
        const startPt = p.getPointAtLength(0);
        approach(startPt.x, startPt.y, () => {
          strokePath(p, jobSpeed, jobTok, next);
        });
      }
      next();
    }

    // ── public API ──────────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      carve(paths: SVGPathElement[], speed = 230) {
        const s = state.current;
        if (reducedMotion) {
          // instant reveal – no stick animation
          paths.forEach((p) => {
            p.style.strokeDashoffset = "0";
            p.style.visibility = "visible";
          });
          return;
        }
        // prepare each path for reveal animation
        paths.forEach(prep);
        s.queue.push({ paths, speed, tok: s.cTok });
        if (!s.carving) pump();
      },

      cancelCarve() {
        const s = state.current;
        s.cTok++;
        s.mTok++;
        s.queue = [];
        s.carving = false;
        s.idleCbs = [];
        s.shown = false;
        const el = stick();
        if (el) el.style.opacity = "0";
      },

      whenIdle(fn: () => void) {
        const s = state.current;
        if (!s.carving && !s.queue.length) fn();
        else s.idleCbs.push(fn);
      },
    }), [reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

    // cleanup on unmount
    useEffect(() => {
      return () => {
        const s = state.current;
        s.cTok++;
        s.mTok++;
        s.queue = [];
        s.carving = false;
      };
    }, []);

    return null;
  }
);
