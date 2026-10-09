"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Dialog as D } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "@/components/ui/icon";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  hideClose,
  footer,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  hideClose?: boolean;
  footer?: ReactNode;
  onOpenAutoFocus?: ComponentProps<typeof D.Content>["onOpenAutoFocus"];
  onCloseAutoFocus?: ComponentProps<typeof D.Content>["onCloseAutoFocus"];
}) {
  return (
    <D.Portal>
      <D.Overlay className="arrasta-veil fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
      <D.Content
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          "arrasta-dialog glass fixed left-1/2 top-1/2 z-50 flex max-h-[min(860px,calc(100dvh-32px))] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[22px] text-ink outline-none",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div className="min-w-0">
            <D.Title className="text-[17px] font-semibold tracking-[-0.01em]">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : ""}</D.Description>
            )}
          </div>
          {!hideClose && (
            <D.Close className="-mr-2 -mt-1 grid size-8 shrink-0 place-items-center rounded-[9px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink" aria-label="Fechar">
              <Icon icon={Cancel01Icon} className="size-[18px]" />
            </D.Close>
          )}
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-none px-6 pt-3", footer ? "pb-5" : "pb-6")}>{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}
