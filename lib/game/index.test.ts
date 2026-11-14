import { describe, expect, it } from "vitest";
import {
  gameResult,
  getEasyMove,
  getHardMove,
  getWinner,
  type BoardState,
} from "./index";

describe("tic-tac-toe rules", () => {
  it("finds rows, columns, and diagonals", () => {
    expect(getWinner(["X", "X", "X", null, "O", null, null, null, "O"])).toEqual([0, 1, 2]);
    expect(getWinner(["O", "X", null, "O", "X", null, "O", null, "X"])).toEqual([0, 3, 6]);
    expect(getWinner(["X", "O", "O", null, "X", null, null, null, "X"])).toEqual([0, 4, 8]);
    expect(getWinner(Array(9).fill(null))).toBeNull();
  });

  it("recognizes draws only on a full board", () => {
    expect(gameResult(["X", "O", "X", "X", "O", "O", "O", "X", "X"])).toBe("draw");
    expect(gameResult(["X", "O", null, null, null, null, null, null, null])).toBeNull();
  });

  it("the easy bot takes a win and blocks an immediate loss", () => {
    expect(getEasyMove(["O", "O", null, "X", "X", null, null, null, null])).toBe(2);
    expect(getEasyMove(["X", "X", null, "O", null, null, null, null, null])).toBe(2);
  });

  it("the hard bot never loses against any legal opponent sequence", () => {
    let completedGames = 0;

    function play(board: BoardState, mark: "X" | "O") {
      const result = gameResult(board);
      if (result !== null) {
        expect(result).not.toBe("X");
        completedGames += 1;
        return;
      }

      if (mark === "X") {
        for (let cell = 0; cell < board.length; cell += 1) {
          if (board[cell] !== null) continue;
          board[cell] = "X";
          play(board, "O");
          board[cell] = null;
        }
        return;
      }

      const cell = getHardMove(board);
      expect(cell).not.toBeNull();
      board[cell!] = "O";
      play(board, "X");
      board[cell!] = null;
    }

    play(Array(9).fill(null), "X");
    expect(completedGames).toBeGreaterThan(0);
  });
});
