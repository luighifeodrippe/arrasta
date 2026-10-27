"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "./cn";

/** Abas com uma pílula de vidro que desliza até a opção escolhida. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  label,
  appearance = "default",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  className?: string;
  size?: "sm" | "md";
  label: string;
  appearance?: "default" | "pill";
}) {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const pill = appearance === "pill";
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex p-1", pill ? "rounded-full bg-white/[0.05] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]" : "glass-flat rounded-[13px]", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors duration-150",
              pill ? "h-8 rounded-full px-3.5 text-[14px] [&_svg]:size-4" : size === "sm" ? "h-7 rounded-[10px] px-2.5 text-[12.5px] [&_svg]:size-3.5" : "h-8 rounded-[10px] px-3.5 text-[13.5px] [&_svg]:size-4",
              active ? "text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className={cn("absolute inset-0", pill ? "rounded-full bg-white/[0.12] shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]" : "selected rounded-[10px] border")}
                transition={pill && reducedMotion ? { duration: 0 } : { type: "spring", duration: pill ? 0.3 : 0.35, bounce: pill ? 0 : 0.15 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
