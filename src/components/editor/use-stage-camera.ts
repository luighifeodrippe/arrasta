"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { useEditor } from "@/lib/client/editor-store";
import { anchorRoom, anchoredScroll, clampZoom, intersects, selectionRect, zoomAnchor, type Point, type Rect } from "@/lib/client/stage-math";
import { useStageView, type Layout } from "./stage-view";

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input, textarea, [contenteditable="true"], [role="textbox"]');
const cardElements = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>("[data-stage-card-face]")];

interface Gesture {
  pointerId: number;
  kind: "pan" | "selection";
  start: Point;
  current: Point;
  scroll: Point;
  base: string[];
  moved: boolean;
}

export function useStageCamera(ref: RefObject<HTMLDivElement | null>, width: number, layout: Layout) {
  const zoom = useStageView((s) => s.zoom);
  const fitRequest = useStageView((s) => s.fitRequest);
  const selectedId = useEditor((s) => s.selectedId);
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const spaceRef = useRef(false);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const previousFit = useRef({ fitRequest, layout });
  const anchor = useRef<{ id: string; pointer: Point; fraction: Point } | null>(null);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (gesture.current) suppressClick.current = true;
        gesture.current = null; setMarquee(null); setSelecting(false); setPanning(false);
      }
      if (event.code !== "Space" || event.defaultPrevented || isTyping(event.target) || (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]'))) return;
      event.preventDefault();
      spaceRef.current = true;
      setSpace(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") { spaceRef.current = false; setSpace(false); }
    };
    const blur = () => { spaceRef.current = false; setSpace(false); gesture.current = null; setMarquee(null); setPanning(false); setSelecting(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const current = useStageView.getState();
        const next = clampZoom(current.zoom * Math.exp(-event.deltaY * 0.01));
        if (next === current.zoom) return;
        const pointer = { x: event.clientX, y: event.clientY };
        const cards = cardElements(el);
        const card = cards.reduce<HTMLElement | undefined>((best, item) => {
          const r = item.getBoundingClientRect();
          const distance = Math.hypot(Math.max(r.left - pointer.x, 0, pointer.x - r.right), Math.max(r.top - pointer.y, 0, pointer.y - r.bottom));
          if (!best) return item;
          const b = best.getBoundingClientRect();
          const old = Math.hypot(Math.max(b.left - pointer.x, 0, pointer.x - b.right), Math.max(b.top - pointer.y, 0, pointer.y - b.bottom));
          return distance < old ? item : best;
        }, undefined);
        if (card) anchor.current = { id: card.dataset.stageCardFace!, pointer, fraction: zoomAnchor(pointer, card.getBoundingClientRect()) };
        current.setZoom(next);
      } else if (layout === "row" && el.scrollHeight <= el.clientHeight + 1 && event.deltaY) {
        // Não cancela wheel comum: a rolagem nativa horizontal continua funcionando.
        el.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1);
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [ref, layout]);

  useLayoutEffect(() => {
    const el = ref.current;
    const pending = anchor.current;
    if (!el || !pending) return;
    anchor.current = null;
    const card = cardElements(el).find((node) => node.dataset.stageCardFace === pending.id);
    if (!card) return;
    const scrollToAnchor = () => anchoredScroll({ x: el.scrollLeft, y: el.scrollTop }, pending.pointer, pending.fraction, card.getBoundingClientRect());
    const next = scrollToAnchor();
    // Abre espaço só quando a âncora ultrapassa a borda. Assim o navegador não
    // desloca o ponto sob o cursor ao limitar scrollLeft/scrollTop a zero ou ao fim.
    const strip = el.querySelector<HTMLElement>('[data-tour="stage"]')!;
    const size = strip.getBoundingClientRect();
    const padding = getComputedStyle(el);
    const room = anchorRoom(next, {
      x: size.width + parseFloat(padding.paddingLeft) + parseFloat(padding.paddingRight),
      y: size.height + parseFloat(padding.paddingTop) + parseFloat(padding.paddingBottom),
    }, { x: el.clientWidth, y: el.clientHeight });
    for (const [side, amount] of Object.entries(room)) {
      if (amount) {
        const key = `--camera-${side}`;
        el.style.setProperty(key, `${(parseFloat(el.style.getPropertyValue(key)) || 0) + Math.ceil(amount)}px`);
      }
    }
    const corrected = scrollToAnchor();
    el.scrollLeft = corrected.x;
    el.scrollTop = corrected.y;
  }, [ref, width, zoom]);

  useLayoutEffect(() => {
    const el = ref.current;
    const card = el && cardElements(el).find((node) => node.dataset.stageCardFace === useEditor.getState().selectedId);
    if (!el || !card) return;
    if (previousFit.current.fitRequest !== fitRequest || previousFit.current.layout !== layout) {
      for (const side of ["left", "right", "top", "bottom"]) el.style.removeProperty(`--camera-${side}`);
      previousFit.current = { fitRequest, layout };
    }
    const r = card.getBoundingClientRect();
    const viewport = el.getBoundingClientRect();
    // Reserva a barra de formatação e a barra do ChatGPT.
    el.scrollLeft += r.left + r.width / 2 - (viewport.left + el.clientWidth / 2);
    el.scrollTop += r.top + r.height / 2 - (viewport.top + 64 + (el.clientHeight - 64 - 112) / 2);
  }, [ref, fitRequest, layout, selectedId]);

  const updateMarquee = useCallback((autoScroll = false) => {
    const el = ref.current;
    const active = gesture.current;
    if (!el || active?.kind !== "selection" || !active.moved) return;
    const viewport = el.getBoundingClientRect();
    if (autoScroll) {
      const edge = (value: number, start: number, end: number) => value < start + 36 ? -Math.min(20, (start + 36 - value) * 0.5) : value > end - 36 ? Math.min(20, (value - end + 36) * 0.5) : 0;
      el.scrollLeft += edge(active.current.x, viewport.left, viewport.right);
      el.scrollTop += edge(active.current.y, viewport.top + 64, viewport.bottom - 112);
    }
    const start = { x: active.start.x - viewport.left + active.scroll.x - el.scrollLeft, y: active.start.y - viewport.top + active.scroll.y - el.scrollTop };
    const end = { x: Math.max(0, Math.min(el.clientWidth, active.current.x - viewport.left)), y: Math.max(0, Math.min(el.clientHeight, active.current.y - viewport.top)) };
    const rect = selectionRect(start, end);
    setMarquee(rect);
    const ids = cardElements(el).filter((card) => {
      const r = card.getBoundingClientRect();
      return intersects(rect, { left: r.left - viewport.left, top: r.top - viewport.top, width: r.width, height: r.height });
    }).map((card) => card.dataset.stageCardFace!);
    const next = [...new Set([...active.base, ...ids])];
    const previous = useEditor.getState().selection;
    if (next.join() !== previous.join()) useEditor.getState().setSelection(next);
  }, [ref]);

  useEffect(() => {
    if (!selecting) return;
    let frame = 0;
    const draw = () => { updateMarquee(true); frame = requestAnimationFrame(draw); };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [selecting, updateMarquee]);

  const onPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || gesture.current || (event.button !== 0 && event.button !== 1)) return;
    const pan = spaceRef.current || event.button === 1;
    if (!pan && (event.target as HTMLElement).closest('[data-slide-card], button, input, textarea, a, [role="toolbar"], [contenteditable="true"]')) return;
    const el = ref.current!;
    event.preventDefault();
    event.stopPropagation();
    (document.activeElement as HTMLElement | null)?.blur();
    const state = useEditor.getState();
    gesture.current = { pointerId: event.pointerId, kind: pan ? "pan" : "selection", start: { x: event.clientX, y: event.clientY }, current: { x: event.clientX, y: event.clientY }, scroll: { x: el.scrollLeft, y: el.scrollTop }, base: event.shiftKey ? (state.selection.length ? state.selection : state.selectedId ? [state.selectedId] : []) : [], moved: false };
    suppressClick.current = false;
    el.setPointerCapture(event.pointerId);
    setPanning(pan);
    setSelecting(!pan);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    active.current = { x: event.clientX, y: event.clientY };
    active.moved ||= Math.hypot(event.clientX - active.start.x, event.clientY - active.start.y) >= 4;
    if (active.kind === "pan") {
      const el = ref.current!;
      el.scrollLeft = active.scroll.x - (event.clientX - active.start.x);
      el.scrollTop = active.scroll.y - (event.clientY - active.start.y);
    } else updateMarquee();
  };
  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.kind === "selection" && event.type === "pointerup") {
      active.current = { x: event.clientX, y: event.clientY };
      if (active.moved) updateMarquee();
      else useEditor.getState().clearSelection();
    }
    suppressClick.current = active.moved || active.kind === "pan";
    gesture.current = null;
    setMarquee(null);
    setPanning(false);
    setSelecting(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    marquee,
    cursor: panning ? "grabbing" : space ? "grab" : undefined,
    handlers: {
      onPointerDownCapture,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
      onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
      },
      onAuxClick: (event: React.MouseEvent<HTMLDivElement>) => { if (event.button === 1) event.preventDefault(); },
    },
  };
}
