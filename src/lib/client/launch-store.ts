"use client";

import { create } from "zustand";
import type { RemixLevel } from "../types";

export interface Launching {
  mode: "link" | "idea" | "prints";
  link: string;
  brief: string;
  previews: string[];
  count: number;
  level: RemixLevel;
  startedAt: number;
}

export const useLaunch = create<{
  launching: Launching | null;
  start: (launch: Launching) => void;
  clear: () => void;
}>((set) => ({
  launching: null,
  start: (launching) => set((state) => {
    state.launching?.previews.forEach((url) => URL.revokeObjectURL(url));
    return { launching };
  }),
  clear: () => set((state) => {
    state.launching?.previews.forEach((url) => URL.revokeObjectURL(url));
    return { launching: null };
  }),
}));
