"use client";

import { useEffect, useState } from "react";

interface TimerProps {
  /** Timestamp ms du début de la question. null = pas de chrono actif. */
  startedAt: number | null;
  /** Limite en secondes ; 0 = pas de limite. */
  limitSec: number;
  /** Appelé une seule fois quand le timer atteint 0 (si limit > 0). */
  onTimeout?: () => void;
}

export function Timer({ startedAt, limitSec, onTimeout }: TimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startedAt]);

  if (startedAt === null) return null;
  const elapsedMs = now - startedAt;

  if (limitSec === 0) {
    const seconds = Math.floor(elapsedMs / 1000);
    const ms = Math.floor((elapsedMs % 1000) / 100);
    return (
      <span className="font-mono tabular-nums text-terminal-dim">
        {seconds}.{ms}s
      </span>
    );
  }

  const remainingMs = Math.max(0, limitSec * 1000 - elapsedMs);
  if (remainingMs === 0 && onTimeout) {
    setTimeout(onTimeout, 0);
  }
  const secs = Math.ceil(remainingMs / 1000);
  const danger = remainingMs <= 5_000;

  return (
    <span
      className={`font-mono tabular-nums ${
        danger ? "text-terminal-ko" : "text-terminal-accent"
      }`}
      aria-live="polite"
    >
      {secs}s
    </span>
  );
}
