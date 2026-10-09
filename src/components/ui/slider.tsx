"use client";

import { Slider as S } from "radix-ui";

export function Range({
  value,
  onChange,
  min,
  max,
  step,
  label,
  format,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  format?: (value: number) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[13.5px]">
        <span className="text-ink-2">{label}</span>
        <span className="tabular-nums text-ink-3">{format ? format(value) : value}</span>
      </div>
      <S.Root
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        className="relative flex h-5 w-full touch-none select-none items-center"
      >
        <S.Track className="relative h-1 grow overflow-hidden rounded-full bg-white/[0.1]">
          <S.Range className="absolute h-full rounded-full bg-white/70" />
        </S.Track>
        <S.Thumb aria-label={label} className="block size-4 rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/0.5)] transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-white/50" />
      </S.Root>
    </div>
  );
}
