"use client";

import confetti from "canvas-confetti";

const KEY = "arrasta:celebrated";

/**
 * Confete do primeiro carrossel (mesma base do Confetti do Magic UI, MIT: canvas-confetti).
 * Só na primeira vez, e nada para quem pediu menos movimento.
 */
export function celebrateFirstCarousel() {
  try {
    if (localStorage.getItem(KEY) === "1") return;
    localStorage.setItem(KEY, "1");
  } catch {
    return;
  }
  const colors = ["#ff3500", "#ffffff", "#ffd2c2", "#9a9a9a"];
  const base = { particleCount: 70, spread: 70, startVelocity: 48, ticks: 220, gravity: 1.05, scalar: 0.9, colors, zIndex: 9999, disableForReducedMotion: true };
  void confetti({ ...base, angle: 60, origin: { x: 0, y: 0.85 } });
  void confetti({ ...base, angle: 120, origin: { x: 1, y: 0.85 } });
}
