"use client";

import { useModKey } from "@/lib/client/shortcut";

import {
  AiMagicIcon,
  ArrangeIcon,
  ArrowDown01Icon,
  Camera01Icon,
  Delete02Icon,
  HighlighterIcon,
  ImageAdd02Icon,
  MinusSignIcon,
  PaintBucketIcon,
  ParagraphSpacingIcon,
  PlusSignIcon,
  TextAlignCenterIcon,
  TextAlignJustifyLeftIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  Tick02Icon,
  Upload04Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { Popover, Toolbar as T } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { imageLibrary, placeImage, uploadImages } from "@/lib/client/images";
import { ACCENTS, FONTS, fontVar } from "@/lib/defaults";
import type { Design, FontId, Profile, Slide, SlideImage, TextAlign, TextStyle } from "@/lib/types";
import { cn } from "../ui/cn";
import { Input, Label } from "../ui/field";
import { Segmented } from "../ui/segmented";
import { Range } from "../ui/slider";
import { Toggle } from "../ui/switch";
import { Tip } from "../ui/tooltip";
import { useAgent } from "./agent-store";
import { useEditing, type TextTarget } from "./editing-store";
import { Swatches } from "./Swatches";
import { useAgentActions } from "./use-agent-actions";

const TEXT_COLORS = ["#ffffff", "#0a0a0a", "#f3efe7", "#8a8a8a", "#ff3500", "#ffd60a", "#1d9bf0", "#16a34a"];
const BACKGROUNDS = ["#ffffff", "#f3efe7", "#e8f0ff", "#0b0b0b", "#000000", "#1a1033", "#0f2a1d", "#ff3500"];
const ALIGNS: { value: TextAlign; label: string; icon: ReactNode }[] = [
  { value: "left", label: "À esquerda", icon: <Icon icon={TextAlignLeftIcon} /> },
  { value: "center", label: "Centralizado", icon: <Icon icon={TextAlignCenterIcon} /> },
  { value: "right", label: "À direita", icon: <Icon icon={TextAlignRightIcon} /> },
  { value: "justify", label: "Justificado", icon: <Icon icon={TextAlignJustifyLeftIcon} /> },
];
const REWRITES = ["Mais curto", "Gancho mais forte", "Mais simples", "Outra versão", "Corrigir erros"];

type Scope = TextTarget | "both";

const SCOPES: { value: Scope; label: string }[] = [
  { value: "title", label: "Título" },
  { value: "body", label: "Texto" },
  { value: "both", label: "Os dois" },
];

const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Botão da barra: ícone com rótulo opcional, sem roubar o foco do texto em edição. */
const itemClass =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-2 text-[13px] text-ink-2 outline-none transition-colors hover:bg-white/[0.07] hover:text-ink focus-visible:bg-white/[0.07] focus-visible:text-ink data-[state=open]:bg-white/[0.1] data-[state=open]:text-ink [&_svg]:size-[18px]";
const iconOnly = cn(itemClass, "w-9 justify-center px-0");

function Separator() {
  return <T.Separator className="mx-1 h-5 w-px shrink-0 bg-white/[0.1]" />;
}

function Panel({
  trigger,
  children,
  width = 288,
  label,
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  children: ReactNode;
  width?: number;
  label: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={10}
          collisionPadding={12}
          aria-label={label}
          className="arrasta-pop glass z-50 flex max-h-[min(640px,calc(100dvh-120px))] flex-col gap-3 overflow-y-auto rounded-[16px] p-3.5 text-ink"
          style={{ width }}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-medium text-ink-3">{children}</p>;
}

function Actions({ onAll, onReset }: { onAll: () => void; onReset?: () => void }) {
  return (
    <div className="flex gap-1.5">
      {onReset && (
        <button onClick={onReset} className="h-8 flex-1 rounded-[10px] text-[12.5px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink">
          Restaurar padrão
        </button>
      )}
      <button onClick={onAll} className="h-8 flex-[1.4] rounded-[10px] bg-white/[0.07] text-[12.5px] text-ink transition-colors hover:bg-white/[0.12]">
        Aplicar em todos os slides
      </button>
    </div>
  );
}

/** Em qual campo a mudança vale: começa no último texto tocado no card. */
function useScope(): [Scope, (scope: Scope) => void] {
  const target = useEditing((s) => s.target);
  const [picked, setPicked] = useState<Scope | null>(null);
  return [picked ?? target ?? "both", setPicked];
}

function fieldsOf(scope: Scope): TextTarget[] {
  return scope === "both" ? ["title", "body"] : [scope];
}

/** O valor do slide, senão o do carrossel, senão o do modelo. */
function valueOf<K extends keyof TextStyle>(slide: Slide, design: Design, field: TextTarget, key: K): TextStyle[K] {
  const own = field === "title" ? slide.titleStyle : slide.bodyStyle;
  const base = field === "title" ? design.titleStyle : design.bodyStyle;
  return own[key] ?? base[key];
}

/** Barra de formatação do slide escolhido, como a do Canva. */
export function EditorToolbar() {
  const project = useEditor((s) => s.project)!;
  const selectedId = useEditor((s) => s.selectedId);
  const index = project.slides.findIndex((s) => s.id === selectedId);
  const slide = project.slides[index];
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  // Em telas estreitas a barra rola para o lado; um esmaecido na ponta mostra que há mais.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [slide?.id]);

  if (!slide) return null;
  return (
    <T.Root
      ref={ref}
      aria-label={`Formatar o slide ${index + 1}`}
      data-tour="toolbar"
      className={cn(
        "glass no-scrollbar flex h-12 min-w-0 max-w-full items-center overflow-x-auto rounded-[15px] px-1.5",
        more && "[mask-image:linear-gradient(to_right,#000_calc(100%-48px),transparent)]",
      )}
    >
      <FontPicker />
      <TextSize slide={slide} />
      <Separator />
      <ColorPicker slide={slide} />
      <Emphasis />
      <SpacingPicker slide={slide} />
      <AlignPicker slide={slide} />
      <OrganizeButton ids={[slide.id]} />
      <DeleteField slide={slide} />
      <Separator />
      <ImagePicker slide={slide} />
      <BackgroundPicker slide={slide} />
      <ProfilePicker />
      <Separator />
      <Rewrite index={index} />
    </T.Root>
  );
}

/** O mesmo controle para o slide atual e para a seleção múltipla. */
export function OrganizeButton({ ids }: { ids: string[] }) {
  const organize = () => {
    const state = useEditor.getState();
    const needs = state.project?.slides.some((s) => ids.includes(s.id) && (Object.keys(s.offsets ?? {}).length > 0 || s.gap != null || s.valign != null));
    if (!needs) { toast(ids.length === 1 ? "Este slide já está organizado" : "Estes slides já estão organizados"); return; }
    state.organizeSlides(ids);
  };
  return <Tip label="Organizar: volta as peças para o lugar, com o espaço certo">
    <button type="button" className={itemClass} onClick={organize}><Icon icon={ArrangeIcon} />Organizar</button>
  </Tip>;
}

function FontPicker() {
  const design = useEditor((s) => s.project!.design);
  const setDesign = useEditor((s) => s.setDesign);
  const [scope, setScope] = useScope();
  const currentId: FontId = scope === "title" ? (design.titleFont ?? design.font) : scope === "body" ? (design.bodyFont ?? design.font) : design.font;
  const current = FONTS.find((f) => f.id === currentId) ?? FONTS[0];
  const choose = (id: FontId) => {
    if (scope === "both") setDesign({ font: id, titleFont: null, bodyFont: null });
    else if (scope === "title") setDesign({ titleFont: id === design.font ? null : id });
    else setDesign({ bodyFont: id === design.font ? null : id });
  };
  return (
    <Panel
      label="Fonte"
      width={260}
      trigger={
        <T.Button className={cn(itemClass, "justify-between pl-2.5 text-ink @min-[560px]:w-[136px]")} aria-label={`Fonte: ${current.name}`}>
          <span className="truncate text-[14px]" style={{ fontFamily: fontVar(current.id), fontWeight: current.id === "caveat" ? 700 : 500 }}>
            <span className="@min-[560px]:hidden">Aa</span>
            <span className="hidden @min-[560px]:inline">{current.name}</span>
          </span>
          <Icon icon={ArrowDown01Icon} className="!size-3.5 text-ink-3" />
        </T.Button>
      }
    >
      <Heading>Fonte · vale para todos os slides</Heading>
      <Segmented label="Fonte de qual texto" size="sm" className="w-full" value={scope} onChange={setScope} options={SCOPES} />
      <div className="-mx-1.5 flex flex-col">
        {FONTS.map((f) => (
          <button
            key={f.id}
            onClick={() => choose(f.id)}
            className="flex h-10 shrink-0 items-center justify-between rounded-[10px] px-2.5 text-left transition-colors hover:bg-white/[0.07]"
          >
            <span style={{ fontFamily: fontVar(f.id), fontWeight: f.weight, fontSize: 17 }}>{f.name}</span>
            {f.id === currentId && <Icon icon={Tick02Icon} className="size-4 text-ink-2" />}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function TextSize({ slide }: { slide: Slide }) {
  const design = useEditor((s) => s.project!.design);
  const setTextStyle = useEditor((s) => s.setTextStyle);
  const target = useEditing((s) => s.target);
  const fields: TextTarget[] = target ? [target] : ["title", "body"];
  const size = (field: TextTarget) => valueOf(slide, design, field, "size") ?? 1;
  const current = size(fields[0]);
  const step = (delta: number) => {
    for (const field of fields) setTextStyle(slide.id, [field], { size: round(clamp(size(field) + delta, 0.5, 1.8)) }, "size");
  };
  const what = target === "title" ? "do título" : target === "body" ? "do texto" : "do slide";
  return (
    <div className="ml-1 flex shrink-0 items-center rounded-[10px] bg-white/[0.04]" role="group" aria-label={`Tamanho ${what}`}>
      <Tip label={`Diminuir o tamanho ${what}`}>
        <T.Button onMouseDown={(e) => e.preventDefault()} onClick={() => step(-0.05)} disabled={current <= 0.5} className={cn(iconOnly, "w-8 disabled:opacity-35")} aria-label={`Diminuir o tamanho ${what}`}>
          <Icon icon={MinusSignIcon} />
        </T.Button>
      </Tip>
      <span className="w-11 text-center text-[12.5px] tabular-nums text-ink" aria-live="polite">
        {Math.round(current * 100)}%
      </span>
      <Tip label={`Aumentar o tamanho ${what}`}>
        <T.Button onMouseDown={(e) => e.preventDefault()} onClick={() => step(0.05)} disabled={current >= 1.8} className={cn(iconOnly, "w-8 disabled:opacity-35")} aria-label={`Aumentar o tamanho ${what}`}>
          <Icon icon={PlusSignIcon} />
        </T.Button>
      </Tip>
    </div>
  );
}

function ColorPicker({ slide }: { slide: Slide }) {
  const design = useEditor((s) => s.project!.design);
  const setDesign = useEditor((s) => s.setDesign);
  const setTextStyle = useEditor((s) => s.setTextStyle);
  const setTextStyleAll = useEditor((s) => s.setTextStyleAll);
  const [scope, setScope] = useScope();
  const fields = fieldsOf(scope);
  const values = fields.map((f) => valueOf(slide, design, f, "color"));
  const value = values.every((v) => v === values[0]) ? values[0] : null;
  const shown = valueOf(slide, design, "title", "color") ?? valueOf(slide, design, "body", "color");
  return (
    <Panel
      label="Cores do texto"
      width={300}
      trigger={
        <T.Button className={iconOnly} aria-label="Cores do texto e do destaque">
          <span className="flex flex-col items-center leading-none">
            <span className="text-[16px] font-semibold text-ink">A</span>
            <span className="mt-[3px] h-[3px] w-[18px] rounded-full shadow-[0_0_0_1px_rgb(255_255_255/0.18)]" style={{ background: shown ?? "rgb(245 245 245)" }} />
          </span>
        </T.Button>
      }
    >
      <Heading>Cor do texto</Heading>
      <Segmented label="Aplicar a cor em" size="sm" className="w-full" value={scope} onChange={setScope} options={SCOPES} />
      <Swatches value={value} onChange={(color) => setTextStyle(slide.id, fields, { color })} colors={TEXT_COLORS} allowDefault label="Cor do texto" />
      <Actions
        onAll={() => {
          setTextStyleAll(fields, { color: value });
          toast.success("Cor aplicada em todos os slides");
        }}
      />
      <div className="-mx-3.5 my-0.5 h-px shrink-0 bg-white/[0.08]" />
      <Heading>Cor do destaque · palavras destacadas em todos os slides</Heading>
      <Swatches value={design.accent} onChange={(next) => setDesign({ accent: next ?? "#ff3500" })} colors={ACCENTS} label="Cor do destaque" />
    </Panel>
  );
}

function Emphasis() {
  const modKey = useModKey();
  const toggle = useEditing((s) => s.toggle);
  return (
    <Tip label={toggle ? `Destacar a seleção (${modKey}B)` : "Clique no texto do card e selecione palavras para destacar"}>
      <T.Button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (toggle ? toggle() : toast("Clique no texto do card e selecione as palavras que quer destacar."))}
        className={cn(iconOnly, !toggle && "opacity-60")}
        aria-label="Destacar a seleção"
      >
        <Icon icon={HighlighterIcon} />
      </T.Button>
    </Tip>
  );
}

/** Tamanho, entrelinha e espaço entre letras do título e do texto, e o espaço entre os blocos do slide. */
function SpacingPicker({ slide }: { slide: Slide }) {
  const design = useEditor((s) => s.project!.design);
  const setTextStyle = useEditor((s) => s.setTextStyle);
  const setTextStyleAll = useEditor((s) => s.setTextStyleAll);
  const updateSlide = useEditor((s) => s.updateSlide);
  const updateAllSlides = useEditor((s) => s.updateAllSlides);
  const setDesign = useEditor((s) => s.setDesign);
  const [scope, setScope] = useScope();
  const fields = fieldsOf(scope);
  const first = fields[0];
  const size = valueOf(slide, design, first, "size") ?? 1;
  const leading = valueOf(slide, design, first, "leading") ?? 1;
  const tracking = valueOf(slide, design, first, "tracking") ?? 0;
  const gap = slide.gap ?? design.gap ?? 1;
  return (
    <Panel
      label="Espaçamento"
      width={300}
      trigger={
        <T.Button className={iconOnly} aria-label="Tamanho e espaçamento do texto">
          <Icon icon={ParagraphSpacingIcon} />
        </T.Button>
      }
    >
      <Heading>Tamanho e espaçamento</Heading>
      <Segmented label="Ajustar qual texto" size="sm" className="w-full" value={scope} onChange={setScope} options={SCOPES} />
      <Range label="Tamanho" value={size} min={0.5} max={1.8} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setTextStyle(slide.id, fields, { size: round(v) }, "size")} />
      <Range label="Altura da linha" value={leading} min={0.7} max={1.7} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setTextStyle(slide.id, fields, { leading: round(v) }, "leading")} />
      <Range
        label="Espaço entre letras"
        value={tracking}
        min={-0.05}
        max={0.2}
        step={0.005}
        format={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}`}
        onChange={(v) => setTextStyle(slide.id, fields, { tracking: Math.round(v * 1000) / 1000 }, "tracking")}
      />
      <div className="-mx-3.5 my-0.5 h-px shrink-0 bg-white/[0.08]" />
      <Range label="Espaço entre os blocos" value={gap} min={0} max={2.5} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => updateSlide(slide.id, { gap: round(v) }, "gap")} />
      <Actions
        onReset={() => {
          setTextStyle(slide.id, fields, { size: null, leading: null, tracking: null });
          updateSlide(slide.id, { gap: null });
        }}
        onAll={() => {
          setTextStyleAll(fields, { size, leading, tracking });
          setDesign({ gap });
          updateAllSlides({ gap: null });
          toast.success("Espaçamento aplicado em todos os slides");
        }}
      />
    </Panel>
  );
}

function AlignPicker({ slide }: { slide: Slide }) {
  const design = useEditor((s) => s.project!.design);
  const setTextStyle = useEditor((s) => s.setTextStyle);
  const setTextStyleAll = useEditor((s) => s.setTextStyleAll);
  const updateSlide = useEditor((s) => s.updateSlide);
  const updateAllSlides = useEditor((s) => s.updateAllSlides);
  const [scope, setScope] = useScope();
  const fields = fieldsOf(scope);
  const values = fields.map((f) => valueOf(slide, design, f, "align") ?? design.align);
  const value = values.every((v) => v === values[0]) ? values[0] : null;
  const icon = ALIGNS.find((a) => a.value === (valueOf(slide, design, "title", "align") ?? design.align))?.icon ?? ALIGNS[0].icon;
  return (
    <Panel
      label="Alinhamento"
      trigger={
        <T.Button className={iconOnly} aria-label="Alinhamento e posição do texto">
          {icon}
        </T.Button>
      }
    >
      <Heading>Alinhamento</Heading>
      <Segmented label="Alinhar" size="sm" className="w-full" value={scope} onChange={setScope} options={SCOPES} />
      <div role="radiogroup" aria-label="Alinhamento" className="grid grid-cols-4 gap-1.5">
        {ALIGNS.map((a) => (
          <Tip key={a.value} label={a.label}>
            <button
              role="radio"
              aria-checked={value === a.value}
              aria-label={a.label}
              onClick={() => setTextStyle(slide.id, fields, { align: a.value })}
              className={cn(
                "grid h-10 place-items-center rounded-[10px] border transition-colors [&_svg]:size-[18px]",
                value === a.value ? "selected text-ink" : "border-white/[0.08] text-ink-2 hover:border-white/[0.16] hover:text-ink",
              )}
            >
              {a.icon}
            </button>
          </Tip>
        ))}
      </div>
      <Heading>Posição no slide</Heading>
      <Segmented
        label="Posição do texto"
        size="sm"
        className="w-full"
        value={slide.valign ?? "auto"}
        onChange={(v) => updateSlide(slide.id, { valign: v === "auto" ? null : v })}
        options={[
          { value: "auto", label: "Auto" },
          { value: "top", label: "Topo" },
          { value: "center", label: "Centro" },
          { value: "bottom", label: "Base" },
        ]}
      />
      <Actions
        onAll={() => {
          if (value) setTextStyleAll(fields, { align: value });
          updateAllSlides({ valign: slide.valign });
          toast.success("Alinhamento aplicado em todos os slides");
        }}
      />
    </Panel>
  );
}

/** Título e texto são opcionais: apaga o campo tocado (dá para desfazer com ⌘Z). */
function DeleteField({ slide }: { slide: Slide }) {
  const modKey = useModKey();
  const target = useEditing((s) => s.target);
  const updateSlide = useEditor((s) => s.updateSlide);
  if (!target || !slide[target]) return null;
  const what = target === "title" ? "o título" : "o texto";
  return (
    <Tip label={`Apagar ${what} deste slide`}>
      <T.Button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur();
          updateSlide(slide.id, { [target]: "" });
          toast(`Apaguei ${what}. ${modKey}Z desfaz.`);
        }}
        className={cn(iconOnly, "hover:text-red-300")}
        aria-label={`Apagar ${what} deste slide`}
      >
        <Icon icon={Delete02Icon} />
      </T.Button>
    </Tip>
  );
}

function ImagePicker({ slide }: { slide: Slide }) {
  const modKey = useModKey();
  const project = useEditor((s) => s.project)!;
  const updateSlide = useEditor((s) => s.updateSlide);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { uploads, original } = imageLibrary(project);
  const image = slide.image;
  const patchImage = (p: Partial<SlideImage>, key?: string) => image && updateSlide(slide.id, { image: { ...image, ...p } }, key);
  const isFoto = project.design.template === "foto";

  const upload = async (files: File[]) => {
    setBusy(true);
    const urls = await uploadImages(files);
    setBusy(false);
    if (urls[0]) placeImage(slide.id, urls[0]);
  };

  return (
    <Panel
      label="Imagem do slide"
      width={312}
      trigger={
        <T.Button className={itemClass} aria-label="Imagem do slide">
          <Icon icon={ImageAdd02Icon} />
          <span className="hidden @min-[1000px]:inline">Imagem</span>
        </T.Button>
      }
    >
      {image ? (
        <>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt="" className="size-14 rounded-[10px] border border-white/10 object-cover" />
            <div className="flex flex-1 flex-wrap gap-1.5">
              <button onClick={() => fileRef.current?.click()} className="control flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px]">
                <Icon icon={Upload04Icon} className="size-4" />
                Trocar
              </button>
              <button
                onClick={() => updateSlide(slide.id, { image: null })}
                className="flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink"
              >
                <Icon icon={Delete02Icon} className="size-4" />
                Remover
              </button>
            </div>
          </div>
          {!isFoto && (
            <Segmented
              label="Onde fica a imagem"
              size="sm"
              className="w-full"
              value={image.mode}
              onChange={(mode) => patchImage({ mode })}
              options={[
                { value: "inline", label: "Junto do texto" },
                { value: "background", label: "No fundo" },
              ]}
            />
          )}
          <Segmented
            label="Enquadramento"
            size="sm"
            className="w-full"
            value={image.fit}
            onChange={(fit) => patchImage({ fit })}
            options={[
              { value: "cover", label: "Preencher" },
              { value: "contain", label: "Inteira" },
            ]}
          />
          <Range label="Zoom" value={image.zoom} min={1} max={4} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(zoom) => patchImage({ zoom }, "image")} />
        </>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex h-20 shrink-0 flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-white/[0.18] text-[13px] text-ink-2 transition-colors hover:border-white/35 hover:text-ink disabled:opacity-60"
        >
          <Icon icon={Upload04Icon} className="size-5" />
          {busy ? "Enviando…" : "Enviar do computador"}
        </button>
      )}
      {(uploads.length > 0 || original.length > 0) && (
        <div className="flex flex-col gap-2">
          <Heading>Clique para usar neste slide</Heading>
          <div className="grid max-h-[188px] grid-cols-4 gap-1.5 overflow-y-auto">
            {[...uploads, ...original].map((src, i) => (
              <button
                key={src}
                onClick={() => placeImage(slide.id, src)}
                aria-label={`Usar a imagem ${i + 1}`}
                className={cn("overflow-hidden rounded-[8px] border transition-transform hover:scale-[1.04]", image?.src === src ? "border-white/80" : "border-white/10")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-[12px] leading-relaxed text-ink-3">Também dá para colar ({modKey}V) ou arrastar uma imagem para o card.</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void upload(files);
        }}
      />
    </Panel>
  );
}

function BackgroundPicker({ slide }: { slide: Slide }) {
  const design = useEditor((s) => s.project!.design);
  const updateSlide = useEditor((s) => s.updateSlide);
  const updateAllSlides = useEditor((s) => s.updateAllSlides);
  const setDesign = useEditor((s) => s.setDesign);
  const current = slide.background ?? design.background;
  return (
    <Panel
      label="Fundo do slide"
      trigger={
        <T.Button className={itemClass} aria-label="Fundo do slide">
          <span className="relative">
            <Icon icon={PaintBucketIcon} />
            {current && <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full shadow-[0_0_0_1.5px_#1a1a1a]" style={{ background: current }} />}
          </span>
          <span className="hidden @min-[1000px]:inline">Fundo</span>
        </T.Button>
      }
    >
      <Heading>Fundo deste slide</Heading>
      <Swatches value={slide.background} onChange={(background) => updateSlide(slide.id, { background })} colors={BACKGROUNDS} allowDefault label="Fundo do slide" />
      <Actions
        onAll={() => {
          setDesign({ background: slide.background });
          updateAllSlides({ background: null });
          toast.success("Fundo aplicado em todos os slides");
        }}
      />
    </Panel>
  );
}

/** Foto, nome e @ que aparecem nos slides; abre também clicando no perfil dentro do card. */
function ProfilePicker() {
  const open = useEditing((s) => s.identityOpen);
  const setOpen = useEditing((s) => s.setIdentityOpen);
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const openSettings = useApp((s) => s.openSettings);
  const showProfile = useEditor((s) => s.project!.design.showProfile);
  const setDesign = useEditor((s) => s.setDesign);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!profile) return null;
  const update = (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => api.saveProfile(next).catch(() => toast.error("Não consegui salvar o perfil.")), 500);
  };
  const upload = async (file: File) => {
    try {
      update({ avatar: (await api.upload("profile", file)).url });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  const initial = (profile.name || profile.handle || "?").charAt(0).toUpperCase();

  return (
    <Panel
      label="Foto e nome nos slides"
      width={300}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <T.Button className={iconOnly} aria-label="Foto e nome nos slides">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar} alt="" className="size-[22px] rounded-full object-cover ring-1 ring-white/20" />
          ) : (
            <Icon icon={UserCircleIcon} />
          )}
        </T.Button>
      }
    >
      <Heading>Foto e nome nos slides</Heading>
      <div className="flex items-center gap-3">
        <button onClick={() => fileRef.current?.click()} className="group relative size-14 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.05]" aria-label="Trocar a foto">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-[18px] font-semibold text-ink-2">{initial}</span>
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
            <Icon icon={Camera01Icon} className="size-5" />
          </span>
        </button>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => fileRef.current?.click()} className="control flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px]">
            <Icon icon={Upload04Icon} className="size-4" />
            {profile.avatar ? "Trocar foto" : "Enviar foto"}
          </button>
          {profile.avatar && (
            <button onClick={() => update({ avatar: null })} className="h-8 rounded-[10px] px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink">
              Remover
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      <div>
        <Label htmlFor="quick-name">Nome</Label>
        <Input id="quick-name" value={profile.name} onChange={(e) => update({ name: e.target.value })} placeholder="Seu nome" className="h-9" />
      </div>
      <div>
        <Label htmlFor="quick-handle">@ no Instagram</Label>
        <div className="field flex h-9 items-center pl-3">
          <span className="text-[14px] text-ink-3">@</span>
          <input
            id="quick-handle"
            value={profile.handle}
            onChange={(e) => update({ handle: e.target.value.replace(/^@+/, "").replace(/\s/g, "") })}
            placeholder="seuperfil"
            className="h-full min-w-0 flex-1 bg-transparent px-1 text-[14px] outline-none placeholder:text-ink-3"
          />
        </div>
      </div>
      <div className="-my-1 flex flex-col">
        <Toggle label="Selo de verificado" checked={profile.verified} onChange={(verified) => update({ verified })} />
        <Toggle label="Mostrar foto e @ nos slides" checked={showProfile} onChange={(value) => setDesign({ showProfile: value })} />
      </div>
      <button
        onClick={() => {
          setOpen(false);
          openSettings("perfil");
        }}
        className="h-8 rounded-[10px] text-[12.5px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink"
      >
        Mais ajustes do perfil e da sua voz
      </button>
    </Panel>
  );
}

/** Reescrever com o ChatGPT só o que está em foco: título, texto ou o slide inteiro. */
function Rewrite({ index }: { index: number }) {
  const running = useAgent((s) => s.running);
  return (
    <RewritePopover
      index={index}
      trigger={
        <T.Button className={cn(itemClass, "text-ink")} aria-label="Reescrever com o ChatGPT" disabled={running}>
          <Icon icon={AiMagicIcon} />
          <span className="hidden @min-[860px]:inline">Reescrever</span>
        </T.Button>
      }
    />
  );
}

export function RewritePopover({
  index,
  trigger,
  preset,
  align = "end",
}: {
  index: number;
  trigger: ReactNode;
  preset?: "title" | "body" | "slide";
  align?: "start" | "center" | "end";
}) {
  const running = useAgent((s) => s.running);
  const { edit } = useAgentActions();
  const target = useEditing((s) => s.target);
  const [picked, setPicked] = useState<"title" | "body" | "slide" | null>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const scope = picked ?? preset ?? target ?? "slide";

  const send = (request: string) => {
    if (!request.trim() || running) return;
    const what = scope === "title" ? "Mude só o título deste slide" : scope === "body" ? "Mude só o texto (não o título) deste slide" : "Mude este slide";
    setOpen(false);
    setText("");
    setPicked(null);
    void edit(`${what}: ${request.trim()}`, index);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align={align}
          sideOffset={10}
          collisionPadding={12}
          aria-label="Reescrever com o ChatGPT"
          className="arrasta-pop glass z-50 flex w-[320px] flex-col gap-3 rounded-[16px] p-3.5 text-ink"
        >
          <Heading>Reescrever com o ChatGPT · slide {index + 1}</Heading>
          <Segmented
            label="O que reescrever"
            size="sm"
            className="w-full"
            value={scope}
            onChange={setPicked}
            options={[
              { value: "title", label: "Título" },
              { value: "body", label: "Texto" },
              { value: "slide", label: "Slide todo" },
            ]}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="field flex items-end gap-1.5 p-1.5"
          >
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              rows={2}
              placeholder="Diga o que mudar…"
              aria-label="Como reescrever"
              className="min-h-[52px] flex-1 resize-none bg-transparent px-1.5 py-1 text-[13.5px] leading-snug outline-none placeholder:text-ink-3"
            />
            <button type="submit" disabled={!text.trim() || running} className="keycap grid size-8 shrink-0 place-items-center rounded-[10px] disabled:opacity-35" aria-label="Reescrever">
              <Icon icon={AiMagicIcon} className="size-4" />
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {REWRITES.map((r) => (
              <button
                key={r}
                onClick={() => send(r)}
                disabled={running}
                className="h-7 rounded-full bg-white/[0.06] px-2.5 text-[12.5px] text-ink-2 transition-colors hover:bg-white/[0.1] hover:text-ink disabled:opacity-40"
              >
                {r}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
