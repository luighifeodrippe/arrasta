"use client";

import { ColorPickerIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "../ui/cn";
import { Icon } from "@/components/ui/icon";

function isLight(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 170;
}

/** Amostras de cor + seletor livre. Com allowDefault, a primeira opção volta ao padrão do tema. */
export function Swatches({
  value,
  onChange,
  colors,
  allowDefault,
  label,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  colors: string[];
  allowDefault?: boolean;
  label: string;
}) {
  const custom = value && !colors.includes(value) ? value : null;
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      {allowDefault && (
        <button
          role="radio"
          aria-checked={value === null}
          onClick={() => onChange(null)}
          className={cn(
            "h-8 rounded-full border px-3 text-[12.5px] transition-colors",
            value === null ? "selected text-ink" : "border-white/[0.1] text-ink-2 hover:text-ink",
          )}
        >
          Padrão
        </button>
      )}
      {colors.map((color) => (
        <button
          key={color}
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={cn(
            "relative grid size-8 place-items-center rounded-full transition-transform duration-150 hover:scale-110",
            value === color ? "shadow-[0_0_0_2px_#000,0_0_0_4px_rgb(255_255_255/0.85)]" : "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)]",
          )}
          style={{ background: color }}
        >
          {value === color && <Icon icon={Tick02Icon} className={cn("size-3.5", isLight(color) ? "text-black" : "text-white")} />}
        </button>
      ))}
      <label
        className={cn(
          "relative grid size-8 cursor-pointer place-items-center rounded-full border border-dashed border-white/25 text-ink-2 transition-colors hover:text-ink",
          custom && "border-solid shadow-[0_0_0_2px_#000,0_0_0_4px_rgb(255_255_255/0.85)]",
        )}
        style={custom ? { background: custom } : undefined}
        aria-label="Outra cor"
      >
        {!custom && <Icon icon={ColorPickerIcon} className="size-3.5" />}
        <input type="color" value={custom ?? "#888888"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  );
}
