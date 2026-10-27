"use client";

import { cloneElement, createContext, createElement, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Move01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "../ui/icon";
import { snapOffset, snapTargets, clampOffset, type Point, type Rect } from "@/lib/snap";
import type { BlockId, Slide, SlideImage } from "@/lib/types";

/**
 * Ligação entre o slide desenhado e o editor. Só o card selecionado no palco recebe uma;
 * miniaturas, prévia e exportação desenham o slide sem ela.
 */
export interface EditBinding {
  moveBlock: (block: BlockId, offset: Point | null) => void;
  setText: (field: "title" | "body", value: string) => void;
  setImage: (patch: Partial<SlideImage>) => void;
  /** Escala do card na tela, para converter o arrasto do mouse em pixels do slide. */
  scale: number;
  /** Campo que deve receber o foco assim que aparecer (ex.: item novo da lista). */
  pendingFocus: string | null;
  requestFocus: (field: string | null) => void;
  /** O campo em edição avisa o palco e entrega o comando de destacar para a barra de ferramentas. */
  onEditing: (field: string | null, toggleEmphasis: (() => void) | null) => void;
  /** Clique na foto ou no @ do card abre o editor de perfil. */
  editIdentity: () => void;
}

interface MovableRoot {
  ref: (el: HTMLElement | null) => void;
  style: CSSProperties;
  className: string;
  "data-block": BlockId;
}

type LiveMove = { block: BlockId; offset: Point } | null;
const Movement = createContext<{ live: LiveMove; setLive: (value: LiveMove) => void } | null>(null);

/** Compartilha o movimento quando o mesmo modelo repete a identidade. Não cria caixa de layout. */
export function MovementProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<LiveMove>(null);
  return <Movement.Provider value={{ live, setLive }}>{children}</Movement.Provider>;
}

/** A própria raiz da peça mantém seu papel no flex; controles ficam fora dela e do contentEditable. */
export function Movable({ slide, edit, block, children }: {
  slide: Slide;
  edit?: EditBinding;
  block: BlockId;
  children: ReactElement<{ style?: CSSProperties; className?: string; moveProps?: MovableRoot }>;
}) {
  const movement = useContext(Movement);
  const node = useRef<HTMLElement | null>(null);
  const [overlay, setOverlay] = useState<{ root: HTMLElement; rect: Rect } | null>(null);
  const drag = useRef<{ pointer: number; button: HTMLButtonElement; base: Rect; start: Point; mouse: Point; targets: ReturnType<typeof snapTargets>; height: number; scale: number; moved: boolean } | null>(null);
  const measureRef = useRef<(() => void) | null>(null);
  const layout = useRef<{ x: number; y: number; gap: Slide["gap"]; valign: Slide["valign"] } | null>(null);
  const [lines, setLines] = useState<{ x: number | null; y: number | null } | null>(null);
  const offset = movement?.live?.block === block ? movement.live.offset : slide.offsets?.[block] ?? { x: 0, y: 0 };
  const liveOffset = useRef(offset);
  liveOffset.current = offset;

  // Inclui mudanças de fonte, autofit, zoom e tamanho das peças anteriores no flex.
  useLayoutEffect(() => {
    if (!edit || !node.current) { if (overlay) setOverlay(null); return; }
    const el = node.current;
    const root = el.closest<HTMLElement>("[data-slide-root]");
    if (!root) return;
    const before = el.getBoundingClientRect(), cardBefore = root.getBoundingClientRect();
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const base = { x: (before.left - cardBefore.left) / edit.scale - matrix.m41, y: (before.top - cardBefore.top) / edit.scale - matrix.m42 };
    const previous = layout.current;
    if (previous && !drag.current && slide.gap == null && slide.valign == null && (previous.gap !== slide.gap || previous.valign !== slide.valign)) {
      // Organizar também muda o flex (gap/valign): compensa essa mudança antes de voltar.
      el.style.transition = "none";
      el.style.transform = `translate(${matrix.m41 + previous.x - base.x}px, ${matrix.m42 + previous.y - base.y}px)`;
      el.getBoundingClientRect();
      el.style.transition = "";
      el.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    }
    layout.current = { ...base, gap: slide.gap, valign: slide.valign };
    const measure = () => {
      const r = el.getBoundingClientRect(), card = root.getBoundingClientRect();
      const rect = { x: (r.left - card.left) / edit.scale, y: (r.top - card.top) / edit.scale, width: r.width / edit.scale, height: r.height / edit.scale };
      setOverlay((old) => old?.root === root && Object.keys(rect).every((k) => Math.abs(rect[k as keyof Rect] - old.rect[k as keyof Rect]) < 0.01) ? old : { root, rect });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measureRef.current = measure;
    return () => observer.disconnect();
  });

  useEffect(() => {
    if (!edit || drag.current) return;
    let frame = 0;
    const until = performance.now() + 320;
    const track = () => {
      measureRef.current?.();
      if (performance.now() < until) frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    return () => cancelAnimationFrame(frame);
  }, [offset.x, offset.y, edit?.scale, slide.gap, slide.valign]);

  const finish = (save: boolean) => {
    const start = drag.current;
    if (!start) return;
    drag.current = null;
    if (save && start.moved) edit?.moveBlock(block, liveOffset.current);
    movement?.setLive(null);
    setLines(null);
    if (start.button.hasPointerCapture(start.pointer)) start.button.releasePointerCapture(start.pointer);
  };

  useEffect(() => {
    if (!edit) { finish(false); return; }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  });
  useEffect(() => () => {
    if (drag.current) movement?.setLive(null);
  }, []); // O gesto pertence a esta instância, mesmo ao trocar o slide escolhido.

  const baseRect = () => {
    if (!node.current || !overlay || !edit) return null;
    const r = node.current.getBoundingClientRect(), card = overlay.root.getBoundingClientRect();
    const matrix = new DOMMatrixReadOnly(getComputedStyle(node.current).transform);
    return { x: (r.left - card.left) / edit.scale - matrix.m41, y: (r.top - card.top) / edit.scale - matrix.m42, width: r.width / edit.scale, height: r.height / edit.scale };
  };
  const props: MovableRoot = {
    ref: (el) => { node.current = el; },
    "data-block": block,
    className: `${children.props.className ?? ""} arrasta-movable`,
    style: {
      ...children.props.style,
      pointerEvents: edit ? "auto" : children.props.style?.pointerEvents,
      transform: `translate(${offset.x}px, ${offset.y}px)`,
      transition: drag.current ? "none" : undefined,
    },
  };
  const piece = cloneElement(children, typeof children.type === "string" ? props : { moveProps: props });
  const scale = edit?.scale ?? 1;
  const pixel = 1 / scale;
  const rect = overlay?.rect;
  // A alça acompanha a posição final durante a transição; o contorno só aparece em interação.
  const handle = edit && overlay && rect ? createPortal(
    <>
      <div data-move-overlay={block} className="arrasta-move-overlay" style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height, pointerEvents: "none", zIndex: 30, outline: `${pixel}px dashed #ff3500`, outlineOffset: 2 * pixel, opacity: lines ? 1 : undefined }}>
        <button
          type="button"
          data-move-handle={block}
          aria-label={`Mover ${block === "identity" ? "perfil" : block === "title" ? "título" : block === "body" ? "texto" : "imagem"}`}
          title="Arraste para mover · duplo clique volta ao lugar"
          className="arrasta-move-handle"
          style={{ position: "absolute", left: Math.max(-rect.x, Math.min(0, 1080 - rect.x - 26 / scale)), top: Math.max(-rect.y, -28 / scale), width: 26 / scale, height: 26 / scale, borderRadius: 7 / scale, padding: 5 / scale, border: `${pixel}px solid rgb(255 255 255 / 0.25)`, background: "#1c1c1c", color: "white", pointerEvents: "auto", cursor: lines ? "grabbing" : "grab", touchAction: "none", display: "grid", placeItems: "center" }}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); finish(false); edit.moveBlock(block, null); }}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (event.button !== 0 || !event.isPrimary) return;
            event.preventDefault();
            const base = baseRect();
            if (!base) return;
            event.currentTarget.focus();
            const card = overlay.root.getBoundingClientRect();
            const others = Array.from(overlay.root.querySelectorAll<HTMLElement>("[data-block]")).filter((el) => el.dataset.block !== block).map((el) => {
              const r = el.getBoundingClientRect();
              return { x: (r.left - card.left) / scale, y: (r.top - card.top) / scale, width: r.width / scale, height: r.height / scale };
            });
            const matrix = new DOMMatrixReadOnly(getComputedStyle(node.current!).transform);
            const start = { x: matrix.m41, y: matrix.m42 };
            drag.current = { pointer: event.pointerId, button: event.currentTarget, base, start, mouse: { x: event.clientX, y: event.clientY }, targets: snapTargets(overlay.root.offsetHeight, others), height: overlay.root.offsetHeight, scale, moved: false };
            liveOffset.current = start;
            movement?.setLive({ block, offset: start });
            setLines({ x: null, y: null });
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start || event.pointerId !== start.pointer) return;
            event.stopPropagation();
            start.moved ||= event.clientX !== start.mouse.x || event.clientY !== start.mouse.y;
            const desired = { x: start.start.x + (event.clientX - start.mouse.x) / start.scale, y: start.start.y + (event.clientY - start.mouse.y) / start.scale };
            const next = snapOffset(start.base, desired, start.targets, start.scale, 1080, start.height, event.metaKey || event.ctrlKey);
            liveOffset.current = next.offset;
            movement?.setLive({ block, offset: next.offset });
            setLines({ x: next.x, y: next.y });
          }}
          onPointerUp={(event) => { event.stopPropagation(); finish(true); }}
          onPointerCancel={() => finish(false)}
          onLostPointerCapture={() => finish(false)}
          onKeyDown={(event) => {
            const directions: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
            const direction = directions[event.key];
            // Só as setas são da alça; ⌘Z e os outros atalhos seguem para o editor.
            if (!direction || drag.current) return;
            event.stopPropagation();
            event.preventDefault();
            const base = baseRect();
            if (!base) return;
            const step = event.shiftKey ? 10 : 1;
            edit.moveBlock(block, clampOffset(base, { x: offset.x + direction.x * step, y: offset.y + direction.y * step }, 1080, overlay.root.offsetHeight));
          }}
        ><Icon icon={Move01Icon} style={{ width: 16 / scale, height: 16 / scale }} /></button>
      </div>
      {lines && <svg data-snap-guides="" aria-hidden width={1080} height={overlay.root.offsetHeight} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40, color: "#ff3500" }}>
        <g stroke="currentColor" strokeWidth={pixel} opacity={0.16}>
          {[64, 1016].map((x) => <line key={x} x1={x} x2={x} y1={0} y2={overlay.root.offsetHeight} />)}
          {[(overlay.root.offsetHeight - 1080) / 2, (overlay.root.offsetHeight + 1080) / 2].map((y) => <line key={y} x1={0} x2={1080} y1={y} y2={y} />)}
        </g>
        <g stroke="currentColor" strokeWidth={pixel}>
          {lines.x !== null && <line x1={lines.x} x2={lines.x} y1={0} y2={overlay.root.offsetHeight} />}
          {lines.y !== null && <line x1={0} x2={1080} y1={lines.y} y2={lines.y} />}
        </g>
      </svg>}
    </>, overlay.root,
  ) : null;
  return <>{piece}{handle}</>;
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Estilo do destaque (cor, marca-texto, brilho…) como texto CSS. */
export function cssText(style: CSSProperties): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${value}`)
    .join(";");
}

/** "texto **forte**" → HTML editável com o destaque já no estilo do modelo. */
export function toHtml(markup: string, emphasis: CSSProperties, mark?: CSSProperties): string {
  if (mark) {
    const css = cssText(mark).replace(/"/g, "&quot;");
    const emCss = cssText(emphasis).replace(/"/g, "&quot;");
    return markup.split(/(\*\*[^*]+?\*\*|\[[^\]]+\])/g).map((part) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4
        ? `<span data-em="" style="${emCss}">${toHtml(part.slice(2, -2), emphasis, mark)}</span>`
        : part.startsWith("[") && part.endsWith("]")
        ? `<span data-mark="" style="${css}">${toHtml(part, { ...emphasis, ...mark })}</span>`
        : toHtml(part, emphasis),
    ).join("");
  }
  const css = cssText(emphasis).replace(/"/g, "&quot;");
  return markup
    .split(/(\*\*[^*]+?\*\*)/g)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4
        ? `<span data-em="" style="${css}">${escape(part.slice(2, -2))}</span>`
        : escape(part),
    )
    .join("");
}

/** O caminho de volta: o que está no campo editável vira texto com **destaques**. */
export function fromDom(el: HTMLElement): string {
  let out = "";
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) out += child.textContent ?? "";
      else if (child instanceof HTMLElement) {
        if (child.tagName === "BR") out += "\n";
        else if (child.dataset.em !== undefined) {
          const text = child.textContent ?? "";
          if (text.trim()) out += `**${text}**`;
          else out += text;
        } else if (child.tagName === "DIV" || child.tagName === "P") {
          if (out && !out.endsWith("\n")) out += "\n";
          walk(child);
        } else walk(child);
      }
    });
  };
  walk(el);
  // Dois destaques encostados viram um só ("**a****b**" vira "**ab**").
  return out.replace(/\u00a0/g, " ").replace(/\*{4}/g, "").replace(/\n$/, "");
}

function emphasisOf(node: Node | null, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && current.dataset.em !== undefined) return current;
    current = current.parentNode;
  }
  return null;
}

/** Liga ou desliga o destaque do trecho selecionado. */
export function toggleEmphasis(el: HTMLElement, emphasis: CSSProperties) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return;
  const start = emphasisOf(range.startContainer, el);
  if (start && start === emphasisOf(range.endContainer, el)) {
    start.replaceWith(document.createTextNode(start.textContent ?? ""));
    el.normalize();
    return;
  }
  if (range.collapsed) return;
  const text = range.toString();
  range.deleteContents();
  const span = document.createElement("span");
  span.dataset.em = "";
  span.style.cssText = cssText(emphasis);
  span.textContent = text;
  range.insertNode(span);
  el.querySelectorAll("span[data-em]").forEach((s) => {
    if (!s.textContent) s.remove();
  });
  selection.removeAllRanges();
  const after = document.createRange();
  after.selectNodeContents(span);
  selection.addRange(after);
}

function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * Texto editável direto no slide. Enquanto a pessoa digita, o React não reescreve o conteúdo
 * (o cursor não pula); o texto só é redesenhado quando o campo perde o foco.
 */
export function EditableText({
  as = "p",
  value,
  field,
  label,
  style,
  emphasis,
  mark,
  placeholder,
  ghost,
  edit,
  onChange,
  onEnter,
  onBackspaceEmpty,
  moveProps,
}: {
  as?: "p" | "h2" | "span";
  /** Texto curto mostrado no lugar do campo vazio, fora da edição (ex.: "+ Título"). */
  ghost?: string;
  value: string;
  field: string;
  label: string;
  style: CSSProperties;
  emphasis: CSSProperties;
  mark?: CSSProperties;
  placeholder: string;
  edit: EditBinding;
  onChange: (value: string) => void;
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
  moveProps?: MovableRoot;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const focused = useRef(false);
  const emphasisKey = cssText(emphasis);
  const markKey = mark ? cssText(mark) : "";
  const [html, setHtml] = useState(() => toHtml(value, emphasis, mark));

  useEffect(() => {
    if (!focused.current) setHtml(toHtml(value, emphasis, mark));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, emphasisKey, markKey]);

  useEffect(() => {
    if (edit.pendingFocus === field && ref.current) {
      placeCaretAtEnd(ref.current);
      edit.requestFocus(null);
    }
  }, [edit, field]);

  const emit = () => ref.current && onChange(fromDom(ref.current));
  const toggle = () => {
    if (!ref.current) return;
    toggleEmphasis(ref.current, emphasis);
    emit();
  };

  return createElement(as, {
    ...moveProps,
    ref: (el: HTMLElement | null) => { ref.current = el; moveProps?.ref(el); },
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: true,
    role: "textbox",
    "aria-label": label,
    "aria-multiline": !onEnter,
    "data-placeholder": placeholder,
    "data-ghost": ghost,
    "data-editable": "",
    className: `arrasta-editable ${moveProps?.className ?? ""}`,
    style: { ...style, whiteSpace: "pre-wrap", outline: "none", cursor: "text", minWidth: "1ch", ...moveProps?.style },
    dangerouslySetInnerHTML: { __html: html },
    onFocus: () => {
      focused.current = true;
      edit.onEditing(field, toggle);
    },
    onBlur: () => {
      focused.current = false;
      edit.onEditing(null, null);
      if (ref.current) setHtml(toHtml(fromDom(ref.current), emphasis, mark));
    },
    onInput: emit,
    onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
    onClick: (event: React.MouseEvent) => event.stopPropagation(),
    onPaste: (event: React.ClipboardEvent) => {
      event.preventDefault();
      // Imagem colada vai para o slide (o palco cuida disso); texto entra sem formatação.
      const text = event.clipboardData.getData("text/plain");
      if (text) document.execCommand("insertText", false, text);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      event.stopPropagation();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        ref.current?.blur();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (onEnter) onEnter();
        else document.execCommand("insertLineBreak");
        return;
      }
      if (event.key === "Backspace" && onBackspaceEmpty && ref.current && !fromDom(ref.current).trim()) {
        event.preventDefault();
        onBackspaceEmpty();
      }
    },
  });
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Clique na imagem do card selecionado para enquadrar. Sem esse foco, arrastar
 * continua movendo o card; a pinça só ajusta a imagem enquanto ela está focada.
 */
export function ImageLayer({ image, edit, style, moveProps }: { image: SlideImage; edit?: EditBinding; style?: CSSProperties; moveProps?: MovableRoot }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const zoom = image.zoom || 1;
  const live = useRef({ image, edit });
  live.current = { image, edit };

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !edit) return;
    const onWheel = (event: WheelEvent) => {
      if (document.activeElement !== el || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      const current = live.current;
      const next = clamp((current.image.zoom || 1) * (1 - event.deltaY * 0.01), 1, 4);
      current.edit?.setImage({ zoom: Math.round(next * 100) / 100 });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [edit]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!edit || event.button !== 0 || document.activeElement !== event.currentTarget) return;
    event.stopPropagation();
    event.preventDefault();
    const box = boxRef.current;
    if (!box) return;
    const cw = box.clientWidth;
    const ch = box.clientHeight;
    let ox = cw * (zoom - 1);
    let oy = ch * (zoom - 1);
    if (natural && image.fit === "cover") {
      const s = Math.max(cw / natural.w, ch / natural.h);
      ox += (natural.w * s - cw) * zoom;
      oy += (natural.h * s - ch) * zoom;
    }
    drag.current = { x: event.clientX, y: event.clientY, fx: image.focusX, fy: image.focusY, ox: Math.max(ox, 1), oy: Math.max(oy, 1) };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || !edit) return;
    const dx = (event.clientX - start.x) / edit.scale;
    const dy = (event.clientY - start.y) / edit.scale;
    edit.setImage({
      focusX: Math.round(clamp(start.fx - (dx / start.ox) * 100, 0, 100) * 10) / 10,
      focusY: Math.round(clamp(start.fy - (dy / start.oy) * 100, 0, 100) * 10) / 10,
    });
  };

  const stop = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      {...moveProps}
      ref={(el) => { boxRef.current = el; moveProps?.ref(el); }}
      tabIndex={edit ? 0 : undefined}
      role={edit ? "group" : undefined}
      aria-label={edit ? "Imagem do slide: clique para enquadrar, Esc para sair" : undefined}
      data-slide-image=""
      data-image-focused={edit && focused ? "true" : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); stop(); }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onClick={edit ? (event) => { event.stopPropagation(); event.currentTarget.focus(); } : undefined}
      onKeyDown={edit ? (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          event.currentTarget.blur();
        }
      } : undefined}
      className={`${edit ? "group/image" : ""} ${moveProps?.className ?? ""}`}
      style={{ position: "relative", overflow: "hidden", cursor: edit ? (dragging ? "grabbing" : "grab") : undefined, touchAction: edit ? "none" : undefined, ...style, ...moveProps?.style, outline: edit && focused ? "4px solid var(--accent)" : undefined, outlineOffset: -4 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt=""
        draggable={false}
        onLoad={(event) => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: image.fit,
          objectPosition: `${image.focusX}% ${image.focusY}%`,
          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
          transformOrigin: `${image.focusX}% ${image.focusY}%`,
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
      {edit && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[6%] -translate-x-1/2 rounded-full bg-black/70 px-[28px] py-[12px] text-[26px] font-medium text-white opacity-0 backdrop-blur transition-opacity duration-200 group-hover/image:opacity-100"
          style={{ fontFamily: "var(--font-inter)", whiteSpace: "nowrap", opacity: dragging ? 0 : undefined }}
        >
          {focused ? "Arraste para enquadrar · Esc para sair" : "Clique para enquadrar"}
        </span>
      )}
    </div>
  );
}
