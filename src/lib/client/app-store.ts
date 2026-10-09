"use client";

import { create } from "zustand";
import type { AuthStatus, CarouselFormat, ModelOption, Profile, Settings } from "../types";
import { api } from "./api";

type Auth = AuthStatus & { models: ModelOption[] };

export type SettingsTab = "perfil" | "voz" | "escrita" | "formatos" | "chatgpt";

interface AppState {
  auth: Auth | null;
  profile: Profile | null;
  settings: Settings | null;
  formats: CarouselFormat[];
  loadFormats: () => Promise<void>;
  setFormats: (formats: CarouselFormat[]) => void;
  loginOpen: boolean;
  /** Aba aberta em Configurações (null = fechado). */
  settingsTab: SettingsTab | null;
  refreshAuth: () => Promise<Auth | null>;
  loadProfile: () => Promise<void>;
  loadSettings: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  setSettings: (settings: Settings) => void;
  setLoginOpen: (open: boolean) => void;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
}

export const useApp = create<AppState>((set) => ({
  auth: null,
  profile: null,
  settings: null,
  formats: [],
  loadFormats: async () => {
    try {
      set({ formats: await api.formats() });
    } catch {
      // Sem formatos.
    }
  },
  setFormats: (formats) => set({ formats }),
  loginOpen: false,
  settingsTab: null,
  refreshAuth: async () => {
    try {
      const auth = await api.auth();
      set({ auth });
      return auth;
    } catch {
      return null;
    }
  },
  loadProfile: async () => {
    try {
      set({ profile: await api.profile() });
    } catch {
      // Sem perfil ainda.
    }
  },
  loadSettings: async () => {
    try {
      set({ settings: (await api.settings()).settings });
    } catch {
      // Usa o padrão.
    }
  },
  setProfile: (profile) => set({ profile }),
  setSettings: (settings) => set({ settings }),
  setLoginOpen: (loginOpen) => set({ loginOpen }),
  openSettings: (tab = "perfil") => set({ settingsTab: tab }),
  closeSettings: () => set({ settingsTab: null }),
}));

export function identityOf(profile: Profile | null) {
  return {
    name: profile?.name ?? "",
    handle: profile?.handle ?? "",
    avatar: profile?.avatar ?? null,
    verified: profile?.verified ?? false,
  };
}
