"use client";

import { AiMagicIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useId, useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const groupId = useId();
  if (!formats.length) return null;
  const visible = expanded ? formats : formats.filter((format, index) => index < 5 || format.id === value);
  const options = [{ id: null as string | null, name: "Livre", hint: "O ChatGPT escolhe a melhor estrutura." }, ...visible.map((f) => ({ id: f.id as string | null, name: f.name, hint: f.description || "Seu formato" }))];
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", align === "center" ? "justify-center" : "justify-start", className)}>
      <span className="mr-1 flex items-center gap-1 text-[12.5px] text-ink-3">
        <Icon icon={AiMagicIcon} className="size-3.5" />
        Formato
      </span>
      <div id={groupId} role="radiogroup" aria-label="Formato do carrossel" className="contents">
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
                  "flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  active ? "selected text-white" : "control text-ink-2 hover:text-ink",
                )}
              >
                {active && <Icon icon={Tick02Icon} className="size-3" />}
                {option.name}
              </button>
            </Tip>
          );
        })}
      </div>
      {formats.length > 5 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={groupId}
          onClick={() => setExpanded((value) => !value)}
          className="chip-key"
        >
          {expanded ? "Menos formatos" : "Mais formatos"}
        </button>
      )}
    </div>
  );
}
