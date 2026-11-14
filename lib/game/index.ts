export type Mark = "X" | "O";
export type Cell = Mark | null;
export type BoardState = Cell[];
export type WinningLine = readonly [number, number, number];

export const WINNING_LINES: readonly WinningLine[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function getWinner(board: BoardState): WinningLine | null {
  for (const line of WINNING_LINES) {
    const [first, second, third] = line;
    if (board[first] && board[first] === board[second] && board[second] === board[third]) {
      return line;
    }
  }
  return null;
}

function minimax(board: BoardState, mark: Mark, depth: number): number {
  const line = getWinner(board);
  if (line) return board[line[0]] === "O" ? 10 - depth : depth - 10;

  const empty = board.flatMap((cell, index) => (cell === null ? [index] : []));
  if (empty.length === 0) return 0;

  let best = mark === "O" ? -Infinity : Infinity;
  for (const cell of empty) {
    board[cell] = mark;
    const score = minimax(board, mark === "O" ? "X" : "O", depth + 1);
    board[cell] = null;
    best = mark === "O" ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

export function getHardMove(board: BoardState): number | null {
  let bestScore = -Infinity;
  let bestCell: number | null = null;

  for (let cell = 0; cell < board.length; cell += 1) {
    if (board[cell] !== null) continue;
    board[cell] = "O";
    const score = minimax(board, "X", 1);
    board[cell] = null;
    if (score > bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }

  return bestCell;
}

export function getEasyMove(board: BoardState, random = Math.random): number | null {
  const empty = board.flatMap((cell, index) => (cell === null ? [index] : []));
  if (empty.length === 0) return null;

  for (const mark of ["O", "X"] as const) {
    for (const cell of empty) {
      board[cell] = mark;
      const wins = getWinner(board) !== null;
      board[cell] = null;
      if (wins) return cell;
    }
  }

  return empty[Math.floor(random() * empty.length)];
}

export function gameResult(board: BoardState): "X" | "O" | "draw" | null {
  const line = getWinner(board);
  if (line) return board[line[0]];
  return board.every((cell) => cell !== null) ? "draw" : null;
}
