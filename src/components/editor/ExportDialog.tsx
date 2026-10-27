"use client";

import { Download04Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from "react";
import { identityOf, useApp } from "@/lib/client/app-store";
import { slideHeight } from "@/lib/defaults";
import type { Project } from "@/lib/types";
import { SlideCanvas, SlideFrame } from "../slide/SlideCanvas";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Dialog, DialogContent } from "../ui/dialog";
import { Icon } from "../ui/icon";

export function ExportDialog({
  open,
  onOpenChange,
  project,
  selectedId,
  initialSelection,
  onExport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  selectedId?: string | null;
  initialSelection?: string[];
  onExport: (indices: number[]) => void;
}) {
  const profile = useApp((state) => state.profile);
  const identity = identityOf(profile);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [selection, setSelection] = useState<Set<string>>(() => new Set(project.slides.map((slide) => slide.id)));
  const slideIds = project.slides.map((slide) => slide.id).join(",");

  const initialIds = initialSelection?.join(",");
  useEffect(() => {
    if (open) setSelection(new Set((initialIds ?? slideIds).split(",").filter(Boolean)));
  }, [open, slideIds, initialIds]);

  const indices = project.slides.flatMap((slide, index) => selection.has(slide.id) ? [index] : []);
  const count = indices.length;
  const currentIndex = project.slides.findIndex((slide) => slide.id === selectedId);
  const allSelected = count === project.slides.length;

  const toggle = (id: string) => setSelection((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Baixar cards"
        description={`PNG em 1080 × ${slideHeight(project.design.size)}. Vários cards vêm em um ZIP com a legenda.`}
        className="w-[min(640px,calc(100vw-32px))] overscroll-contain"
        onOpenAutoFocus={() => { triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={(event) => {
          if (triggerRef.current?.isConnected) {
            event.preventDefault();
            triggerRef.current.focus();
          }
        }}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-[13px] text-ink-2 tabular-nums">
              {count} de {project.slides.length} selecionados
            </p>
            <Button variant="primary" size="sm" disabled={count === 0} onClick={() => { onExport(indices); onOpenChange(false); }}>
              <Icon icon={Download04Icon} />
              {count === 1 ? "Baixar PNG" : "Baixar ZIP"}
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Seleção de cards">
          <Button size="sm" variant={allSelected ? "glass" : "ghost"} aria-pressed={allSelected} onClick={() => setSelection(new Set(project.slides.map((slide) => slide.id)))}>Todos</Button>
          <Button size="sm" variant={count === 0 ? "glass" : "ghost"} aria-pressed={count === 0} onClick={() => setSelection(new Set())}>Nenhum</Button>
          {currentIndex >= 0 && <Button size="sm" variant="ghost" onClick={() => setSelection(new Set([project.slides[currentIndex].id]))}>Só o atual ({currentIndex + 1})</Button>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="Cards para baixar">
          {project.slides.map((slide, index) => {
            const checked = selection.has(slide.id);
            const title = slide.title.replace(/\*\*/g, "").trim();
            return (
              <label
                key={slide.id}
                className={cn(
                  "min-w-0 cursor-pointer overflow-hidden rounded-[12px] border p-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white",
                  checked ? "border-white/60 bg-white/[0.06]" : "border-line hover:border-line-strong",
                )}
              >
                <div className="pointer-events-none overflow-hidden rounded-[6px]" aria-hidden>
                  <SlideFrame size={project.design.size}>
                    <SlideCanvas slide={slide} index={index} total={project.slides.length} design={project.design} identity={identity} />
                  </SlideFrame>
                </div>
                <span className="flex min-h-9 items-center gap-2 px-1 pt-1 text-[12px]">
                  <input type="checkbox" checked={checked} onChange={() => toggle(slide.id)} aria-label={`Card ${index + 1}${title ? `: ${title}` : ""}`} className="size-4 shrink-0 accent-white" />
                  <span className="shrink-0 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                  <span className="truncate text-ink-2">{title || "Sem título"}</span>
                </span>
              </label>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
