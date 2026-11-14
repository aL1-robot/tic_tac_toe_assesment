"use client";

import { useEffect, useRef, useState } from "react";

export type GameMode = "two" | "easy" | "hard" | "online";

type ModeSelectProps = {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
};

const MODES: { value: GameMode; label: string }[] = [
  { value: "two", label: "Two players" },
  { value: "easy", label: "Bot: easy" },
  { value: "hard", label: "Bot: hard" },
  { value: "online", label: "Online" },
];

export function ModeSelect({ mode, onChange }: ModeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, MODES.findIndex((option) => option.value === mode)),
  );
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, MODES.findIndex((option) => option.value === mode));

  useEffect(() => {
    if (isOpen) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  function openList() {
    setActiveIndex(selectedIndex);
    setIsOpen(true);
  }

  function chooseMode(nextMode: GameMode) {
    onChange(nextMode);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % MODES.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + MODES.length) % MODES.length);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(MODES.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        chooseMode(MODES[activeIndex].value);
        break;
      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  }

  return (
    <span className="mode-select-wrap" ref={rootRef}>
      <button
        ref={triggerRef}
        className="b alt mode-select"
        type="button"
        aria-label="Game mode"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? setIsOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openList();
          }
        }}
      >
        {MODES[selectedIndex].label}
      </button>
      {isOpen && (
        <div className="mode-options" role="listbox" aria-label="Game mode" onKeyDown={handleKeyDown}>
          {MODES.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              className="mode-option"
              type="button"
              role="option"
              aria-selected={option.value === mode}
              tabIndex={activeIndex === index ? 0 : -1}
              onFocus={() => setActiveIndex(index)}
              onClick={() => chooseMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
