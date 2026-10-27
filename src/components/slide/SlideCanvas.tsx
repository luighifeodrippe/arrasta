"use client";

import { createElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fontVar, fontWeight, SERIF_FONTS, SLIDE_W, slideHeight } from "@/lib/defaults";
import type { Design, FontId, Slide, SlideImage, SlideSize, TextAlign, TextStyle } from "@/lib/types";
import { EditableText, ImageLayer, Movable, MovementProvider, type EditBinding } from "./editing";
import { joinItems, listItems, rich } from "./rich-text";
import { joinNumberedTitle, joinPromptBody, parsePromptBody, splitNumberedTitle, type PromptBody } from "@/lib/prompt-block";

export interface SlideIdentity {
  name: string;
  handle: string;
  avatar: string | null;
  verified: boolean;
}

interface Palette {
  bg: string;
  fg: string;
  muted: string;
  line: string;
  dark: boolean;
}

const PALETTES: Record<Design["template"], { light: Palette; dark: Palette }> = {
  perfil: {
    light: { bg: "#ffffff", fg: "#0f1419", muted: "#536471", line: "rgb(15 20 25 / 0.1)", dark: false },
    dark: { bg: "#000000", fg: "#e7e9ea", muted: "#71767b", line: "rgb(255 255 255 / 0.14)", dark: true },
  },
  editorial: {
    light: { bg: "#f3efe7", fg: "#141414", muted: "#5b5750", line: "rgb(0 0 0 / 0.12)", dark: false },
    dark: { bg: "#0b0b0b", fg: "#f5f5f5", muted: "#a3a3a3", line: "rgb(255 255 255 / 0.14)", dark: true },
  },
  foto: {
    light: { bg: "#111111", fg: "#ffffff", muted: "rgb(255 255 255 / 0.82)", line: "rgb(255 255 255 / 0.2)", dark: true },
    dark: { bg: "#000000", fg: "#ffffff", muted: "rgb(255 255 255 / 0.82)", line: "rgb(255 255 255 / 0.2)", dark: true },
  },
  minimal: {
    light: { bg: "#f4f4f2", fg: "#111111", muted: "#6b6b6b", line: "rgb(0 0 0 / 0.1)", dark: false },
    dark: { bg: "#111111", fg: "#f5f5f5", muted: "#9a9a9a", line: "rgb(255 255 255 / 0.12)", dark: true },
  },
  neon: {
    light: { bg: "#151519", fg: "#f5f5f5", muted: "rgb(255 255 255 / 0.62)", line: "rgb(255 255 255 / 0.14)", dark: true },
    dark: { bg: "#050505", fg: "#f5f5f5", muted: "rgb(255 255 255 / 0.6)", line: "rgb(255 255 255 / 0.12)", dark: true },
  },
  notas: {
    light: { bg: "#fbfaf5", fg: "#1c1c1e", muted: "#6e6e73", line: "rgb(0 0 0 / 0.08)", dark: false },
    dark: { bg: "#1c1c1e", fg: "#f2f2f7", muted: "#98989d", line: "rgb(255 255 255 / 0.1)", dark: true },
  },
  revista: {
    light: { bg: "#f2ede4", fg: "#16130f", muted: "#5e574d", line: "rgb(22 19 15 / 0.2)", dark: false },
    dark: { bg: "#121110", fg: "#f2ede4", muted: "#a39b8f", line: "rgb(242 237 228 / 0.18)", dark: true },
  },
  poster: {
    light: { bg: "#eeeae0", fg: "#181818", muted: "#555149", line: "rgb(24 24 24 / 0.2)", dark: false },
    dark: { bg: "#181818", fg: "#eeeae0", muted: "#bbb6aa", line: "rgb(238 234 224 / 0.25)", dark: true },
  },
  caderno: {
    light: { bg: "#fffdf4", fg: "#253249", muted: "#657086", line: "rgb(67 104 152 / 0.16)", dark: false },
    dark: { bg: "#172131", fg: "#eef1e8", muted: "#abb7ca", line: "rgb(149 173 211 / 0.18)", dark: true },
  },
};

/** "#ff3500" + 0.4 → "rgb(255 53 0 / 0.4)". */
function alpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`;
}

/** Cada modelo destaca do seu jeito: cor, brilho de neon, marca-texto ou itálico. */
function emphasisFor(design: Design, colors: Palette): CSSProperties {
  const accent = accentOn(design.accent, colors);
  if (design.template === "neon") return { color: design.accent, textShadow: `0 0 18px ${alpha(design.accent, 0.75)}, 0 0 52px ${alpha(design.accent, 0.45)}` };
  if (design.template === "notas") {
    const mark = alpha(design.accent, colors.dark ? 0.5 : 0.42);
    return {
      backgroundImage: `linear-gradient(transparent 58%, ${mark} 58%, ${mark} 94%, transparent 94%)`,
      WebkitBoxDecorationBreak: "clone",
      boxDecorationBreak: "clone",
    };
  }
  if (design.template === "revista") return { color: accent, fontStyle: "italic" };
  return { color: accent };
}

/** Texto claro sobre foto, para slides com imagem de fundo. */
const OVER_PHOTO: Palette = { bg: "#000000", fg: "#ffffff", muted: "rgb(255 255 255 / 0.84)", line: "rgb(255 255 255 / 0.22)", dark: true };

function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function palette(design: Design, slide: Slide): Palette {
  const base = PALETTES[design.template][design.theme];
  const custom = slide.background ?? design.background;
  if (!custom || design.template === "foto") return base;
  const lum = luminance(custom);
  if (lum === null) return { ...base, bg: custom };
  const dark = lum < 0.4;
  const ref = PALETTES[design.template][dark ? "dark" : "light"];
  return { ...ref, bg: custom, muted: dark ? "rgb(255 255 255 / 0.72)" : "rgb(0 0 0 / 0.6)" };
}

/** Diminui o texto até caber no slide, sem cortar nada. */
function useAutoFit(deps: unknown[]) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [fontsTick, setFontsTick] = useState(0);

  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;
    const root = box.closest<HTMLElement>("[data-slide-root]");
    if (!root) return;
    const bounds = getComputedStyle(box);
    const height = box.clientHeight - parseFloat(bounds.paddingTop) - parseFloat(bounds.paddingBottom);
    const width = box.clientWidth - parseFloat(bounds.paddingLeft) - parseFloat(bounds.paddingRight);
    let value = 1;
    root.dataset.measuringBlocks = "";
    root.style.setProperty("--fit", "1");
    const overflows = () => content.scrollHeight > height + 2 || content.scrollWidth > width + 2;
    while (overflows() && value > 0.5) {
      value = Math.round((value - 0.04) * 100) / 100;
      root.style.setProperty("--fit", String(value));
    }
    delete root.dataset.measuringBlocks;
    setFit(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, fontsTick]);

  return { boxRef, contentRef, fit };
}

const fs = (px: number) => `calc(${px}px * var(--s) * var(--fit))`;
/** Título e texto têm tamanho, entrelinha e espaço entre letras ajustáveis (variáveis no slide). */
const ft = (px: number) => `calc(${px}px * var(--s) * var(--fit) * var(--ts))`;
const tl = (value: number) => `calc(${value} * var(--tl))`;
const tt = (value: string) => `calc(${value} + var(--tt))`;
const fb = (px: number) => `calc(${px}px * var(--s) * var(--fit) * var(--bs))`;
const bl = (value: number) => `calc(${value} * var(--bl))`;
/** Espaço entre os blocos do slide. */
const g = (px: number) => `calc(${px}px * var(--gap))`;

export function SlideCanvas({
  slide,
  index,
  total,
  design,
  identity,
  edit,
}: {
  slide: Slide;
  index: number;
  total: number;
  design: Design;
  identity: SlideIdentity;
  /** Só o card selecionado no palco recebe: texto e imagem viram editáveis. */
  edit?: EditBinding;
}) {
  const backdrop = slide.image && (design.template === "foto" || slide.image.mode === "background") ? slide.image : null;
  const colors = backdrop && design.template !== "foto" ? OVER_PHOTO : palette(design, slide);
  const { boxRef, contentRef, fit } = useAutoFit([
    slide.title,
    slide.body,
    slide.kind,
    slide.valign,
    slide.titleStyle,
    slide.bodyStyle,
    slide.gap,
    slide.image?.src,
    slide.image?.fit,
    slide.image?.mode,
    design.template,
    design.font,
    design.textScale,
    design.showProfile,
    design.align,
    design.showCounter,
    design.showSwipe,
    design.size,
    design.titleStyle,
    design.bodyStyle,
    design.titleFont,
    design.bodyFont,
    design.gap,
    Boolean(edit),
  ]);

  const title = resolve("title", slide, design);
  const body = resolve("body", slide, design);
  const style = {
    "--ts": title.size,
    "--tl": title.leading,
    "--tt": `${title.tracking}em`,
    "--bs": body.size,
    "--bl": body.leading,
    "--bt": `${body.tracking}em`,
    "--gap": slide.gap ?? design.gap ?? 1,
    width: SLIDE_W,
    height: slideHeight(design.size),
    position: "relative",
    overflow: "hidden",
    background: colors.bg,
    color: colors.fg,
    fontFamily: fontVar(design.font),
    "--s": design.textScale,
    "--fit": fit,
    "--accent": design.accent,
  } as CSSProperties;

  const ctx: TemplateProps = {
    titleStyle: fieldCss(title),
    bodyStyle: fieldCss(body),
    align: title.align,
    flex: title.align === "center" ? "center" : title.align === "right" ? "flex-end" : "flex-start",
    slide,
    index,
    total,
    design,
    identity,
    colors,
    boxRef,
    contentRef,
    weight: fontWeight(title.font),
    serif: SERIF_FONTS.includes(title.font),
    emphasis: emphasisFor(design, colors),
    edit,
    inlineImage: backdrop ? null : slide.image,
    backdrop: Boolean(backdrop),
  };

  return (
    <MovementProvider><div data-slide-root data-free-blocks={edit || Object.keys(slide.offsets ?? {}).length ? "" : undefined} style={style}>
      {backdrop && design.template !== "foto" && (
        <>
          <ImageLayer image={backdrop} edit={edit} style={{ position: "absolute", inset: 0 }} />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: "linear-gradient(to top, rgb(0 0 0 / 0.86) 0%, rgb(0 0 0 / 0.55) 45%, rgb(0 0 0 / 0.3) 100%)",
            }}
          />
        </>
      )}
      {design.template === "perfil" && <PerfilTemplate {...ctx} />}
      {design.template === "editorial" && <EditorialTemplate {...ctx} />}
      {design.template === "foto" && <FotoTemplate {...ctx} />}
      {design.template === "minimal" && <MinimalTemplate {...ctx} />}
      {design.template === "neon" && <NeonTemplate {...ctx} />}
      {design.template === "notas" && <NotasTemplate {...ctx} />}
      {design.template === "revista" && <RevistaTemplate {...ctx} />}
      {design.template === "poster" && <PosterTemplate {...ctx} />}
      {design.template === "caderno" && <CadernoTemplate {...ctx} />}
    </div></MovementProvider>
  );
}

/** Um destaque branco em fundo branco some: nesse caso o destaque usa a cor do texto. */
function accentOn(accent: string, colors: Palette): string {
  const a = luminance(accent);
  const b = luminance(colors.bg);
  if (a === null || b === null) return accent;
  const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return contrast < 1.6 ? colors.fg : accent;
}

interface Resolved {
  align: TextAlign;
  color: string | null;
  size: number;
  leading: number;
  tracking: number;
  font: FontId;
}

/** O ajuste do slide vale primeiro; depois o do carrossel; depois o do modelo. */
function resolve(field: "title" | "body", slide: Slide, design: Design): Resolved {
  const own: TextStyle = field === "title" ? slide.titleStyle : slide.bodyStyle;
  const base: TextStyle = field === "title" ? design.titleStyle : design.bodyStyle;
  return {
    align: own.align ?? base.align ?? design.align,
    color: own.color ?? base.color,
    size: own.size ?? base.size ?? 1,
    leading: own.leading ?? base.leading ?? 1,
    tracking: own.tracking ?? base.tracking ?? 0,
    font: (field === "title" ? design.titleFont : design.bodyFont) ?? design.font,
  };
}

/** Alinhamento, cor e fonte de um campo, por cima do estilo do modelo. */
function fieldCss(r: Resolved): CSSProperties {
  return { textAlign: r.align, fontFamily: fontVar(r.font), ...(r.color ? { color: r.color } : {}) };
}

interface TemplateProps {
  /** Estilo de cada campo (alinhamento e cor do slide ou do design), aplicado por cima do modelo. */
  titleStyle: CSSProperties;
  bodyStyle: CSSProperties;
  /** Alinhamento do título, que guia o resto do layout (foto, @, traços). */
  align: TextAlign;
  flex: "flex-start" | "center" | "flex-end";
  slide: Slide;
  index: number;
  total: number;
  design: Design;
  identity: SlideIdentity;
  colors: Palette;
  boxRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  weight: number;
  emphasis: CSSProperties;
  edit?: EditBinding;
  /** A fonte do título é serifada (muda espaçamento e itálico em alguns modelos). */
  serif: boolean;
  /** Imagem junto do texto (no modo fundo ela já está atrás de tudo). */
  inlineImage: SlideImage | null;
  backdrop: boolean;
}

/** Posição vertical do texto: a escolhida no slide ou a padrão do modelo. */
function justify(slide: Slide, fallback: CSSProperties["justifyContent"]): CSSProperties["justifyContent"] {
  if (slide.valign === "top") return "flex-start";
  if (slide.valign === "center") return "center";
  if (slide.valign === "bottom") return "flex-end";
  return fallback;
}

/** As camadas do modelo deixam o clique passar; só texto e imagem respondem. */
const LAYER: CSSProperties = { pointerEvents: "none" };
const INTERACTIVE: CSSProperties = { pointerEvents: "auto" };

function Field({
  ctx,
  field,
  as = "p",
  style,
  placeholder,
  value = ctx.slide[field],
  onChange,
  movable = true,
}: {
  ctx: TemplateProps;
  field: "title" | "body";
  as?: "p" | "h2";
  style: CSSProperties;
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  movable?: boolean;
}) {
  const { edit } = ctx;
  const own = field === "title" ? ctx.titleStyle : ctx.bodyStyle;
  const piece = !edit ? (value ? createElement(as, { style: { margin: 0, ...style, ...own } }, rich(value, ctx.emphasis)) : null) : (
    <EditableText
      as={as}
      field={field}
      label={field === "title" ? "Título do slide" : "Texto do slide"}
      ghost={field === "title" ? "+ Título" : "+ Texto"}
      value={value}
      style={{ margin: 0, ...INTERACTIVE, ...style, ...own }}
      emphasis={ctx.emphasis}
      placeholder={placeholder}
      edit={edit}
      onChange={onChange ?? ((next) => edit.setText(field, next))}
    />
  );
  return movable && piece ? <Movable slide={ctx.slide} edit={edit} block={field}>{piece}</Movable> : piece;
}

/** Foto, nome e @ do card: no slide escolhido, um clique abre o editor de perfil. */
function Identity({ ctx, as = "div", style, children }: { ctx: TemplateProps; as?: "div" | "span"; style?: CSSProperties; children: ReactNode }) {
  const open = ctx.edit?.editIdentity;
  const piece = !open ? createElement(as, { style }, children) : createElement(
    as,
    {
      role: "button",
      tabIndex: 0,
      "aria-label": "Editar foto e nome",
      className: "arrasta-identity",
      style: { ...style, ...INTERACTIVE, cursor: "pointer" },
      onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
      onClick: (event: React.MouseEvent) => {
        event.stopPropagation();
        open();
      },
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      },
    },
    children,
  );
  return <Movable slide={ctx.slide} edit={ctx.edit} block="identity">{piece}</Movable>;
}

function Avatar({ identity, size, ring }: { identity: SlideIdentity; size: number; ring?: string }) {
  const initial = (identity.name || identity.handle || "?").trim().charAt(0).toUpperCase();
  return identity.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={identity.avatar}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, #3a3a3a, #1c1c1c)",
        color: "#fff",
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
    >
      {initial}
    </div>
  );
}

/** Selo de verificado desenhado aqui (círculos sobrepostos formam a roseta). */
function VerifiedBadge({ size }: { size: number }) {
  const petals = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    return { cx: 12 + Math.cos(angle) * 5.4, cy: 12 + Math.sin(angle) * 5.4 };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Verificado" style={{ flexShrink: 0 }}>
      <g fill="#1d9bf0">
        <circle cx="12" cy="12" r="8.2" />
        {petals.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r="4.6" />
        ))}
      </g>
      <path d="M7.6 12.3l3 3 5.9-6.4" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Counter({ index, total, color, size = 30 }: { index: number; total: number; color: string; size?: number }) {
  return (
    <span style={{ fontFamily: "var(--font-inter)", fontSize: size, fontWeight: 500, color, letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums" }}>
      {index + 1}/{total}
    </span>
  );
}

function SwipeHint({ color, size = 30 }: { color: string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14, fontFamily: "var(--font-inter)", fontSize: size, fontWeight: 600, color }}>
      Arrasta pro lado
      <svg width={size * 1.3} height={size * 1.3} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

function InlineImage({ ctx, radius, style }: { ctx: TemplateProps; radius: number; style?: CSSProperties }) {
  const image = ctx.inlineImage;
  if (!image) return null;
  return (
    <Movable slide={ctx.slide} edit={ctx.edit} block="image"><ImageLayer
      image={image}
      edit={ctx.edit}
      style={{ borderRadius: radius, border: `1px solid ${ctx.colors.line}`, background: "rgb(127 127 127 / 0.12)", ...INTERACTIVE, ...style }}
    /></Movable>
  );
}

/** Marcador dos itens de lista: bolinha cheia, contorno de neon, caixa de checklist ou numeral de revista. */
type Marker = "filled" | "outline" | "check" | "numeral";

function ItemMarker({ kind, label, size, accent }: { kind: Marker; label: string; size: number; accent: string }) {
  const box = `calc(${size * 1.3}px * var(--s) * var(--fit) * var(--bs))`;
  const base: CSSProperties = {
    flexShrink: 0,
    marginTop: `calc(${size * 0.04}px * var(--s) * var(--fit) * var(--bs))`,
    fontFamily: "var(--font-inter)",
    fontWeight: 700,
    fontSize: fb(size * 0.62),
  };
  if (kind === "check") {
    const d = `calc(${size * 0.92}px * var(--s) * var(--fit) * var(--bs))`;
    return <span aria-hidden style={{ ...base, width: d, height: d, marginTop: `calc(${size * 0.24}px * var(--s) * var(--fit) * var(--bs))`, borderRadius: 999, border: `4px solid ${accent}` }} />;
  }
  if (kind === "numeral") {
    return (
      <span style={{ ...base, minWidth: box, fontFamily: "var(--font-dmserif)", fontWeight: 400, fontSize: fb(size * 1.15), lineHeight: 1.05, color: accent }}>
        {label}.
      </span>
    );
  }
  if (kind === "outline") {
    return (
      <span
        style={{ ...base, minWidth: box, height: box, borderRadius: 999, display: "grid", placeItems: "center", border: `4px solid ${accent}`, color: accent, boxShadow: `0 0 16px ${alpha(accent, 0.6)}, inset 0 0 12px ${alpha(accent, 0.35)}` }}
      >
        {label}
      </span>
    );
  }
  return (
    <span style={{ ...base, minWidth: box, height: box, borderRadius: 999, display: "grid", placeItems: "center", background: accent, color: (luminance(accent) ?? 0) > 0.5 ? "#111" : "#fff" }}>
      {label}
    </span>
  );
}

function Body({
  ctx,
  size,
  color,
  lineHeight = 1.42,
  marker = "filled",
  radius,
}: {
  ctx: TemplateProps;
  size: number;
  color: string;
  lineHeight?: number;
  marker?: Marker;
  radius: number;
}) {
  const { slide, edit, emphasis, design, bodyStyle } = ctx;
  // Mantém os mesmos campos durante a edição, inclusive ao esvaziar prompt ou tail.
  const livePrompt = useRef<{ body: string; parts: PromptBody; hasTail: boolean } | null>(null);
  if (!edit || livePrompt.current?.body !== slide.body) {
    const parts = parsePromptBody(slide.body);
    livePrompt.current = parts ? { body: slide.body, parts, hasTail: Boolean(parts.tail) } : null;
  }
  const items = listItems(slide.body);
  if (items) {
    const accent = design.accent;
    const update = (next: typeof items) => edit?.setText("body", joinItems(next));
    return (
      <Movable slide={slide} edit={edit} block="body"><div style={{ display: "flex", flexDirection: "column", gap: `calc(${size * 0.62}px * var(--s) * var(--fit) * var(--gap))` }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 26, textAlign: "left" }}>
            <ItemMarker kind={marker} label={item.marker ?? String(i + 1)} size={size} accent={accent} />
            {edit ? (
              <EditableText
                as="span"
                field={`item:${i}`}
                label={`Item ${i + 1} da lista`}
                value={item.text}
                style={{ fontSize: fb(size), lineHeight: bl(lineHeight), letterSpacing: "var(--bt)", color, flex: 1, ...INTERACTIVE, ...bodyStyle }}
                emphasis={emphasis}
                placeholder="Novo item"
                edit={edit}
                onChange={(text) => update(items.map((it, j) => (j === i ? { ...it, text } : it)))}
                onEnter={() => {
                  const next = [...items];
                  next.splice(i + 1, 0, { prefix: item.prefix, marker: item.marker, text: "" });
                  update(next);
                  edit.requestFocus(`item:${i + 1}`);
                }}
                onBackspaceEmpty={() => {
                  if (items.length <= 2) return;
                  update(items.filter((_, j) => j !== i));
                  edit.requestFocus(`item:${Math.max(0, i - 1)}`);
                }}
              />
            ) : (
              <span style={{ fontSize: fb(size), lineHeight: bl(lineHeight), letterSpacing: "var(--bt)", color, flex: 1, ...bodyStyle }}>{rich(item.text, emphasis)}</span>
            )}
          </div>
        ))}
      </div></Movable>
    );
  }
  const parsed = livePrompt.current;
  if (parsed) {
    const { parts } = parsed;
    const { colors } = ctx;
    const accent = accentOn(design.accent, colors);
    const mark: CSSProperties = { color: accent, fontWeight: 500 };
    // O texto em volta do prompt fica um tom abaixo do branco (#c8c8c8 no preto, como nos carrosséis do autor).
    const soft = /^#?[0-9a-f]{6}$/i.test(colors.fg.trim()) ? alpha(colors.fg, colors.dark ? 0.85 : 0.78) : colors.muted;
    const proseStyle: CSSProperties = { margin: 0, fontSize: fb(size * 0.78), lineHeight: bl(1.4), color: soft, letterSpacing: "var(--bt)", whiteSpace: "pre-line", ...bodyStyle };
    const update = (field: "lead" | "prompt" | "tail", value: string) => {
      const next = field === "prompt" ? { ...parts, prompt: { ...parts.prompt, text: value } } : { ...parts, [field]: value };
      const body = joinPromptBody(next);
      livePrompt.current = { body, parts: next, hasTail: parsed.hasTail };
      edit?.setText("body", body);
    };
    const prose = (field: "lead" | "tail") => edit ? (
      <EditableText
        key={field}
        field={field}
        label={field === "lead" ? "Texto antes do prompt" : "Texto depois do prompt"}
        ghost="+ Texto"
        value={parts[field]}
        style={{ ...proseStyle, ...INTERACTIVE }}
        emphasis={emphasis}
        placeholder="Adicionar texto"
        edit={edit}
        onChange={(value) => update(field, value)}
      />
    ) : parts[field] ? <p key={field} style={proseStyle}>{rich(parts[field], emphasis)}</p> : null;
    return (
      <Movable slide={slide} edit={edit} block="body"><div style={{ display: "flex", flexDirection: "column", gap: g(44), width: "100%" }}>
        {prose("lead")}
        <div style={{ width: "100%", boxSizing: "border-box", borderRadius: radius, border: `2px solid ${colors.line}`, background: /^#?[0-9a-f]{6}$/i.test(colors.fg.trim()) ? alpha(colors.fg, colors.dark ? 0.06 : 0.045) : "rgb(127 127 127 / 0.1)", padding: "38px 40px 42px", display: "flex", flexDirection: "column", gap: 22, textAlign: "left" }}>
          <span style={{ textTransform: "uppercase", fontFamily: "var(--font-inter)", fontWeight: 700, fontSize: fb(size * 0.46), letterSpacing: "0.16em", lineHeight: 1, color: accent }}>Prompt</span>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: fb(size * 0.74), lineHeight: bl(1.42), color: colors.fg, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
            “{edit ? (
              <EditableText
                as="span"
                field="prompt"
                label="Prompt do slide"
                value={parts.prompt.text}
                style={{ ...INTERACTIVE }}
                emphasis={emphasis}
                mark={mark}
                placeholder="Escreva o prompt"
                edit={edit}
                onChange={(value) => update("prompt", value)}
              />
            ) : rich(parts.prompt.text, emphasis, mark)}”
          </div>
        </div>
        {(parts.tail || (edit && parsed.hasTail)) ? prose("tail") : null}
      </div></Movable>
    );
  }
  return (
    <Field
      ctx={ctx}
      field="body"
      placeholder="Adicionar texto"
      style={{ fontSize: fb(size), lineHeight: bl(lineHeight), letterSpacing: "var(--bt)", color, whiteSpace: "pre-line" }}
    />
  );
}

function PerfilTemplate(ctx: TemplateProps) {
  const { slide, index, total, design, identity, colors, boxRef, contentRef, inlineImage } = ctx;
  const isCover = slide.kind === "cover";
  const titleSize = isCover ? 66 : slide.kind === "quote" ? 62 : 56;
  const hint = design.showSwipe && isCover && index < total - 1;
  const liveTitle = useRef<{ title: string; parts: NonNullable<ReturnType<typeof splitNumberedTitle>> } | null>(null);
  if (!ctx.edit || liveTitle.current?.title !== slide.title) {
    const parts = splitNumberedTitle(slide.title);
    liveTitle.current = parts ? { title: slide.title, parts } : null;
  }
  const numbered = liveTitle.current?.parts;
  const coverInset = (slideHeight(design.size) - 1080) / 2;
  return (
    <div style={{ position: "absolute", inset: 0, padding: isCover ? `${coverInset}px 64px` : "104px 64px 92px", display: "flex", flexDirection: "column", ...LAYER }}>
      {design.showCounter && (
        <div style={{ position: "absolute", top: 52, right: 64 }}>
          <Counter index={index} total={total} color={colors.muted} />
        </div>
      )}
      <div
        ref={boxRef} data-block-container=""
        style={{
          flex: 1,
          minHeight: 0, overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: justify(slide, inlineImage ? "flex-start" : "center"),
        }}
      >
        <div ref={contentRef} style={{ display: "flex", flexDirection: "column", gap: g(44), height: inlineImage ? "100%" : undefined }}>
          {design.showProfile && (
            <Identity ctx={ctx} style={{ display: "flex", alignItems: "center", gap: 26, alignSelf: "flex-start" }}>
              <Avatar identity={identity} size={118} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, fontFamily: "var(--font-inter)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 42, fontWeight: 700, color: colors.fg, whiteSpace: "nowrap" }}>{identity.name || "Seu nome"}</span>
                  {identity.verified && <VerifiedBadge size={42} />}
                </div>
                <span style={{ fontSize: 36, color: colors.muted }}>@{identity.handle || "seuperfil"}</span>
              </div>
            </Identity>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: g(22), textAlign: ctx.align }}>
            {(slide.title || ctx.edit) && <Movable slide={slide} edit={ctx.edit} block="title"><div style={{ display: "flex", flexDirection: "column", gap: g(22) }}>
              {numbered && <span style={{ fontFamily: "var(--font-inter)", fontWeight: 700, fontSize: ft(30), letterSpacing: "0.08em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: accentOn(design.accent, colors) }}>{numbered.number.padStart(2, "0")}</span>}
              <Field
                ctx={ctx}
                movable={false}
                field="title"
                value={numbered?.rest ?? slide.title}
                onChange={numbered ? (value) => {
                  const title = joinNumberedTitle(numbered, value);
                  liveTitle.current = { title, parts: { ...numbered, rest: value } };
                  ctx.edit?.setText("title", title);
                } : undefined}
                placeholder="Escreva o título"
                style={{ fontSize: ft(titleSize), fontWeight: 700, lineHeight: tl(1.24), letterSpacing: tt("-0.012em"), whiteSpace: "pre-line" }}
              />
            </div></Movable>}
            <Body ctx={ctx} size={46} color={colors.fg} radius={30} />
          </div>
          <InlineImage ctx={ctx} radius={30} style={{ flex: "1 1 auto", minHeight: 320 }} />
        </div>
      </div>
      {hint && (
        <div style={{ position: "absolute", right: 64, bottom: 64 }}>
          <SwipeHint color={colors.muted} />
        </div>
      )}
    </div>
  );
}

function EditorialTemplate(ctx: TemplateProps) {
  const { slide, index, total, design, identity, colors, boxRef, contentRef, weight, emphasis, inlineImage } = ctx;
  const isCover = slide.kind === "cover";
  const isQuote = slide.kind === "quote";
  const isCta = slide.kind === "cta";
  const titleSize = isCover ? 116 : isQuote ? 78 : slide.kind === "list" ? 74 : 86;
  const serif = ctx.serif;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "76px 88px 80px", display: "flex", flexDirection: "column", ...LAYER }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, fontFamily: "var(--font-inter)" }}>
        {design.showProfile ? (
          <Identity ctx={ctx} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar identity={identity} size={52} />
            <span style={{ fontSize: 30, fontWeight: 600, color: colors.fg }}>@{identity.handle || "seuperfil"}</span>
            {identity.verified && <VerifiedBadge size={30} />}
          </Identity>
        ) : (
          <span />
        )}
        {design.showCounter && <Counter index={index} total={total} color={colors.muted} />}
      </div>
      <div
        ref={boxRef} data-block-container=""
        style={{
          flex: 1,
          minHeight: 0, overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: justify(slide, isCover ? "flex-end" : "center"),
          paddingTop: 40,
          paddingBottom: 24,
        }}
      >
        <div ref={contentRef} style={{ display: "flex", flexDirection: "column", gap: g(38), textAlign: ctx.align, height: inlineImage ? "100%" : undefined }}>
          {isQuote && (
            <span style={{ fontFamily: "var(--font-dmserif)", fontSize: 240, lineHeight: 0.6, height: 120, color: emphasis.color, display: "block" }}>“</span>
          )}
          <Field
            ctx={ctx}
            field="title"
            as="h2"
            placeholder="Escreva o título"
            style={{
              fontSize: ft(titleSize),
              fontWeight: weight,
              lineHeight: tl(serif ? 1.04 : 1.02),
              letterSpacing: tt(serif ? "-0.01em" : "-0.03em"),
              fontStyle: isQuote && serif ? "italic" : "normal",
              whiteSpace: "pre-line",
              textWrap: "balance",
            }}
          />
          <Body ctx={ctx} size={isCover ? 44 : 42} color={colors.muted} radius={26} />
          <InlineImage ctx={ctx} radius={26} style={{ flex: "1 1 auto", minHeight: 300 }} />
          {isCta && design.showProfile && (
            <Identity ctx={ctx} style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 12, fontFamily: "var(--font-inter)", justifyContent: ctx.flex }}>
              <Avatar identity={identity} size={96} ring={emphasis.color as string} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 36, fontWeight: 700 }}>
                  {identity.name || "Seu nome"}
                  {identity.verified && <VerifiedBadge size={34} />}
                </span>
                <span style={{ fontSize: 30, color: colors.muted }}>@{identity.handle || "seuperfil"}</span>
              </div>
            </Identity>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 28, height: 40 }}>
        <div style={{ flex: 1, display: "flex", gap: 8 }}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} style={{ flex: 1, height: 6, borderRadius: 6, background: i === index ? (emphasis.color as string) : colors.line }} />
          ))}
        </div>
        {design.showSwipe && isCover && index < total - 1 && <SwipeHint color={colors.fg} size={28} />}
      </div>
    </div>
  );
}

function FotoTemplate(ctx: TemplateProps) {
  const { slide, index, total, design, identity, colors, boxRef, contentRef, weight, edit } = ctx;
  const isCover = slide.kind === "cover";
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {slide.image ? (
        <ImageLayer image={slide.image} edit={edit} style={{ position: "absolute", inset: 0 }} />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(120% 80% at 80% 0%, ${design.accent} 0%, transparent 60%), radial-gradient(90% 70% at 0% 100%, ${design.accent}55 0%, transparent 60%), #0b0b0b`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "linear-gradient(to top, rgb(0 0 0 / 0.9) 0%, rgb(0 0 0 / 0.62) 38%, rgb(0 0 0 / 0.08) 68%, rgb(0 0 0 / 0.28) 100%)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, padding: "76px 88px 84px", display: "flex", flexDirection: "column", ...LAYER }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, fontFamily: "var(--font-inter)" }}>
          {design.showProfile ? (
            <Identity ctx={ctx} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Avatar identity={identity} size={60} />
              <span style={{ fontSize: 30, fontWeight: 600, color: "#fff" }}>@{identity.handle || "seuperfil"}</span>
              {identity.verified && <VerifiedBadge size={30} />}
            </Identity>
          ) : (
            <span />
          )}
          {design.showCounter && <Counter index={index} total={total} color="rgb(255 255 255 / 0.85)" />}
        </div>
        <div ref={boxRef} data-block-container="" style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: justify(slide, "flex-end") }}>
          <div ref={contentRef} style={{ display: "flex", flexDirection: "column", gap: g(30), textAlign: ctx.align }}>
            <Field
              ctx={ctx}
              field="title"
              as="h2"
              placeholder="Escreva o título"
              style={{
                fontSize: ft(isCover ? 104 : 84),
                fontWeight: weight,
                lineHeight: tl(1.04),
                letterSpacing: tt("-0.025em"),
                color: "#fff",
                whiteSpace: "pre-line",
                textWrap: "balance",
                textShadow: "0 2px 24px rgb(0 0 0 / 0.35)",
              }}
            />
            <Body ctx={ctx} size={42} color={colors.muted} radius={24} />
          </div>
        </div>
        {design.showSwipe && isCover && index < total - 1 && (
          <div style={{ marginTop: 44, display: "flex", justifyContent: ctx.flex }}>
            <SwipeHint color="#fff" size={28} />
          </div>
        )}
      </div>
    </div>
  );
}

function MinimalTemplate(ctx: TemplateProps) {
  const { slide, index, total, design, identity, colors, boxRef, contentRef, weight, inlineImage } = ctx;
  const isCover = slide.kind === "cover";
  const serif = ctx.serif;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "92px 100px", display: "flex", flexDirection: "column", alignItems: "stretch", ...LAYER }}>
      <div style={{ height: 40, display: "flex", justifyContent: "center" }}>
        {design.showCounter && <Counter index={index} total={total} color={colors.muted} size={28} />}
      </div>
      <div ref={boxRef} data-block-container="" style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: justify(slide, "center") }}>
        <div ref={contentRef} style={{ display: "flex", flexDirection: "column", gap: g(40), textAlign: ctx.align, height: inlineImage ? "100%" : undefined }}>
          <Field
            ctx={ctx}
            field="title"
            as="h2"
            placeholder="Escreva o título"
            style={{
              fontSize: ft(isCover ? 98 : 80),
              fontWeight: weight,
              lineHeight: tl(1.06),
              letterSpacing: tt(serif ? "-0.01em" : "-0.025em"),
              whiteSpace: "pre-line",
              textWrap: "balance",
            }}
          />
          <Body ctx={ctx} size={42} color={colors.muted} radius={24} />
          <InlineImage ctx={ctx} radius={24} style={{ flex: "1 1 auto", minHeight: 300 }} />
        </div>
      </div>
      <div style={{ height: 48, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 24, fontFamily: "var(--font-inter)" }}>
        {design.showProfile && (
          <Identity ctx={ctx} as="span" style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 28, fontWeight: 600, color: colors.muted }}>
            @{identity.handle || "seuperfil"}
            {identity.verified && <VerifiedBadge size={28} />}
          </Identity>
        )}
        {design.showSwipe && isCover && index < total - 1 && <SwipeHint color={colors.muted} size={26} />}
      </div>
    </div>
  );
}

function NeonTemplate(ctx: TemplateProps) {
  const { slide, index, total, design, identity, colors, boxRef, contentRef, weight, inlineImage, backdrop } = ctx;
  const isCover = slide.kind === "cover";
  const isQuote = slide.kind === "quote";
  const glow = `0 0 16px ${alpha(design.accent, 0.9)}, 0 0 44px ${alpha(design.accent, 0.55)}`;

  return (
    <div style={{ position: "absolute", inset: 0, ...LAYER }}>
      {!backdrop && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(75% 50% at 90% -6%, ${alpha(design.accent, 0.24)}, transparent 70%), radial-gradient(60% 40% at -4% 106%, ${alpha(design.accent, 0.12)}, transparent 70%)`,
          }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, padding: "80px 88px 84px", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 52,
            fontFamily: "var(--font-inter)",
            fontSize: 25,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: colors.muted,
          }}
        >
          {design.showProfile ? (
            <Identity ctx={ctx} as="span" style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <Avatar identity={identity} size={48} ring={design.accent} />@{identity.handle || "seuperfil"}
              {identity.verified && <VerifiedBadge size={28} />}
            </Identity>
          ) : (
            <span />
          )}
          {design.showCounter && (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          )}
        </div>
        <div
          ref={boxRef} data-block-container=""
          style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: justify(slide, isCover ? "flex-end" : "center"), paddingTop: 36, paddingBottom: 24 }}
        >
          <div
            ref={contentRef}
            style={{ display: "flex", flexDirection: "column", gap: 36, textAlign: ctx.align, alignItems: ctx.flex, height: inlineImage ? "100%" : undefined }}
          >
            {isQuote ? (
              <span style={{ fontFamily: "var(--font-dmserif)", fontSize: 220, lineHeight: 0.6, height: 110, color: design.accent, textShadow: glow }}>“</span>
            ) : (
              <span aria-hidden style={{ display: "block", width: isCover ? 150 : 100, height: 8, borderRadius: 8, background: design.accent, boxShadow: glow }} />
            )}
            <Field
              ctx={ctx}
              field="title"
              as="h2"
              placeholder="Escreva o título"
              style={{
                fontSize: ft(isCover ? 112 : isQuote ? 76 : 84),
                fontWeight: weight,
                lineHeight: tl(1.02),
                letterSpacing: tt("-0.03em"),
                whiteSpace: "pre-line",
                textWrap: "balance",
                color: colors.fg,
              }}
            />
            <Body ctx={ctx} size={42} color={colors.muted} marker="outline" radius={24} />
            <InlineImage
              ctx={ctx}
              radius={24}
              style={{ flex: "1 1 auto", minHeight: 300, width: "100%", boxShadow: `0 0 0 2px ${alpha(design.accent, 0.55)}, 0 0 44px ${alpha(design.accent, 0.25)}` }}
            />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, height: 40 }}>
          <div style={{ display: "flex", gap: 14, flex: 1, flexWrap: "wrap" }}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} style={{ width: 14, height: 14, borderRadius: 14, background: i === index ? design.accent : colors.line, boxShadow: i === index ? glow : undefined }} />
            ))}
          </div>
          {design.showSwipe && isCover && index < total - 1 && <SwipeHint color={colors.fg} size={28} />}
        </div>
      </div>
    </div>
  );
}

const NOTES_DATE = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });

function NotasTemplate(ctx: TemplateProps) {
  const { slide, index, total, design, identity, colors, boxRef, contentRef, inlineImage } = ctx;
  const isCover = slide.kind === "cover";
  const tint = design.accent;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "66px 84px 78px", display: "flex", flexDirection: "column", ...LAYER }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, fontFamily: "var(--font-inter)", color: tint }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 36, fontWeight: 500 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Notas
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 36 }} aria-hidden>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          </svg>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9.5" />
            <circle cx="7.8" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="16.2" cy="12" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </span>
      </div>
      <p style={{ margin: "24px 0 0", textAlign: "center", fontFamily: "var(--font-inter)", fontSize: 25, color: colors.muted }}>{NOTES_DATE.format(new Date())}</p>
      <div ref={boxRef} data-block-container="" style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: justify(slide, "flex-start"), paddingTop: 44 }}>
        <div ref={contentRef} style={{ display: "flex", flexDirection: "column", gap: g(30), textAlign: ctx.align, height: inlineImage ? "100%" : undefined }}>
          <Field
            ctx={ctx}
            field="title"
            placeholder="Escreva o título"
            style={{ fontSize: ft(isCover ? 88 : 70), fontWeight: 700, lineHeight: tl(1.14), letterSpacing: tt("-0.015em"), whiteSpace: "pre-line" }}
          />
          <Body ctx={ctx} size={44} color={colors.fg} marker="check" lineHeight={1.45} radius={22} />
          <InlineImage ctx={ctx} radius={22} style={{ flex: "1 1 auto", minHeight: 300 }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 44, fontFamily: "var(--font-inter)", fontSize: 26, color: colors.muted }}>
        {design.showProfile ? (
          <Identity ctx={ctx} as="span" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            @{identity.handle || "seuperfil"}
            {identity.verified && <VerifiedBadge size={26} />}
          </Identity>
        ) : (
          <span />
        )}
        {design.showSwipe && isCover && index < total - 1 ? (
          <SwipeHint color={tint} size={26} />
        ) : design.showCounter ? (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {index + 1}/{total}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RevistaTemplate(ctx: TemplateProps) {
  const { slide, index, total, design, identity, colors, boxRef, contentRef, weight, inlineImage } = ctx;
  const isCover = slide.kind === "cover";
  const serif = ctx.serif;
  const numeralFont = serif ? fontVar(design.titleFont ?? design.font) : "var(--font-dmserif)";
  const small: CSSProperties = { fontFamily: "var(--font-inter)", fontSize: 23, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: colors.muted };
  return (
    <div style={{ position: "absolute", inset: 0, padding: "72px 88px 78px", display: "flex", flexDirection: "column", ...LAYER }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
        <span style={{ fontFamily: numeralFont, fontSize: isCover && !inlineImage ? 210 : 150, lineHeight: 0.78, color: design.accent }}>{String(index + 1).padStart(2, "0")}</span>
        <span style={{ ...small, textAlign: "right", lineHeight: 1.7, paddingTop: 8 }}>
          {design.showProfile && (
            <Identity ctx={ctx} as="span" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              @{identity.handle || "seuperfil"}
              {identity.verified && <VerifiedBadge size={26} />}
            </Identity>
          )}
          {design.showProfile && design.showCounter && <br />}
          {design.showCounter && (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {index + 1} de {total}
            </span>
          )}
        </span>
      </div>
      <div ref={boxRef} data-block-container="" style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: justify(slide, isCover ? "flex-end" : "center"), paddingTop: 30, paddingBottom: 20 }}>
        <div ref={contentRef} style={{ display: "flex", flexDirection: "column", gap: g(34), textAlign: ctx.align, height: inlineImage ? "100%" : undefined }}>
          <Field
            ctx={ctx}
            field="title"
            as="h2"
            placeholder="Escreva o título"
            style={{
              fontSize: ft(isCover ? 108 : 80),
              fontWeight: serif ? 400 : weight,
              lineHeight: tl(1.04),
              letterSpacing: tt(serif ? "-0.01em" : "-0.03em"),
              fontStyle: slide.kind === "quote" ? "italic" : "normal",
              whiteSpace: "pre-line",
              textWrap: "balance",
            }}
          />
          <span aria-hidden style={{ display: "block", width: 180, height: 3, background: colors.fg, alignSelf: ctx.flex }} />
          <Body ctx={ctx} size={40} color={colors.muted} lineHeight={1.5} marker="numeral" radius={6} />
          <InlineImage ctx={ctx} radius={6} style={{ flex: "1 1 auto", minHeight: 220 }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 40 }}>
        {design.showProfile && identity.name ? <Identity ctx={ctx} as="span" style={small}>{`Por ${identity.name}`}</Identity> : <span style={small} />}
        {design.showSwipe && isCover && index < total - 1 && <SwipeHint color={colors.fg} size={26} />}
      </div>
    </div>
  );
}

function PosterTemplate(ctx: TemplateProps) {
  const { slide, index, total, design, identity, colors, boxRef, contentRef, inlineImage, weight } = ctx;
  const isCover = slide.kind === "cover";
  return (
    <div style={{ position: "absolute", inset: 48, border: `3px solid ${colors.fg}`, display: "flex", flexDirection: "column", ...LAYER }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, minHeight: 112, padding: "22px 36px", borderBottom: `3px solid ${colors.fg}`, fontFamily: "var(--font-inter)" }}>
        {design.showProfile ? (
          <Identity ctx={ctx} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 700 }}>
            <Avatar identity={identity} size={56} />
            @{identity.handle || "seuperfil"}
            {identity.verified && <VerifiedBadge size={28} />}
          </Identity>
        ) : <span />}
        {design.showCounter && <Counter index={index} total={total} color={colors.fg} size={28} />}
      </div>
      <div ref={boxRef} data-block-container="" style={{ flex: 1, minHeight: 0, overflow: "hidden", margin: "44px 40px", display: "flex", flexDirection: "column", justifyContent: justify(slide, "center") }}>
        <div ref={contentRef} style={{ display: "flex", flexDirection: "column", gap: g(38), height: inlineImage ? "100%" : undefined }}>
          <Field ctx={ctx} field="title" as="h2" placeholder="Escreva o título" style={{ fontSize: ft(isCover ? 122 : 90), fontWeight: weight, lineHeight: tl(0.98), letterSpacing: tt("-0.04em"), textTransform: "uppercase", whiteSpace: "pre-line", textWrap: "balance" }} />
          <span aria-hidden style={{ width: 92, height: 12, background: design.accent, alignSelf: ctx.flex }} />
          <Body ctx={ctx} size={42} color={colors.fg} lineHeight={1.38} radius={0} />
          <InlineImage ctx={ctx} radius={0} style={{ flex: "1 1 auto", minHeight: 250 }} />
        </div>
      </div>
      {design.showSwipe && isCover && index < total - 1 && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "25px 36px", borderTop: `3px solid ${colors.fg}` }}>
          <SwipeHint color={colors.fg} size={28} />
        </div>
      )}
    </div>
  );
}

function CadernoTemplate(ctx: TemplateProps) {
  const { slide, index, total, design, identity, colors, boxRef, contentRef, inlineImage, weight, backdrop } = ctx;
  const isCover = slide.kind === "cover";
  return (
    <div style={{ position: "absolute", inset: 0, padding: "70px 76px 74px 130px", display: "flex", flexDirection: "column", ...LAYER }}>
      {!backdrop && <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 62px, ${colors.line} 62px, ${colors.line} 64px)`, backgroundPosition: "0 18px" }} />}
      <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: 96, width: 2, background: alpha(design.accent, 0.4) }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", height: 64, fontFamily: "var(--font-inter)" }}>
        {design.showProfile ? (
          <Identity ctx={ctx} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 600 }}>
            <Avatar identity={identity} size={56} />
            @{identity.handle || "seuperfil"}
            {identity.verified && <VerifiedBadge size={28} />}
          </Identity>
        ) : <span />}
        {design.showCounter && <Counter index={index} total={total} color={colors.muted} size={28} />}
      </div>
      <div ref={boxRef} data-block-container="" style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", paddingTop: 62, paddingBottom: 36, display: "flex", flexDirection: "column", justifyContent: justify(slide, "flex-start") }}>
        <div ref={contentRef} style={{ display: "flex", flexDirection: "column", gap: g(40), height: inlineImage ? "100%" : undefined }}>
          <Field ctx={ctx} field="title" as="h2" placeholder="Escreva o título" style={{ fontSize: ft(isCover ? 94 : 76), fontWeight: weight, lineHeight: tl(1.12), letterSpacing: tt("-0.025em"), whiteSpace: "pre-line" }} />
          <Body ctx={ctx} size={44} color={colors.fg} lineHeight={1.45} marker="check" radius={6} />
          <InlineImage ctx={ctx} radius={6} style={{ flex: "1 1 auto", minHeight: 260, boxShadow: "0 8px 18px rgb(0 0 0 / 0.08)" }} />
        </div>
      </div>
      {design.showSwipe && isCover && index < total - 1 && <div style={{ position: "relative", display: "flex", justifyContent: "flex-end", paddingTop: 12 }}><SwipeHint color={colors.fg} size={28} /></div>}
    </div>
  );
}

/** Mostra o slide (1080 de largura, altura conforme a proporção) reduzido para caber na largura pedida, ou na do contêiner. */
export function SlideFrame({
  width,
  size,
  className,
  style,
  children,
}: {
  width?: number;
  size?: SlideSize;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(width ?? null);
  const height = slideHeight(size);

  useLayoutEffect(() => {
    if (width !== undefined) {
      setMeasured(width);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const update = () => setMeasured(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  const w = measured ?? 0;
  const scale = w / SLIDE_W;
  return (
    <div
      ref={ref}
      className={className}
      style={{ position: "relative", overflow: "hidden", width: width ?? "100%", aspectRatio: `${SLIDE_W} / ${height}`, ...style }}
    >
      {w > 0 && (
        <div style={{ position: "absolute", top: 0, left: 0, width: SLIDE_W, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      )}
    </div>
  );
}
