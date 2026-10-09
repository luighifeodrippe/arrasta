"use client";

import { create } from "zustand";

export type Layout = "row" | "column";

const LAYOUT_KEY = "arrasta:stage-layout";
export const ZOOM_LEVELS = 3;

interface StageViewState {
  /** Tamanho dos cards no palco: 0 (menor) a 2 (maior). */
  zoom: number;
  /** Lado a lado (como no feed) ou em coluna (como no Canva). */
  layout: Layout;
  setZoom: (zoom: number) => void;
  setLayout: (layout: Layout) => void;
}

export const useStageView = create<StageViewState>((set) => ({
  zoom: 1,
  layout: "row",
  setZoom: (zoom) => set({ zoom: Math.max(0, Math.min(ZOOM_LEVELS - 1, zoom)) }),
  setLayout: (layout) => {
    set({ layout });
    try {
      localStorage.setItem(LAYOUT_KEY, layout);
    } catch {
      // Sem armazenamento: vale só nesta visita.
    }
  },
}));

/** A escolha de layout fica salva neste navegador. */
export function restoreLayout() {
  try {
    if (localStorage.getItem(LAYOUT_KEY) === "column") useStageView.setState({ layout: "column" });
  } catch {
    // Sem armazenamento: começa lado a lado.
  }
}
