"use client";

import { AiMagicIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useApp } from "@/lib/client/app-store";
import { cn } from "../ui/cn";
import { Tip } from "../ui/tooltip";
import { Icon } from "@/components/ui/icon";

/**
 * Escolha do formato do carrossel: "Livre" ou um dos formatos salvos pela pessoa.
 * Só aparece quando existe algum formato salvo.
 */
export function FormatPicker({
  value,
  onChange,
  className,
  align = "center",
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
  align?: "center" | "start";
}) {
  const formats = useApp((s) => s.formats);
  if (!formats.length) return null;
  const options = [{ id: null as string | null, name: "Livre", hint: "O ChatGPT escolhe a melhor estrutura." }, ...formats.map((f) => ({ id: f.id as string | null, name: f.name, hint: f.description || "Seu formato" }))];
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", align === "center" ? "justify-center" : "justify-start", className)} role="radiogroup" aria-label="Formato do carrossel">
      <span className="mr-1 flex items-center gap-1 text-[12.5px] text-ink-3">
        <Icon icon={AiMagicIcon} className="size-3.5" />
        Formato
      </span>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Tip key={option.id ?? "livre"} label={option.hint}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex h-7 items-center gap-1 rounded-full border px-3 text-[12.5px] transition-colors",
                active ? "selected text-ink" : "border-white/[0.09] text-ink-2 hover:border-white/[0.18] hover:text-ink",
              )}
            >
              {active && <Icon icon={Tick02Icon} className="size-3" />}
              {option.name}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
