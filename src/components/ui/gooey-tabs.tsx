"use client";

/*
 * Abas líquidas: as pílulas ficam unidas por "pescoços" que esticam quando a opção ativa (ou a do
 * mouse) se separa das vizinhas. Adaptado do Gooey Navbar da uselayouts (MIT, © 2025 Urvish Mali,
 * https://uselayouts.com/docs/components/gooey-navbar): botões em radiogroup no lugar de links,
 * fonte do app, ícones, e sem animação para quem pediu menos movimento.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

const num = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "0");

type Rect = { x: number; y: number; width: number; height: number };

function pillPath({ x, y, width: w, height: h }: Rect, radius: number) {
  const r = Math.min(radius, w / 2, h / 2);
  return `M${num(x)} ${num(y + r)}A${num(r)} ${num(r)} 0 0 1 ${num(x + r)} ${num(y)}L${num(x + w - r)} ${num(y)}A${num(r)} ${num(r)} 0 0 1 ${num(x + w)} ${num(y + r)}L${num(x + w)} ${num(y + h - r)}A${num(r)} ${num(r)} 0 0 1 ${num(x + w - r)} ${num(y + h)}L${num(x + r)} ${num(y + h)}A${num(r)} ${num(r)} 0 0 1 ${num(x)} ${num(y + h - r)}Z`;
}

/** Ponte líquida entre duas pílulas vizinhas (arcos tangentes), mais fina quanto mais afastadas. */
function bridgePath(e: Rect, t: Rect, cornerRadius: number, neckHeight: number, push: number) {
  if (push <= 0.02) return null;
  const a = e.height;
  const o = e.y + a / 2;
  const s = Math.min(cornerRadius, a / 2, e.width / 2, t.width / 2);
  if (s <= 0) return null;
  const c = e.x + e.width;
  const l = t.x;
  const u = l - c;
  if (u < 0) return null;
  const d = Math.min((neckHeight / 2) * push, a / 2 - 0.5);
  const f = u / 2 + s;
  const p = d - a / 2 + s;
  const m = 2 * (p - s);
  if (Math.abs(m) < 1e-4) return null;
  const h = (s * s - f * f - p * p) / m;
  if (!(h > 0) || s + h < f) return null;
  const g = Math.sqrt(Math.max(0, (s + h) * (s + h) - f * f));
  const mid = (c + l) / 2;
  const v = c - s;
  const y = e.y + s;
  const ee = mid - v;
  const b = e.y + s - g - y;
  const hyp = Math.hypot(ee, b) || 1;
  const te = v + (s * ee) / hyp;
  const S = y + (s * b) / hyp;
  const C = 2 * mid - te;
  return `M${num(te)} ${num(S)}A${num(h)} ${num(h)} 0 0 0 ${num(C)} ${num(S)}L${num(C)} ${num(2 * o - S)}A${num(h)} ${num(h)} 0 0 0 ${num(te)} ${num(2 * o - S)}Z`;
}

let canvas: HTMLCanvasElement | null = null;
function textWidth(text: string, font: string, fallback: number) {
  if (typeof document === "undefined") return fallback;
  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function GooeyTabs<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  fontSize = 14,
  paddingX = 16,
  height = 36,
  iconSize = 16,
  gap = 0,
  push = 14,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  label: string;
  className?: string;
  fontSize?: number;
  paddingX?: number;
  height?: number;
  iconSize?: number;
  gap?: number;
  push?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  // Vazio no servidor e no primeiro render (mesma estimativa dos dois lados); depois mede com a fonte real.
  const [fontFamily, setFontFamily] = useState("");
  const active = Math.max(0, options.findIndex((o) => o.value === value));
  const radius = height / 2.6;

  useEffect(() => {
    setFontFamily(getComputedStyle(document.body).fontFamily);
    document.fonts?.ready.then(() => setFontFamily(getComputedStyle(document.body).fontFamily + " "));
  }, []);

  const base = useMemo(() => {
    let x = 0;
    return options.map((option) => {
      const estimate = option.label.length * fontSize * 0.56;
      const text = fontFamily ? textWidth(option.label, `500 ${fontSize}px ${fontFamily}`, estimate) : estimate;
      const width = Math.ceil(text + paddingX * 2 + (option.icon ? iconSize + 6 : 0));
      const rect = { x, y: 0, width, height };
      x += width + gap;
      return rect;
    });
  }, [options, fontSize, fontFamily, paddingX, height, iconSize, gap]);

  const targets = useMemo(
    () => base.slice(0, -1).map((_, i) => (i === active || i + 1 === active || i === hovered || i + 1 === hovered ? 1 : 0)),
    [base, active, hovered],
  );

  // Mola simples para os afastamentos; quem pediu menos movimento vê o estado final direto.
  const [factors, setFactors] = useState<number[]>(targets);
  const pos = useRef<number[]>([...targets]);
  const vel = useRef<number[]>(targets.map(() => 0));
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      pos.current = [...targets];
      setFactors([...targets]);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      let moving = false;
      targets.forEach((target, i) => {
        const p = pos.current[i] ?? target;
        const v = vel.current[i] ?? 0;
        const nextV = v + (-300 * (p - target) - 28 * v) * dt;
        const nextP = p + nextV * dt;
        if (Math.abs(nextP - target) > 0.001 || Math.abs(nextV) > 0.01) {
          pos.current[i] = nextP;
          vel.current[i] = nextV;
          moving = true;
        } else {
          pos.current[i] = target;
          vel.current[i] = 0;
        }
      });
      pos.current.length = targets.length;
      vel.current.length = targets.length;
      setFactors([...pos.current]);
      if (moving) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [targets]);

  // Posição de cada pílula: a anterior + largura + espaço + o afastamento animado.
  const rects = useMemo(() => {
    const xs: number[] = [];
    base.forEach((_, i) => xs.push(i === 0 ? 0 : xs[i - 1] + base[i - 1].width + gap + push * (factors[i - 1] ?? 0)));
    return base.map((rect, i) => ({ ...rect, x: xs[i] }));
  }, [base, factors, gap, push]);

  // A caixa tem a largura máxima (todos afastados) e o grupo fica centralizado nela, sem empurrar a página.
  const width = rects.length ? rects[rects.length - 1].x + rects[rects.length - 1].width : 0;
  const maxWidth = base.length ? base[base.length - 1].x + base[base.length - 1].width + push * Math.max(1, base.length - 1) : 0;
  const offset = (maxWidth - width) / 2;

  const path = useMemo(() => {
    const parts = rects.map((r) => pillPath({ ...r, x: r.x + offset }, radius));
    rects.slice(0, -1).forEach((r, i) => {
      const bridge = bridgePath({ ...r, x: r.x + offset }, { ...rects[i + 1], x: rects[i + 1].x + offset }, radius, height * 0.38, factors[i] ?? 0);
      if (bridge) parts.push(bridge);
    });
    return parts.join(" ");
  }, [rects, offset, radius, height, factors]);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onMouseLeave={() => setHovered(null)}
      className={cn("relative select-none", className)}
      style={{ width: maxWidth, height }}
    >
      <svg aria-hidden width="100%" height="100%" className="pointer-events-none absolute inset-0 overflow-visible">
        <path d={path} fill="rgb(255 255 255 / 0.085)" />
      </svg>
      {options.map((option, i) => {
        const isActive = i === active;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            onMouseEnter={() => setHovered(i)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            className={cn(
              "absolute top-0 flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-150",
              isActive ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
            style={{ left: rects[i].x + offset, width: rects[i].width, height, fontSize, ["--icon" as string]: `${iconSize}px` }}
          >
            {option.icon && <span className="flex [&_svg]:size-(--icon)">{option.icon}</span>}
            {option.label}
            {isActive && <span aria-hidden className="absolute bottom-[3px] left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-current" />}
          </button>
        );
      })}
    </div>
  );
}
