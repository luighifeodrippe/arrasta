"use client";

import { create } from "zustand";
import { makeSlide, MAX_SLIDES, uid } from "../defaults";
import type { ChatEntry, Design, Project, Slide, TextStyle } from "../types";

type Field = "title" | "body";

type Snapshot = Pick<Project, "title" | "slides" | "design" | "caption" | "hashtags">;

interface EditorState {
  project: Project | null;
  selectedId: string | null;
  past: Snapshot[];
  future: Snapshot[];
  /** Muda a cada alteração do usuário; o salvamento automático observa esse número. */
  revision: number;
  lastKey: string | null;
  lastAt: number;

  load: (project: Project) => void;
  /** Substitui pelo resultado do ChatGPT, guardando o estado anterior para "Desfazer". */
  replace: (patch: Partial<Snapshot> & { source?: Project["source"] }, select?: "first" | "keep") => void;
  /** Atualiza a fonte (ex.: texto lido) sem entrar no histórico. */
  setSource: (source: Project["source"]) => void;
  /** Conversa com o ChatGPT; não entra no desfazer, mas é salva. */
  addChat: (entry: ChatEntry) => void;
  /** Volta o carrossel para como estava antes de uma resposta (dá para desfazer). */
  restore: (entryId: string) => void;
  select: (id: string | null) => void;
  setTitle: (title: string) => void;
  setDesign: (patch: Partial<Design>) => void;
  setCaption: (caption: string) => void;
  setHashtags: (hashtags: string[]) => void;
  updateSlide: (id: string, patch: Partial<Slide>, key?: string) => void;
  /** A mesma mudança em todos os slides (ex.: posição do texto no carrossel inteiro). */
  updateAllSlides: (patch: Partial<Slide>) => void;
  /** Ajuste de texto (cor, alinhamento, tamanho, espaçamento) só neste slide. */
  setTextStyle: (id: string, fields: Field[], patch: Partial<TextStyle>, key?: string) => void;
  /** Ajuste de texto em todos os slides: vira o padrão do carrossel e sai dos ajustes de cada slide. */
  setTextStyleAll: (fields: Field[], patch: Partial<TextStyle>) => void;
  /** Guarda imagens enviadas na biblioteca do carrossel (não entra no desfazer). */
  addImages: (urls: string[]) => void;
  addSlide: (afterId?: string | null) => void;
  duplicateSlide: (id: string) => void;
  removeSlide: (id: string) => void;
  moveSlide: (from: number, to: number) => void;
  undo: () => void;
  redo: () => void;
}

const snapshot = (p: Project): Snapshot => ({
  title: p.title,
  slides: p.slides,
  design: p.design,
  caption: p.caption,
  hashtags: p.hashtags,
});

const HISTORY = 80;

export const useEditor = create<EditorState>((set, get) => {
  /** Aplica uma mudança. Mudanças seguidas com a mesma chave (digitação) viram um passo só. */
  const commit = (next: Partial<Snapshot>, key?: string) => {
    const { project, past, lastKey, lastAt } = get();
    if (!project) return;
    const now = Date.now();
    const merge = key && key === lastKey && now - lastAt < 1200;
    set({
      project: { ...project, ...next },
      past: merge ? past : [...past, snapshot(project)].slice(-HISTORY),
      future: [],
      revision: get().revision + 1,
      lastKey: key ?? null,
      lastAt: now,
    });
  };

  return {
    project: null,
    selectedId: null,
    past: [],
    future: [],
    revision: 0,
    lastKey: null,
    lastAt: 0,

    load: (project) =>
      set({ project, selectedId: project.slides[0]?.id ?? null, past: [], future: [], revision: 0, lastKey: null, lastAt: 0 }),

    replace: (patch, select = "first") => {
      const { project, past, selectedId } = get();
      if (!project) return;
      const { source, ...rest } = patch;
      const next = { ...project, ...rest, ...(source !== undefined ? { source } : {}) };
      const keep = select === "keep" && next.slides.some((s) => s.id === selectedId);
      set({
        project: next,
        past: project.slides.length ? [...past, snapshot(project)].slice(-HISTORY) : past,
        future: [],
        revision: get().revision + 1,
        selectedId: keep ? selectedId : (next.slides[0]?.id ?? null),
        lastKey: null,
      });
    },

    setSource: (source) => {
      const { project } = get();
      if (project) set({ project: { ...project, source } });
    },

    addChat: (entry) => {
      const { project } = get();
      if (!project) return;
      set({ project: { ...project, chat: [...project.chat, entry].slice(-60) }, revision: get().revision + 1 });
    },

    restore: (entryId) => {
      const { project } = get();
      const entry = project?.chat.find((e) => e.id === entryId);
      if (!project || !entry?.before) return;
      commit({ slides: entry.before.slides, caption: entry.before.caption, hashtags: entry.before.hashtags });
      const { selectedId } = get();
      if (!entry.before.slides.some((s) => s.id === selectedId)) set({ selectedId: entry.before.slides[0]?.id ?? null });
    },

    select: (id) => set({ selectedId: id }),
    setTitle: (title) => commit({ title }, "title"),
    setDesign: (patch) => {
      const { project } = get();
      if (project) commit({ design: { ...project.design, ...patch } }, `design:${Object.keys(patch).join(",")}`);
    },
    setCaption: (caption) => commit({ caption }, "caption"),
    setHashtags: (hashtags) => commit({ hashtags }, "hashtags"),

    updateSlide: (id, patch, key) => {
      const { project } = get();
      if (!project) return;
      commit({ slides: project.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)) }, key ? `${id}:${key}` : undefined);
    },

    updateAllSlides: (patch) => {
      const { project } = get();
      if (!project) return;
      commit({ slides: project.slides.map((s) => ({ ...s, ...patch })) });
    },

    setTextStyle: (id, fields, patch, key) => {
      const { project } = get();
      if (!project) return;
      commit(
        {
          slides: project.slides.map((s) =>
            s.id !== id
              ? s
              : {
                  ...s,
                  ...(fields.includes("title") ? { titleStyle: { ...s.titleStyle, ...patch } } : {}),
                  ...(fields.includes("body") ? { bodyStyle: { ...s.bodyStyle, ...patch } } : {}),
                },
          ),
        },
        key ? `${id}:style:${key}` : undefined,
      );
    },

    setTextStyleAll: (fields, patch) => {
      const { project } = get();
      if (!project) return;
      const clear = Object.fromEntries(Object.keys(patch).map((k) => [k, null])) as Partial<TextStyle>;
      const d = project.design;
      commit({
        design: {
          ...d,
          ...(fields.includes("title") ? { titleStyle: { ...d.titleStyle, ...patch } } : {}),
          ...(fields.includes("body") ? { bodyStyle: { ...d.bodyStyle, ...patch } } : {}),
        },
        slides: project.slides.map((s) => ({
          ...s,
          ...(fields.includes("title") ? { titleStyle: { ...s.titleStyle, ...clear } } : {}),
          ...(fields.includes("body") ? { bodyStyle: { ...s.bodyStyle, ...clear } } : {}),
        })),
      });
    },

    addImages: (urls) => {
      const { project } = get();
      if (!project || !urls.length) return;
      const images = [...urls.filter((u) => !project.images.includes(u)), ...project.images].slice(0, 120);
      set({ project: { ...project, images }, revision: get().revision + 1 });
    },

    addSlide: (afterId) => {
      const { project } = get();
      if (!project || project.slides.length >= MAX_SLIDES) return;
      const slide = makeSlide({ title: "Novo slide", body: "" });
      const index = afterId ? project.slides.findIndex((s) => s.id === afterId) : project.slides.length - 1;
      const slides = [...project.slides];
      slides.splice(index + 1, 0, slide);
      commit({ slides });
      set({ selectedId: slide.id });
    },

    duplicateSlide: (id) => {
      const { project } = get();
      if (!project || project.slides.length >= MAX_SLIDES) return;
      const index = project.slides.findIndex((s) => s.id === id);
      if (index < 0) return;
      const slides = [...project.slides];
      slides.splice(index + 1, 0, { ...project.slides[index], id: uid() });
      commit({ slides });
      set({ selectedId: slides[index + 1].id });
    },

    removeSlide: (id) => {
      const { project, selectedId } = get();
      if (!project || project.slides.length <= 1) return;
      const index = project.slides.findIndex((s) => s.id === id);
      const slides = project.slides.filter((s) => s.id !== id);
      commit({ slides });
      if (selectedId === id) set({ selectedId: slides[Math.min(index, slides.length - 1)]?.id ?? null });
    },

    moveSlide: (from, to) => {
      const { project } = get();
      if (!project || from === to) return;
      const slides = [...project.slides];
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      commit({ slides });
    },

    undo: () => {
      const { project, past, future } = get();
      if (!project || !past.length) return;
      const previous = past[past.length - 1];
      set({
        project: { ...project, ...previous },
        past: past.slice(0, -1),
        future: [snapshot(project), ...future],
        revision: get().revision + 1,
        lastKey: null,
      });
      const { selectedId } = get();
      if (!previous.slides.some((s) => s.id === selectedId)) set({ selectedId: previous.slides[0]?.id ?? null });
    },

    redo: () => {
      const { project, past, future } = get();
      if (!project || !future.length) return;
      const next = future[0];
      set({
        project: { ...project, ...next },
        past: [...past, snapshot(project)],
        future: future.slice(1),
        revision: get().revision + 1,
        lastKey: null,
      });
      const { selectedId } = get();
      if (!next.slides.some((s) => s.id === selectedId)) set({ selectedId: next.slides[0]?.id ?? null });
    },
  };
});
