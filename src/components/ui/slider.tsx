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
        <S.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-black/40 shadow-[inset_0_1px_2px_rgb(0_0_0/0.6),0_1px_0_rgb(255_255_255/0.06)]">
          <S.Range className="absolute h-full rounded-full bg-white/75" />
        </S.Track>
        <S.Thumb aria-label={label} className="block size-[18px] rounded-full bg-[linear-gradient(180deg,#ffffff,#d6d6d6)] shadow-[inset_0_1px_0_#fff,0_1px_3px_rgb(0_0_0/0.6),0_4px_10px_-4px_rgb(0_0_0/0.7)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50" />
      </S.Root>
    </div>
  );
}
