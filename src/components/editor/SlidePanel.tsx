"use client";

import { useModKey } from "@/lib/client/shortcut";

import { Add01Icon, AiMagicIcon, ArrowDown01Icon, HighlighterIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { useEditor } from "@/lib/client/editor-store";
import { SLIDE_KINDS } from "@/lib/defaults";
import { BODY_WORDS, TITLE_WORDS, words } from "@/lib/review";
import type { Slide } from "@/lib/types";
import { cssText, fromDom, toggleEmphasis, toHtml } from "../slide/editing";
import { cn } from "../ui/cn";
import { Section } from "../ui/field";
import { Tip } from "../ui/tooltip";
import { useEditing, type TextTarget } from "./editing-store";
import { useAgent } from "./agent-store";
import { useAgentActions } from "./use-agent-actions";
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

/** O tipo do card (capa, lista, final…), num menu pequeno no cabeçalho dele. */
function KindMenu({ slide }: { slide: Slide }) {
  const updateSlide = useEditor((s) => s.updateSlide);
  const [open, setOpen] = useState(false);
  const name = SLIDE_KINDS.find((kind) => kind.id === slide.kind)?.name ?? "Conteúdo";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="script-kind" aria-label={`Tipo do card: ${name}`}>
          {name}
          <Icon icon={ArrowDown01Icon} className="size-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="glass z-50 grid w-[168px] gap-0.5 rounded-[14px] p-1.5 outline-none">
          {SLIDE_KINDS.map((kind) => (
            <button
              key={kind.id}
              type="button"
              className="talk"
              aria-pressed={slide.kind === kind.id}
              onClick={() => {
                updateSlide(slide.id, { kind: kind.id });
                setOpen(false);
              }}
            >
              <span className="flex items-center justify-between gap-2">
                {kind.name}
                {slide.kind === kind.id && <Icon icon={Tick02Icon} className="size-4" />}
              </span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Um card do roteiro: o número, o tipo e os dois textos. O card escolhido ganha as ações (destacar, imagem). */
function ScriptCard({ slide, index, current, accent }: { slide: Slide; index: number; current: boolean; accent: string }) {
  const modKey = useModKey();
  const select = useEditor((s) => s.select);
  const updateSlide = useEditor((s) => s.updateSlide);
  const toggles = useRef<Record<TextTarget, () => void>>({ title: () => undefined, body: () => undefined });
  const { picture } = useAgentActions();
  const imaging = useAgent((state) => state.imaging.includes(slide.id));
  const titleWords = words(slide.title);
  const bodyWords = slide.kind === "table" ? 0 : words(slide.body);
  const warning = titleWords > TITLE_WORDS ? `título com ${titleWords} palavras` : bodyWords > BODY_WORDS ? `texto com ${bodyWords} palavras` : "";
  const pick = () => {
    if (!current) select(slide.id);
  };

  return (
    <section id={`roteiro-${slide.id}`} className="panel-group script-card" data-current={current || undefined} onPointerDownCapture={pick} onFocusCapture={pick}>
      <div className="panel-group-head">
        <div className="flex min-w-0 items-center gap-2">
          <span className="script-number">{index + 1}</span>
          <KindMenu slide={slide} />
        </div>
        {warning && (
          <span className="seal" data-tone="warn">
            {warning}
          </span>
        )}
      </div>
      <RichField
        key={`${slide.id}-title`}
        id={`slide-title-${slide.id}`}
        field="title"
        value={slide.title}
        onChange={(title) => updateSlide(slide.id, { title }, "title")}
        accent={accent}
        placeholder={slide.kind === "stat" ? "73%, R$ 4 mil, 3 em 10…" : "A frase principal do card"}
        label={`Título do card ${index + 1}`}
        className="min-h-[44px] text-[14.5px] font-semibold leading-snug"
        registerToggle={(toggle) => (toggles.current.title = toggle)}
      />
      <RichField
        key={`${slide.id}-body`}
        id={`slide-body-${slide.id}`}
        field="body"
        value={slide.body}
        onChange={(body) => updateSlide(slide.id, { body }, "body")}
        accent={accent}
        placeholder={slide.kind === "table" ? "Item | Valor\nPrimeiro | 10\nSegundo | 20" : slide.kind === "stat" ? "O que esse número significa" : slide.kind === "list" ? "1. Primeiro ponto\n2. Segundo ponto" : "Complemento (opcional)"}
        label={`Texto do card ${index + 1}`}
        className="-mt-1 min-h-[62px] text-[13.5px]"
        registerToggle={(toggle) => (toggles.current.body = toggle)}
      />
      {current && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tip label={`Selecione as palavras e destaque (${modKey}B)`}>
            <button
              type="button"
              className="chip-key"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => (document.activeElement?.id === `slide-body-${slide.id}` ? toggles.current.body() : toggles.current.title())}
            >
              <Icon icon={HighlighterIcon} className="size-3.5" />
              Destacar
            </button>
          </Tip>
          {slide.imageIdea && !slide.image && (
            <Tip label={`Imagem sugerida: ${slide.imageIdea}`}>
              <button type="button" className="chip-key" onClick={() => void picture([{ id: slide.id }])} disabled={imaging}>
                <Icon icon={AiMagicIcon} className="size-3.5" />
                {imaging ? "Gerando a imagem…" : "Gerar a imagem"}
              </button>
            </Tip>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Roteiro: o texto de todos os cards em sequência, para ler a história inteira (gancho, desenvolvimento, chamada)
 * e mexer em qualquer um sem sair do lugar. Fonte, cor, imagem e fundo de cada card ficam na barra sobre o palco.
 */
export function SlidePanel() {
  const project = useEditor((s) => s.project)!;
  const selectedId = useEditor((s) => s.selectedId);
  const addSlide = useEditor((s) => s.addSlide);

  // Escolheu um card no palco: o roteiro mostra o mesmo card.
  useEffect(() => {
    if (selectedId) document.getElementById(`roteiro-${selectedId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  if (!project.slides.length) {
    return (
      <Section title="Roteiro">
        <p className="panel-note">O texto de cada card aparece aqui, em sequência, assim que o carrossel for criado.</p>
      </Section>
    );
  }

  return (
    <div>
      {project.slides.map((slide, index) => (
        <ScriptCard key={slide.id} slide={slide} index={index} current={slide.id === selectedId} accent={project.design.accent} />
      ))}
      <div className="px-2 pb-3">
        <button type="button" className="chip-key w-full justify-center" onClick={() => addSlide(project.slides[project.slides.length - 1]?.id)}>
          <Icon icon={Add01Icon} className="size-3.5" />
          Novo card
        </button>
      </div>
    </div>
  );
}
