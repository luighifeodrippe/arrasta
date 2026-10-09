"use client";

import { create } from "zustand";

export type AgentKind = "remix" | "create" | "edit";

interface AgentState {
  running: boolean;
  kind: AgentKind | null;
  phase: "read" | "write" | null;
  status: string;
  thought: string | null;
  startedAt: number;
  controller: AbortController | null;
  /** Slides que a última resposta mudou, para piscar no palco. */
  highlight: { ids: string[]; at: number };
  /** A conversa aberta (histórico completo) ou só a última resposta. */
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  flash: (ids: string[]) => void;
  start: (kind: AgentKind, status: string) => AbortController;
  update: (patch: Partial<Pick<AgentState, "status" | "thought" | "phase">>) => void;
  finish: () => void;
  stop: () => void;
}

export const useAgent = create<AgentState>((set, get) => ({
  running: false,
  kind: null,
  phase: null,
  status: "",
  thought: null,
  startedAt: 0,
  controller: null,
  highlight: { ids: [], at: 0 },
  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
  flash: (ids) => set({ highlight: { ids, at: Date.now() } }),
  start: (kind, status) => {
    get().controller?.abort();
    const controller = new AbortController();
    set({ running: true, kind, status, thought: null, phase: kind === "remix" ? "read" : "write", startedAt: Date.now(), controller });
    return controller;
  },
  update: (patch) => set(patch),
  finish: () => set({ running: false, kind: null, phase: null, status: "", thought: null, controller: null }),
  stop: () => {
    get().controller?.abort();
    set({ running: false, kind: null, phase: null, status: "", thought: null, controller: null });
  },
}));
