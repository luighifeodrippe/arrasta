"use client";

import { createElement, useEffect, useRef, useState, type CSSProperties } from "react";
import type { SlideImage } from "@/lib/types";

/**
 * Ligação entre o slide desenhado e o editor. Só o card selecionado no palco recebe uma;
 * miniaturas, prévia e exportação desenham o slide sem ela.
 */
export interface EditBinding {
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

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Estilo do destaque (cor, marca-texto, brilho…) como texto CSS. */
export function cssText(style: CSSProperties): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${value}`)
    .join(";");
}

/** "texto **forte**" → HTML editável com o destaque já no estilo do modelo. */
export function toHtml(markup: string, emphasis: CSSProperties): string {
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
  placeholder,
  ghost,
  edit,
  onChange,
  onEnter,
  onBackspaceEmpty,
}: {
  as?: "p" | "h2" | "span";
  /** Texto curto mostrado no lugar do campo vazio, fora da edição (ex.: "+ Título"). */
  ghost?: string;
  value: string;
  field: string;
  label: string;
  style: CSSProperties;
  emphasis: CSSProperties;
  placeholder: string;
  edit: EditBinding;
  onChange: (value: string) => void;
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const focused = useRef(false);
  const emphasisKey = cssText(emphasis);
  const [html, setHtml] = useState(() => toHtml(value, emphasis));

  useEffect(() => {
    if (!focused.current) setHtml(toHtml(value, emphasis));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, emphasisKey]);

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
    ref,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: true,
    role: "textbox",
    "aria-label": label,
    "aria-multiline": !onEnter,
    "data-placeholder": placeholder,
    "data-ghost": ghost,
    "data-editable": "",
    className: "arrasta-editable",
    style: { ...style, whiteSpace: "pre-wrap", outline: "none", cursor: "text", minWidth: "1ch" },
    dangerouslySetInnerHTML: { __html: html },
    onFocus: () => {
      focused.current = true;
      edit.onEditing(field, toggle);
    },
    onBlur: () => {
      focused.current = false;
      edit.onEditing(null, null);
      if (ref.current) setHtml(toHtml(fromDom(ref.current), emphasis));
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
export function ImageLayer({ image, edit, style }: { image: SlideImage; edit?: EditBinding; style?: CSSProperties }) {
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
      ref={boxRef}
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
      className={edit ? "group/image" : undefined}
      style={{ position: "relative", overflow: "hidden", cursor: edit ? (dragging ? "grabbing" : "grab") : undefined, touchAction: edit ? "none" : undefined, ...style, outline: edit && focused ? "4px solid var(--accent)" : undefined, outlineOffset: -4 }}
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
