"use client";

import { Dialog } from "./Dialog";
import { Confetti } from "./Confetti";

type PopupProps = {
  title: string;
  message: string;
  celebratory?: boolean;
  onClose: () => void;
  onNewGame: () => void;
};

export function Popup({ title, message, celebratory = false, onClose, onNewGame }: PopupProps) {
  return (
    <Dialog labelledBy="result-title" onClose={onClose}>
      {celebratory && <Confetti />}
      <h2 id="result-title">{title}</h2>
      <p>{message}</p>
      <button className="b" type="button" onClick={onNewGame}>
        New game
      </button>
    </Dialog>
  );
}
