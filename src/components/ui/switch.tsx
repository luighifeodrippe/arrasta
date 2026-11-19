"use client";

import { Switch as S } from "radix-ui";

export function Toggle({ checked, onChange, label, describedBy }: { checked: boolean; onChange: (value: boolean) => void; label: string; describedBy?: string }) {
  return (
    <label className="flex h-9 cursor-pointer items-center justify-between gap-3 text-[13.5px] text-ink-2 hover:text-ink">
      {label}
      <S.Root
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={describedBy}
        className="relative h-[22px] w-[38px] shrink-0 rounded-full bg-black/40 shadow-[inset_0_1px_2px_rgb(0_0_0/0.6),0_1px_0_rgb(255_255_255/0.06)] transition-[background-color,box-shadow] duration-200 data-[state=checked]:bg-[rgb(167_240_0/0.2)] data-[state=checked]:shadow-[inset_0_1px_2px_rgb(0_0_0/0.5),inset_0_0_0_1px_rgb(167_240_0/0.4)]"
      >
        <S.Thumb className="block size-4 translate-x-[3px] rounded-full bg-[linear-gradient(180deg,#9a9a9a,#6d6d6d)] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(0_0_0/0.6)] transition-[translate,background,box-shadow] duration-200 ease-out data-[state=checked]:translate-x-[19px] data-[state=checked]:bg-[linear-gradient(180deg,#e6ffa8,#a7f000_55%,#7fb800)] data-[state=checked]:shadow-[0_0_4px_rgb(167_240_0/0.85),0_0_12px_rgb(167_240_0/0.42)]" />
      </S.Root>
    </label>
  );
}
