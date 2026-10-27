"use client";

import { Cancel01Icon, Copy01Icon, Delete02Icon, Download04Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/lib/client/editor-store";
import { MAX_SLIDES } from "@/lib/defaults";
import { Icon } from "../ui/icon";
import { OrganizeButton } from "./Toolbar";
import { Tip } from "../ui/tooltip";

export function SelectionBar({ onDownload }: { onDownload: (ids: string[]) => void }) {
  const selection = useEditor((s) => s.selection);
  const full = useEditor((s) => (s.project?.slides.length ?? 0) >= MAX_SLIDES);
  const item = "flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-white/[0.08] hover:text-ink disabled:opacity-35";
  return (
    <div role="toolbar" aria-label="Seleção de slides" className="glass no-scrollbar flex h-12 min-w-0 max-w-full items-center overflow-x-auto rounded-[15px] px-1.5">
      <span role="status" className="shrink-0 px-2.5 text-[13px] text-ink-2 tabular-nums">{selection.length} slides selecionados</span>
      <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
      <OrganizeButton ids={selection} />
      <button className={item} disabled={full} onClick={() => useEditor.getState().duplicateSlides(selection)}><Icon icon={Copy01Icon} className="size-4" />Duplicar</button>
      <button className={item} onClick={() => onDownload(selection)}><Icon icon={Download04Icon} className="size-4" />Baixar</button>
      <button className={item} onClick={() => useEditor.getState().removeSlides(selection)}><Icon icon={Delete02Icon} className="size-4" />Excluir</button>
      <Tip label="Limpar seleção (Esc)"><button aria-label="Limpar seleção (Esc)" className="grid size-9 shrink-0 place-items-center rounded-[9px] text-ink-2 hover:bg-white/[0.08] hover:text-ink" onClick={() => useEditor.getState().clearSelection()}><Icon icon={Cancel01Icon} className="size-4" /></button></Tip>
    </div>
  );
}
