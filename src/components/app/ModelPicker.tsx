"use client";

import { ArrowDown01Icon, ChatGptIcon, Settings02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Popover } from "radix-ui";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/app-store";
import type { Effort } from "@/lib/types";
import { cn } from "../ui/cn";
import { Segmented } from "../ui/segmented";

const EFFORTS: { value: Effort; label: string }[] = [
  { value: "low", label: "Rápido" },
  { value: "medium", label: "Equilibrado" },
  { value: "high", label: "Caprichado" },
];

/** Modelo e ritmo do ChatGPT, à mão na conversa (como o seletor do ChatGPT). */
export function ModelPicker({ compact }: { compact?: boolean }) {
  const auth = useApp((s) => s.auth);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const setLoginOpen = useApp((s) => s.setLoginOpen);
  const openSettings = useApp((s) => s.openSettings);

  if (!auth?.connected) {
    return (
      <button
        type="button"
        onClick={() => setLoginOpen(true)}
        className="mb-1 flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-2.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink"
      >
        <Icon icon={ChatGptIcon} className="size-[18px]" />
        {!compact && "Entrar"}
      </button>
    );
  }

  const save = async (patch: { model?: string | null; effort?: Effort }) => {
    try {
      setSettings((await api.saveSettings(patch)).settings);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  const model = auth.models.find((m) => m.slug === settings?.model)?.name ?? "Padrão";
  const effort = EFFORTS.find((e) => e.value === (settings?.effort ?? "low"))?.label ?? "Rápido";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Modelo: ${model}. Ritmo: ${effort}`}
          className="mb-1 flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-2.5 text-[12.5px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink data-[state=open]:bg-white/[0.1] data-[state=open]:text-ink"
        >
          <Icon icon={ChatGptIcon} className="size-[18px]" />
          {!compact && (
            <>
              <span className="max-w-[108px] truncate font-medium text-ink">{model}</span>
              <span className="text-ink-3">{effort}</span>
              <Icon icon={ArrowDown01Icon} className="size-3.5 text-ink-3" />
            </>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="end" sideOffset={10} collisionPadding={12} className="arrasta-pop glass z-50 flex w-[280px] flex-col gap-3 rounded-[16px] p-3 text-ink">
          <div>
            <p className="mb-1.5 px-1 text-[12px] font-medium text-ink-3">Modelo</p>
            <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
              {[{ slug: "", name: "Padrão do ChatGPT" }, ...auth.models].map((m) => {
                const active = (settings?.model ?? "") === m.slug;
                return (
                  <button
                    key={m.slug || "padrao"}
                    onClick={() => save({ model: m.slug || null })}
                    className={cn(
                      "flex h-9 shrink-0 items-center justify-between rounded-[10px] px-2.5 text-left text-[13.5px] transition-colors",
                      active ? "bg-white/[0.08] text-ink" : "text-ink-2 hover:bg-white/[0.05] hover:text-ink",
                    )}
                  >
                    {m.name}
                    {active && <Icon icon={Tick02Icon} className="size-4" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 px-1 text-[12px] font-medium text-ink-3">Ritmo</p>
            <Segmented label="Ritmo" size="sm" className="w-full" value={settings?.effort ?? "low"} onChange={(value) => save({ effort: value })} options={EFFORTS} />
          </div>
          <Popover.Close asChild>
            <button
              onClick={() => openSettings("escrita")}
              className="flex h-8 items-center justify-center gap-1.5 rounded-[10px] text-[12.5px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink"
            >
              <Icon icon={Settings02Icon} className="size-4" />
              Instruções e estilo de escrita
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
