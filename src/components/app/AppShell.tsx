"use client";

import { MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/lib/client/app-store";
import { TooltipProvider } from "../ui/tooltip";
import { LoginDialog } from "./ChatGPTAccount";
import { SettingsDialog } from "./SettingsDialog";

export function AppShell({ children }: { children: ReactNode }) {
  const refreshAuth = useApp((s) => s.refreshAuth);
  const loadProfile = useApp((s) => s.loadProfile);
  const loadSettings = useApp((s) => s.loadSettings);
  const loadFormats = useApp((s) => s.loadFormats);

  useEffect(() => {
    void refreshAuth();
    void loadProfile();
    void loadSettings();
    void loadFormats();
    const onFocus = () => void refreshAuth();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshAuth, loadProfile, loadSettings, loadFormats]);

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        {children}
        <LoginDialog />
        <SettingsDialog />
      </TooltipProvider>
    </MotionConfig>
  );
}
