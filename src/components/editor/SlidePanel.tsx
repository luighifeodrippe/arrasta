"use client";

import { useModKey } from "@/lib/client/shortcut";

import { AiMagicIcon, HighlighterIcon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { useEditor } from "@/lib/client/editor-store";
import { SLIDE_KINDS } from "@/lib/defaults";
import { cssText, fromDom, toggleEmphasis, toHtml } from "../slide/editing";
import { cn } from "../ui/cn";
import { Section } from "../ui/field";
import { useEditing, type TextTarget } from "./editing-store";
import { RewritePopover } from "./Toolbar";
import { Icon } from "@/components/ui/icon";

/** "#ff3500" + 0.3 → "rgb(255 53 0 / 0.3)". */
function tint(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgb(255 255 255 / ${a})`;
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`;
}

/**
 * Campo de texto rico do painel: mostra o destaque como no card (sem asteriscos),
 * ⌘B destaca a seleção e Enter quebra a linha.
 */
function RichField({
  id,
  field,
  value,
  onChange,
  accent,
  placeholder,
  label,
  className,
  registerToggle,
}: {
  id: string;
  field: TextTarget;
  value: string;
  onChange: (value: string) => void;
  accent: string;
  placeholder: string;
  label: string;
  className?: string;
  registerToggle: (toggle: () => void) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const emphasis: CSSProperties = { backgroundColor: tint(accent, 0.32), color: "#ffffff", borderRadius: "4px", padding: "0 2px" };
  const key = cssText(emphasis);
  const [html, setHtml] = useState(() => toHtml(value, emphasis));

  useEffect(() => {
    if (!focused.current) setHtml(toHtml(value, emphasis));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, key]);

  const emit = () => ref.current && onChange(fromDom(ref.current));
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !el.contains(selection.anchorNode)) {
      toast("Selecione as palavras que quer destacar.");
      el.focus();
      return;
    }
    toggleEmphasis(el, emphasis);
    emit();
  };
  registerToggle(toggle);

  return (
    <div
      ref={ref}
      id={id}
      role="textbox"
      aria-multiline
      aria-label={label}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      className={cn("arrasta-rich field w-full whitespace-pre-wrap break-words px-3.5 py-2.5 text-[14px] leading-relaxed outline-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
      onFocus={() => {
        focused.current = true;
        useEditing.getState().setTarget(field);
      }}
      onBlur={() => {
        focused.current = false;
        if (ref.current) setHtml(toHtml(fromDom(ref.current), emphasis));
      }}
      onInput={emit}
      onPaste={(event) => {
        event.preventDefault();
        document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
      }}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
          event.preventDefault();
          toggle();
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          document.execCommand("insertLineBreak");
        }
      }}
    />
  );
}

function FieldHeader({ htmlFor, label, onEmphasis, rewrite }: { htmlFor: string; label: string; onEmphasis: () => void; rewrite: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink-2">
        {label}
      </label>
      <span className="flex items-center gap-0.5">
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={onEmphasis}
          className="flex h-7 items-center gap-1 rounded-[8px] px-2 text-[12px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink"
        >
          <Icon icon={HighlighterIcon} className="size-3.5" />
          Destacar
        </button>
        {rewrite}
      </span>
    </div>
  );
}

export function SlidePanel() {
  const modKey = useModKey();
  const project = useEditor((s) => s.project)!;
  const selectedId = useEditor((s) => s.selectedId);
  const updateSlide = useEditor((s) => s.updateSlide);
  const index = project.slides.findIndex((s) => s.id === selectedId);
  const slide = project.slides[index];
  const toggles = useRef<Record<TextTarget, () => void>>({ title: () => undefined, body: () => undefined });

  if (!slide) {
    return <p className="px-5 py-8 text-[13.5px] text-ink-3">Escolha um slide no palco para editar.</p>;
  }

  const rewrite = (preset: TextTarget) => (
    <RewritePopover
      index={index}
      preset={preset}
      align="end"
      trigger={
        <button className="flex h-7 items-center gap-1 rounded-[8px] px-2 text-[12px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink data-[state=open]:bg-white/[0.1] data-[state=open]:text-ink">
          <Icon icon={AiMagicIcon} className="size-3.5" />
          Reescrever
        </button>
      }
    />
  );

  return (
    <div>
      <Section title={`Slide ${index + 1} de ${project.slides.length}`}>
        <div className="flex flex-wrap gap-1.5">
          {SLIDE_KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => updateSlide(slide.id, { kind: k.id })}
              className={cn(
                "h-8 rounded-[10px] border px-3 text-[13px] transition-colors",
                slide.kind === k.id ? "selected text-ink" : "border-white/[0.08] text-ink-2 hover:border-white/[0.16] hover:text-ink",
              )}
            >
              {k.name}
            </button>
          ))}
        </div>
        <div>
          <FieldHeader htmlFor="slide-title" label="Título" onEmphasis={() => toggles.current.title()} rewrite={rewrite("title")} />
          <RichField
            key={`${slide.id}-title`}
            id="slide-title"
            field="title"
            value={slide.title}
            onChange={(title) => updateSlide(slide.id, { title }, "title")}
            accent={project.design.accent}
            placeholder="A frase principal do slide"
            label="Título do slide"
            className="min-h-[76px] text-[15px] font-medium"
            registerToggle={(t) => (toggles.current.title = t)}
          />
        </div>
        <div>
          <FieldHeader htmlFor="slide-body" label="Texto" onEmphasis={() => toggles.current.body()} rewrite={rewrite("body")} />
          <RichField
            key={`${slide.id}-body`}
            id="slide-body"
            field="body"
            value={slide.body}
            onChange={(body) => updateSlide(slide.id, { body }, "body")}
            accent={project.design.accent}
            placeholder={slide.kind === "list" ? "1. Primeiro ponto\n2. Segundo ponto" : "Complemento (opcional)"}
            label="Texto do slide"
            className="min-h-[124px]"
            registerToggle={(t) => (toggles.current.body = t)}
          />
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
            Selecione palavras e use {modKey}B para destacar. Em listas, um item por linha. Fonte, cor, alinhamento, imagem e fundo ficam na barra em cima dos slides.
          </p>
        </div>
      </Section>
    </div>
  );
}
