"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuthDialog } from "./AuthDialog";
import { Board } from "./Board";
import { Dialog } from "./Dialog";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { ModeSelect, type GameMode } from "./ModeSelect";
import { OnlinePill } from "./OnlinePill";
import { Popup } from "./Popup";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useOnlineGame } from "@/hooks/useOnlineGame";
import { usePresenceLobby } from "@/hooks/usePresenceLobby";
import { useSelectedMode } from "@/hooks/useSelectedMode";
import { useSession } from "@/hooks/useSession";
import {
  gameResult,
  getEasyMove,
  getHardMove,
  getWinner,
  type BoardState,
  type Cell,
  type Mark,
  type WinningLine,
} from "@/lib/game";

type LocalResult = { title: string; message: string; winner?: Mark | "draw" };

const EMPTY_BOARD = (): BoardState => Array<Cell>(9).fill(null);

function other(mark: Mark): Mark {
  return mark === "X" ? "O" : "X";
}

function databaseBoard(value: string): BoardState {
  return value.split("").map((cell): Cell => (cell === "X" || cell === "O" ? cell : null));
}

function toWinningLine(line: number[] | null): WinningLine | null {
  if (!line || line.length !== 3 || line.some((cell) => cell < 0 || cell > 8)) return null;
  return [line[0], line[1], line[2]];
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function GameClient() {
  const { user, username, signOut } = useSession();
  const userId = user?.id ?? null;
  const lobby = usePresenceLobby(userId, username);
  const leaderboard = useLeaderboard();
  const [mode, setMode] = useSelectedMode();
  const [board, setBoard] = useState<BoardState>(EMPTY_BOARD);
  const [turn, setTurn] = useState<Mark>("X");
  const [nextStart, setNextStart] = useState<Mark>("X");
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [localResult, setLocalResult] = useState<LocalResult | null>(null);
  // Holds the result until the stick finishes carving, then shown after 450ms delay
  const pendingResult = useRef<LocalResult | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tideWave, setTideWave] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [authForOnline, setAuthForOnline] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [dismissedGameId, setDismissedGameId] = useState<string | null>(null);
  const online = useOnlineGame(mode === "online", userId);
  const serverBoard = online.game ? databaseBoard(online.game.board) : EMPTY_BOARD();
  const onlineMark: Mark | null = online.game
    ? online.game.x_player === userId
      ? "X"
      : "O"
    : null;
  const onlineWinningLine = online.game ? toWinningLine(online.game.winning_line) : null;

  useEffect(() => {
    if (mode !== "online" || online.game?.status !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [mode, online.game?.last_move_at, online.game?.status]);

  const finishLocalRound = useCallback((nextBoard: BoardState) => {
    const outcome = gameResult(nextBoard);
    if (outcome === null) return;

    // Store into ref; popup is deferred until the stick finishes carving.
    // Mirrors HTML: whenIdle(() => setTimeout(showModal, 450))
    if (outcome === "draw") {
      pendingResult.current = {
        title: "It's a draw",
        message: "Every line was blocked. Go again?",
        winner: "draw",
      };
      return;
    }

    setScores((current) => ({ ...current, [outcome]: current[outcome] + 1 }));
    pendingResult.current = {
      title:
        mode === "two"
          ? `${outcome} wins!`
          : outcome === "X"
            ? "You win!"
            : "The computer wins!",
      message: `Score: X ${scores.X + (outcome === "X" ? 1 : 0)} – O ${
        scores.O + (outcome === "O" ? 1 : 0)
      }`,
      winner: outcome,
    };
    // Win case: popup fires via onCarveIdle → handleCarveIdle (see below).
  }, [mode, scores]);


  // Called by Marks when the stick finishes carving — mirrors HTML's whenIdle callback
  const handleCarveIdle = useCallback(() => {
    if (!pendingResult.current) return;
    const result = pendingResult.current;
    pendingResult.current = null;
    resultTimer.current = setTimeout(() => {
      resultTimer.current = null;
      setLocalResult(result);
    }, 450);
  }, []);

  const clearPendingLocalResult = useCallback(() => {
    pendingResult.current = null;
    if (resultTimer.current !== null) {
      clearTimeout(resultTimer.current);
      resultTimer.current = null;
    }
  }, []);

  useEffect(() => clearPendingLocalResult, [clearPendingLocalResult]);

  const playLocalMove = useCallback((cell: number, mark: Mark) => {
    if (board[cell] !== null || localResult || pendingResult.current) return;
    const nextBoard = [...board];
    nextBoard[cell] = mark;
    setBoard(nextBoard);
    finishLocalRound(nextBoard);
    if (gameResult(nextBoard) === null) setTurn(other(mark));
  }, [board, finishLocalRound, localResult]);

  useEffect(() => {
    if (mode !== "easy" && mode !== "hard") return;
    if (turn !== "O" || localResult || pendingResult.current) return;

    const timer = window.setTimeout(() => {
      const move = mode === "hard" ? getHardMove(board) : getEasyMove(board);
      if (move !== null) playLocalMove(move, "O");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [board, localResult, mode, playLocalMove, turn]);

  function handleCellClick(cell: number) {
    if (mode === "online") {
      if (onlineMark && online.game?.status === "active" && online.game.turn === onlineMark) {
        void online.makeMove(cell);
      }
      return;
    }
    if (mode !== "two" && turn !== "X") return;
    playLocalMove(cell, turn);
  }

  function startLocalRound(start: Mark) {
    clearPendingLocalResult();
    if (board.some((cell) => cell !== null) || localResult) setTideWave((value) => value + 1);
    setBoard(EMPTY_BOARD());
    setTurn(start);
    setNextStart(other(start));
    setLocalResult(null);
  }

  function handleModeChange(nextMode: GameMode) {
    if (nextMode === "online" && !userId) {
      setAuthForOnline(true);
      setAuthOpen(true);
      return;
    }
    clearPendingLocalResult();
    setMode(nextMode);
    setLocalResult(null);
    setScores({ X: 0, O: 0 });
    if (nextMode !== "online") startLocalRound("X");
  }

  const closeAuth = useCallback(() => setAuthOpen(false), []);
  const authSucceeded = useCallback(() => {
    setAuthOpen(false);
    if (authForOnline) {
      clearPendingLocalResult();
      setMode("online");
      setLocalResult(null);
    }
    setAuthForOnline(false);
  }, [authForOnline, clearPendingLocalResult, setMode]);

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut();
      if (mode === "online") setMode("two");
    } catch (error) {
      console.error("Could not sign out.", error);
      setSignOutError("Couldn’t sign out. Please try again.");
    }
  }

  const activeOnlineGame = mode === "online" ? online.game : null;
  const waitingOnOpponent =
    activeOnlineGame?.status === "active" &&
    onlineMark !== null &&
    activeOnlineGame.turn !== onlineMark;
  const timeLeft = activeOnlineGame && now !== null
    ? Math.max(
        0,
        60 - Math.floor((now - Date.parse(activeOnlineGame.last_move_at)) / 1000),
      )
    : 60;
  const onlineStatus = !activeOnlineGame
    ? online.loading
      ? "Finding an opponent…"
      : online.notice ?? "Choose Online to find a game."
    : activeOnlineGame.status === "waiting"
      ? "Waiting for an opponent…"
      : activeOnlineGame.status === "finished"
        ? activeOnlineGame.winner === "draw"
          ? "A draw. Nobody takes the beach."
          : activeOnlineGame.winner === onlineMark
            ? "You take the beach."
            : `${online.opponentName ?? "Your opponent"} takes the beach.`
        : activeOnlineGame.turn === onlineMark
          ? `Your turn (${onlineMark})`
          : `${online.opponentName ?? "Your opponent"}’s turn (${activeOnlineGame.turn})`;

  const localCanPlay =
    mode !== "online" &&
    localResult === null &&
    pendingResult.current === null &&
    (mode === "two" || turn === "X");
  const onlineCanPlay =
    mode === "online" &&
    activeOnlineGame?.status === "active" &&
    onlineMark !== null &&
    activeOnlineGame.turn === onlineMark;

  let onlineResult: LocalResult | null = null;
  if (activeOnlineGame?.status === "finished" && activeOnlineGame.id !== dismissedGameId) {
    const won = activeOnlineGame.winner === onlineMark;
    const reason =
      activeOnlineGame.end_reason === "resign"
        ? won
          ? `${online.opponentName ?? "Your opponent"} resigned.`
          : "You resigned."
        : activeOnlineGame.end_reason === "timeout"
          ? won
            ? `${online.opponentName ?? "Your opponent"} ran out of time.`
            : "You ran out of time."
          : activeOnlineGame.winner === "draw"
            ? "Every line was blocked. Go again?"
            : "Three in a row takes the beach.";
    onlineResult = {
      title:
        activeOnlineGame.winner === "draw"
          ? "It’s a draw"
          : won
            ? "You win!"
            : "You lost",
      message: reason,
      winner: activeOnlineGame.winner === "draw" ? "draw" : won ? onlineMark ?? undefined : undefined,
    };
  }

  return (
    <>
      <div className="beach" aria-hidden="true">
        <BeachDecorations />
      </div>
      <div className="stage">
        <main className="game-card">
          <div className="top">
            <OnlinePill players={lobby.players} connected={lobby.connected} />
            <div className="top-links">
              <button className="link" type="button" onClick={() => setLeaderboardOpen(true)}>
                Leaderboard
              </button>
              {username ? (
                <>
                  <span className="signed-in" title={`Signed in as ${username}`}>{username}</span>
                  <button className="link" type="button" onClick={() => void handleSignOut()}>
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  className="link"
                  type="button"
                  onClick={() => {
                    setAuthForOnline(false);
                    setAuthOpen(true);
                  }}
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
          <header className="intro">
            <h1><span className="slash">Tic</span> Tide Tac Toe</h1>
            <p className="sub">Classic rules, drawn in the sand. When a round ends, the tide clears the board.</p>
          </header>

          <Board
            board={mode === "online" ? serverBoard : board}
            winningLine={mode === "online" ? onlineWinningLine : getWinner(board)}
            canPlay={mode === "online" ? onlineCanPlay : localCanPlay}
            onCellClick={handleCellClick}
            onCarveIdle={mode !== "online" ? handleCarveIdle : undefined}
            tideKey={mode === "online" ? online.game?.id ?? "idle" : tideWave === 0 ? "idle" : tideWave}
          />

          <div className="bar">
            <div className="score" aria-label="Score">
              {mode === "online" ? (
                <>
                  <span className={onlineMark === "X" ? "sx on" : "sx"}>
                    X {onlineMark === "X" ? "(you)" : `(${online.opponentName ?? "opponent"})`}
                  </span>
                  <span className={onlineMark === "O" ? "so on" : "so"}>
                    O {onlineMark === "O" ? "(you)" : `(${online.opponentName ?? "opponent"})`}
                  </span>
                </>
              ) : (
                <>
                  <span className={localResult === null && turn === "X" ? "sx on" : "sx"}>X {scores.X}</span>
                  <span className={localResult === null && turn === "O" ? "so on" : "so"}>O {scores.O}</span>
                </>
              )}
            </div>
            <div className="status" aria-live="polite">
              {mode === "online"
                ? onlineStatus
                : localResult
                  ? localResult.winner === "draw"
                    ? "A draw. Nobody takes the beach."
                    : `${localResult.winner} takes the beach.`
                  : `${turn} to place`}
            </div>
          </div>

          {mode === "online" && (
            <div className="online-controls" aria-live="polite">
              {online.error && <p className="msg" role="alert">{online.error}</p>}
              {online.game?.status === "waiting" && (
                <button className="b alt" type="button" onClick={() => void online.cancelWaiting()}>
                  Cancel search
                </button>
              )}
              {!online.game && !online.loading && (
                <button className="b" type="button" onClick={() => void online.findGame()}>
                  Search again
                </button>
              )}
              {online.game?.status === "active" && (
                <>
                  <button className="b alt" type="button" onClick={() => void online.resign()}>
                    Resign
                  </button>
                  {waitingOnOpponent && (
                    <button
                      className="b"
                      type="button"
                      disabled={timeLeft > 0}
                      onClick={() => void online.claimTimeout()}
                    >
                      {timeLeft > 0 ? `Claim win · ${formatTime(timeLeft)}` : "Claim win"}
                    </button>
                  )}
                </>
              )}
              {online.game?.status === "finished" && (
                <button type="button" className="b" onClick={() => void online.findGame()}>
                  New game
                </button>
              )}
            </div>
          )}

          <div className="btns">
            {mode !== "online" && (
              <button className="b" type="button" onClick={() => startLocalRound(nextStart)}>
                New round
              </button>
            )}
            <ModeSelect mode={mode} onChange={handleModeChange} />
          </div>
          {(online.notice || signOutError) && (
            <p className="info-message" role="status">{signOutError || online.notice}</p>
          )}
        </main>
        <aside className="side" aria-label="Leaderboard">
          <LeaderboardPanel
            titleId="leaderboard-title-desktop"
            rows={leaderboard.rows}
            loading={leaderboard.loading}
            error={leaderboard.error}
            userId={userId}
            username={username}
            onRetry={() => void leaderboard.refresh()}
          />
        </aside>
      </div>

      {authOpen && <AuthDialog onClose={closeAuth} onSuccess={authSucceeded} />}
      {leaderboardOpen && (
        <Dialog labelledBy="leaderboard-title-mobile" onClose={() => setLeaderboardOpen(false)} className="leaderboard-dialog">
          <LeaderboardPanel
            titleId="leaderboard-title-mobile"
            rows={leaderboard.rows}
            loading={leaderboard.loading}
            error={leaderboard.error}
            userId={userId}
            username={username}
            onRetry={() => void leaderboard.refresh()}
          />
          <button type="button" className="b alt" onClick={() => setLeaderboardOpen(false)}>Close</button>
        </Dialog>
      )}
      {(localResult || onlineResult) && (
        <Popup
          title={(onlineResult ?? localResult)!.title}
          message={(onlineResult ?? localResult)!.message}
          celebratory={(onlineResult ?? localResult)!.winner !== undefined &&
            (onlineResult ?? localResult)!.winner !== "draw" &&
            (mode === "online"
              ? onlineResult?.winner === onlineMark
              : mode === "two"
                ? true
                : localResult?.winner === "X")}
          onClose={() => {
            setLocalResult(null);
            if (activeOnlineGame) setDismissedGameId(activeOnlineGame.id);
          }}
          onNewGame={() => {
            if (mode === "online") {
              if (activeOnlineGame) setDismissedGameId(activeOnlineGame.id);
              void online.findGame();
            } else {
              startLocalRound(nextStart);
            }
          }}
        />
      )}
    </>
  );
}

function BeachDecorations() {
  const decorations = [
    ["3%", "8%", 11, "-15deg", 1, 1.081, "sh2"],
    ["12%", "3%", 6.5, "20deg", 1, 1.271, "st0"],
    ["2%", "24%", 5, "-30deg", 1, 0.807, "st4"],
    ["6%", "40%", 9, "18deg", 1, 1.02, "sh4"],
    ["15%", "33%", 4.5, "70deg", 1, 0.773, "st6"],
    ["4%", "62%", 7, "-10deg", 1, 1.056, "st5"],
    ["10%", "72%", 9, "35deg", 1, 0.76, "sh1"],
    ["1%", "86%", 5.5, "15deg", 1, 0.853, "st2"],
    ["17%", "88%", 6.5, "-40deg", 1, 0.78, "sh3"],
    ["24%", "94%", 4.5, "0deg", 1, 1.034, "st8"],
    ["90%", "6%", 11, "25deg", 1, 1.042, "sh0"],
    ["82%", "4%", 6, "-20deg", 1, 0.86, "st1"],
    ["94%", "26%", 6.5, "40deg", 1, 1.056, "st3"],
    ["85%", "38%", 8, "-30deg", -1, 0.76, "sh1"],
    ["91%", "52%", 7, "10deg", 1, 1.034, "st7"],
    ["80%", "66%", 9, "22deg", -1, 1.081, "sh2"],
    ["93%", "78%", 5.5, "-60deg", 1, 1.271, "st0"],
    ["86%", "88%", 8, "-25deg", 1, 1.02, "sh4"],
    ["78%", "94%", 4.5, "30deg", 1, 0.807, "st4"],
    ["76%", "12%", 6, "50deg", 1, 0.78, "sh3"],
    ["40%", "1%", 5, "5deg", 1, 1.056, "st5"],
    ["58%", "92%", 8, "-15deg", 1, 1.042, "sh0"],
    ["44%", "96%", 4.5, "60deg", 1, 0.773, "st6"],
  ] as const;

  return (
    <>
      {decorations.map(([left, top, width, rotation, flip, ratio, image], index) => (
        <i
          key={index}
          className="drift"
          aria-hidden="true"
          style={{
            left,
            top,
            "--w": width,
            "--r": rotation,
            "--f": flip,
            "--ar": ratio,
            backgroundImage: `url(/beach/${image}.webp)`,
          } as React.CSSProperties & {
            "--w": number;
            "--r": string;
            "--f": number;
            "--ar": number;
          }}
        />
      ))}
    </>
  );
}
