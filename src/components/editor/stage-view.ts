"use client";

import { create } from "zustand";
import { clampZoom, DEFAULT_ZOOM, stepZoom } from "@/lib/client/stage-math";

export type Layout = "row" | "column";
const LAYOUT_KEY = "arrasta:stage-layout";
const GUIDES_KEY = "arrasta:stage-guides";

interface StageViewState {
  zoom: number;
  layout: Layout;
  guides: boolean;
  cardWidth: number;
  fitRequest: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  setLayout: (layout: Layout) => void;
  toggleGuides: () => void;
}

export const useStageView = create<StageViewState>((set) => ({
  zoom: DEFAULT_ZOOM,
  layout: "row",
  guides: false,
  cardWidth: 0,
  fitRequest: 0,
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => set((s) => ({ zoom: stepZoom(s.zoom, 1) })),
  zoomOut: () => set((s) => ({ zoom: stepZoom(s.zoom, -1) })),
  fit: () => set((s) => ({ zoom: DEFAULT_ZOOM, fitRequest: s.fitRequest + 1 })),
  setLayout: (layout) => {
    set({ layout });
    try { localStorage.setItem(LAYOUT_KEY, layout); } catch { /* Só nesta visita. */ }
  },
  toggleGuides: () => set((s) => {
    const guides = !s.guides;
    try { localStorage.setItem(GUIDES_KEY, guides ? "1" : "0"); } catch { /* Só nesta visita. */ }
    return { guides };
  }),
}));

export function restoreLayout() {
  try {
    useStageView.setState({
      layout: localStorage.getItem(LAYOUT_KEY) === "column" ? "column" : "row",
      guides: localStorage.getItem(GUIDES_KEY) === "1",
    });
  } catch { /* Sem armazenamento: usa os padrões. */ }
}
