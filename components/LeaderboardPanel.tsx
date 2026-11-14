"use client";

import type { LeaderboardEntry } from "@/hooks/useLeaderboard";

type LeaderboardPanelProps = {
  titleId: string;
  rows: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  userId: string | null;
  username: string | null;
  onRetry: () => void;
};

export function LeaderboardPanel({
  titleId,
  rows,
  loading,
  error,
  userId,
  username,
  onRetry,
}: LeaderboardPanelProps) {
  return (
    <section className="lbpanel" aria-labelledby={titleId}>
      <h2 id={titleId}>Leaderboard</h2>
      <p className="sub2">Online games · 3 pts a win, 1 a draw</p>
      {loading ? (
        <p className="lb-state" aria-live="polite">Loading…</p>
      ) : error ? (
        <div className="lb-state" role="status">
          <p>{error}</p>
          <button type="button" className="link" onClick={onRetry}>Try again</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="lb-state">No online games yet. Be the first to make the board.</p>
      ) : (
        <ol className="rows">
          {rows.map((row) => (
            <li key={row.user_id} className={row.user_id === userId ? "me" : ""}>
              <b className="rk">{row.rank}</b>
              <span className="nm">{row.username}</span>
              <span className="rec">{row.wins}W {row.draws}D</span>
              <b className="pt">{row.points}</b>
            </li>
          ))}
        </ol>
      )}
      {!username && <p className="foot">Sign in to get on the board.</p>}
    </section>
  );
}
