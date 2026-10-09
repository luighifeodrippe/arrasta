"use client";

import { create } from "zustand";

export type TextTarget = "title" | "body";

interface EditingState {
  /** Campo com o cursor agora (título, texto ou item de lista). */
  field: string | null;
  /** Último campo tocado no slide escolhido: a barra de ferramentas age nele mesmo depois que o cursor sai. */
  target: TextTarget | null;
  /** Liga ou desliga o destaque no trecho selecionado do campo em edição. */
  toggle: (() => void) | null;
  setEditing: (field: string | null, toggle: (() => void) | null) => void;
  setTarget: (target: TextTarget | null) => void;
  /** Editor rápido de foto e nome (aberto pela barra ou clicando no @ do card). */
  identityOpen: boolean;
  setIdentityOpen: (open: boolean) => void;
}

export const useEditing = create<EditingState>((set) => ({
  field: null,
  target: null,
  toggle: null,
  setEditing: (field, toggle) =>
    set(field ? { field, toggle, target: field === "title" ? "title" : "body" } : { field: null, toggle: null }),
  setTarget: (target) => set({ target }),
  identityOpen: false,
  setIdentityOpen: (identityOpen) => set({ identityOpen }),
}));
