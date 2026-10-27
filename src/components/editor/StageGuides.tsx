"use client";

import { slideHeight } from "@/lib/defaults";
import type { SlideSize } from "@/lib/types";

/** Sobreposição do palco: linhas e rótulos não são escalados nem exportados. */
export function StageGuides({ size }: { size: SlideSize }) {
  const height = slideHeight(size);
  const label = "absolute left-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-[11px] leading-tight";
  return (
    <div data-stage-guides aria-hidden className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
      <div className="absolute inset-x-0 border-y border-dashed border-emerald-300/90 text-emerald-200" style={{ top: `${(height - 1080) / 2 / height * 100}%`, height: `${1080 / height * 100}%` }}>
        <span className={label}>Explorar</span>
      </div>
      {size === "4:5" && <div className="absolute inset-y-0 border-x border-dashed border-emerald-300/90 text-emerald-200" style={{ left: `${33.75 / 1080 * 100}%`, right: `${33.75 / 1080 * 100}%` }}>
        <span className={label}>Grade do perfil</span>
      </div>}
      <div className="absolute inset-y-0 border-x border-white/25 text-white/65" style={{ left: `${64 / 1080 * 100}%`, right: `${64 / 1080 * 100}%` }}>
        <span className={`${label} top-auto bottom-1`}>Margem</span>
      </div>
      <div className="absolute inset-y-0 left-1/2 border-l border-white/15" />
      <div className="absolute inset-x-0 top-1/2 border-t border-white/15" />
    </div>
  );
}
