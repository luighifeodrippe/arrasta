"use client";

import { Tooltip as T } from "radix-ui";
import type { ReactNode } from "react";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <T.Provider delayDuration={350} skipDelayDuration={150}>{children}</T.Provider>;
}

export function Tip({ label, children, side = "bottom" }: { label: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={8} className="arrasta-pop z-[60] rounded-[9px] border border-white/10 bg-[#1c1c1c]/95 px-2.5 py-1.5 text-[12.5px] text-ink shadow-xl backdrop-blur">
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
