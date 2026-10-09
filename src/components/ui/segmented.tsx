"use client";

import { motion } from "motion/react";
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
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  className?: string;
  size?: "sm" | "md";
  label: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("glass-flat inline-flex rounded-[13px] p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-medium transition-colors duration-150",
              size === "sm" ? "h-7 px-2.5 text-[12.5px] [&_svg]:size-3.5" : "h-8 px-3.5 text-[13.5px] [&_svg]:size-4",
              active ? "text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="selected absolute inset-0 rounded-[10px] border"
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
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
