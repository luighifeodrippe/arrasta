import type { MancheteStyle } from "./types";

/** Ritmo do modelo: a capa, cards alternando, o penúltimo em degradê e o último no claro. */
export function mancheteTone(index: number, total: number, theme: "light" | "dark", style: MancheteStyle = "moderno"): "light" | "dark" | "accent" {
  if (index === total - 1 && index > 0) return "light";
  if (total >= 6 && index === total - 2) return "accent";
  if (style === "minimalista") return index === 2 || index === total - 3 ? "dark" : "light";
  if (style === "bold") return index % 3 === 2 ? "light" : "dark";
  if (index === 0) return theme;
  return index % 2 === 1 ? theme : theme === "dark" ? "light" : "dark";
}

function channels(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xff3500;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(rgb: [number, number, number], target: number, amount: number): string {
  const out = rgb.map((c) => Math.round(c + (target - c) * amount));
  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Uma cor só deriva o resto: tons da marca e fundos com a temperatura dela. */
export function mancheteColors(accent: string, surfaces?: { light: string; dark: string } | null) {
  const rgb = channels(accent);
  const warm = rgb[0] >= rgb[2];
  const light = mix(rgb, 255, 0.2);
  const dark = mix(rgb, 0, 0.3);
  return {
    light,
    dark,
    lightBg: surfaces?.light ?? (warm ? "#F7F4F1" : "#F0F2F5"),
    darkBg: surfaces?.dark ?? (warm ? "#0F0D0C" : "#0C0D10"),
    // O tom escuro fica embaixo porque é lá que o texto mora.
    gradient: `linear-gradient(345deg, ${dark} 0%, ${mix(rgb, 0, 0)} 50%, ${light} 100%)`,
  };
}

/** A capa curta ganha letra maior; a longa desce até caber em cinco linhas. */
export function coverTitleSize(title: string): number {
  const length = title.replace(/\*\*/g, "").length;
  return length <= 56 ? 136 : length <= 84 ? 120 : length <= 120 ? 104 : 88;
}
