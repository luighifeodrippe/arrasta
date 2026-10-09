"use client";

import { Switch as S } from "radix-ui";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex h-9 cursor-pointer items-center justify-between gap-3 text-[13.5px] text-ink-2 hover:text-ink">
      {label}
      <S.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-[22px] w-[38px] shrink-0 rounded-full border border-white/10 bg-white/[0.08] transition-colors duration-200 data-[state=checked]:border-white/40 data-[state=checked]:bg-white"
      >
        <S.Thumb className="block size-4 translate-x-[2px] rounded-full bg-white shadow transition-transform duration-200 ease-out data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-black" />
      </S.Root>
    </label>
  );
}
