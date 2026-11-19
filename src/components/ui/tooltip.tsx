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
        <T.Content side={side} sideOffset={8} className="arrasta-pop z-[60] max-w-[280px] rounded-[9px] border border-white/[0.08] bg-[rgb(24_24_24/0.96)] px-2.5 py-1.5 text-[12.5px] leading-snug text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_10px_24px_-10px_rgb(0_0_0/0.8)] backdrop-blur">
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
