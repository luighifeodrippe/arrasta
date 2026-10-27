"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const modifier = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? "⌘" : "Ctrl+";

/** Mantém a primeira renderização igual à do servidor e adapta os atalhos ao computador. */
export function useModKey(): string {
  return useSyncExternalStore(subscribe, modifier, () => "Ctrl+");
}
