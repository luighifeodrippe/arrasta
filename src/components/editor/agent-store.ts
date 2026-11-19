"use client";

import { create } from "zustand";

export type AgentKind = "remix" | "create" | "edit";

/** Imagem (ou o quadro tirado de um vídeo) que a pessoa anexou ao pedido, já guardada no carrossel. */
export interface Attachment {
  id: string;
  url: string;
  /** De onde veio: o quadro de um vídeo é marcado para a pessoa saber. */
  kind: "image" | "video";
  name: string;
}

interface AgentState {
  running: boolean;
  kind: AgentKind | null;
  phase: "read" | "write" | null;
  status: string;
  /** Os passos que o ChatGPT já informou neste pedido, em ordem; o último é o que está em andamento. */
  steps: string[];
  thought: string | null;
  startedAt: number;
  controller: AbortController | null;
  /** Slides que a última resposta mudou, para piscar no palco. */
  highlight: { ids: string[]; at: number };
  /** Cards que o pedido em andamento pode mexer (vazio = o carrossel todo); o palco acende esses cards. */
  focus: string[];
  /** Cards cuja imagem está sendo gerada agora. */
  imaging: string[];
  setImaging: (id: string, on: boolean) => void;
  /** A conversa aberta (histórico completo) ou só a última resposta. */
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  /** O pedido que a pessoa está escrevendo e o que ela anexou; ficam aqui para não se perder quando a conversa troca de lugar (cartão ao lado ou barra de baixo). */
  draft: string;
  attachments: Attachment[];
  setDraft: (draft: string) => void;
  addAttachments: (attachments: Attachment[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
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
  steps: [],
  thought: null,
  startedAt: 0,
  controller: null,
  highlight: { ids: [], at: 0 },
  focus: [],
  imaging: [],
  setImaging: (id, on) => set({ imaging: on ? [...new Set([...get().imaging, id])] : get().imaging.filter((value) => value !== id) }),
  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
  draft: "",
  attachments: [],
  setDraft: (draft) => set({ draft }),
  addAttachments: (attachments) => set({ attachments: [...get().attachments, ...attachments].slice(0, 8) }),
  removeAttachment: (id) => set({ attachments: get().attachments.filter((attachment) => attachment.id !== id) }),
  clearAttachments: () => set({ attachments: [] }),
  flash: (ids) => set({ highlight: { ids, at: Date.now() } }),
  start: (kind, status) => {
    get().controller?.abort();
    const controller = new AbortController();
    set({ running: true, kind, status, steps: [status], thought: null, focus: [], phase: kind === "remix" ? "read" : "write", startedAt: Date.now(), controller });
    return controller;
  },
  update: (patch) => {
    const { steps } = get();
    set(patch.status && patch.status !== steps[steps.length - 1] ? { ...patch, steps: [...steps, patch.status].slice(-8) } : patch);
  },
  finish: () => set({ running: false, kind: null, phase: null, status: "", steps: [], thought: null, focus: [], controller: null }),
  stop: () => {
    get().controller?.abort();
    set({ running: false, kind: null, phase: null, status: "", steps: [], thought: null, focus: [], controller: null });
  },
}));
