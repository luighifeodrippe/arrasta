"use client";

import { AiChat02Icon, ComputerIcon, LinkSquare02Icon, Logout01Icon, Settings02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ThinkingOrb } from "thinking-orbs";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/app-store";
import type { Effort } from "@/lib/types";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Dialog, DialogContent } from "../ui/dialog";
import { Segmented } from "../ui/segmented";
import { Icon } from "@/components/ui/icon";

const PLAN: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
  prolite: "Pro Lite",
  promax: "Pro Max",
  team: "Team",
  business: "Business",
  enterprise: "Enterprise",
  edu: "Edu",
  go: "Go",
};

export function planLabel(plan: string | null | undefined) {
  return plan ? (PLAN[plan] ?? plan) : null;
}

/** Botão do topo: "Entrar com ChatGPT" ou a conta conectada. */
export function ChatGPTAccount({ compact = false }: { compact?: boolean }) {
  const auth = useApp((s) => s.auth);
  const setLoginOpen = useApp((s) => s.setLoginOpen);

  if (!auth) return <div className={cn("rounded-[10px] bg-white/[0.04]", compact ? "size-[32px]" : "h-9 w-40")} aria-hidden />;
  if (!auth.connected) {
    return (
      <Button variant={compact ? "glass" : "primary"} size={compact ? "icon-sm" : "md"} aria-label="Entrar com ChatGPT" title="Entrar com ChatGPT" onClick={() => setLoginOpen(true)} className={compact ? undefined : "h-9 rounded-[11px] px-3.5 text-[13.5px]"}>
        {compact ? <Icon icon={AiChat02Icon} /> : "Entrar com ChatGPT"}
      </Button>
    );
  }
  return <AccountMenu compact={compact} />;
}

function AccountMenu({ compact }: { compact: boolean }) {
  const auth = useApp((s) => s.auth)!;
  const refreshAuth = useApp((s) => s.refreshAuth);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const openSettings = useApp((s) => s.openSettings);
  const plan = planLabel(auth.plan);

  const save = async (patch: { model?: string | null; effort?: Effort }) => {
    try {
      setSettings((await api.saveSettings(patch)).settings);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label={`ChatGPT${plan ? ` ${plan}` : ""} · conectado`} title={`ChatGPT${plan ? ` ${plan}` : ""} · conectado`} className={cn("control relative flex h-9 items-center justify-center gap-2 rounded-[10px] pl-2.5 pr-3 text-[13.5px] text-ink transition-colors hover:border-line-strong", compact && "size-[32px] p-0")}>
          {compact && <Icon icon={AiChat02Icon} className="size-4" />}
          <span className={cn("flex size-1.5", compact ? "absolute right-1 top-1" : "relative")}>
            <span className="absolute inset-0 rounded-full bg-ok" />
          </span>
          {!compact && <>ChatGPT{plan && <span className="text-ink-3">{plan}</span>}</>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="arrasta-pop glass z-50 w-[300px] rounded-[18px] p-2 text-ink outline-none">
          <div className="px-3 pb-3 pt-2.5">
            <p className="text-[12px] text-ink-3">{auth.mode === "system" ? "Conta do Codex deste computador" : "Conectado com o ChatGPT"}</p>
            <p className="mt-0.5 truncate text-[14px] font-medium">{auth.email ?? "Conta conectada"}</p>
          </div>
          <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
            <div>
              <p className="mb-2 text-[12px] text-ink-3">Ritmo do ChatGPT</p>
              <Segmented
                label="Ritmo"
                size="sm"
                className="w-full"
                value={settings?.effort ?? "low"}
                onChange={(effort) => save({ effort })}
                options={[
                  { value: "low", label: "Rápido" },
                  { value: "medium", label: "Equilibrado" },
                  { value: "high", label: "Caprichado" },
                ]}
              />
            </div>
            {auth.models.length > 0 && (
              <div>
                <p className="mb-2 text-[12px] text-ink-3">Modelo</p>
                <select
                  value={settings?.model ?? ""}
                  onChange={(e) => save({ model: e.target.value || null })}
                  className="field h-9 w-full appearance-none px-3 text-[13.5px]"
                  aria-label="Modelo"
                >
                  <option value="">Padrão do ChatGPT</option>
                  {auth.models.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="border-t border-line p-1 pt-2">
            <Popover.Close asChild>
              <button
                onClick={() => openSettings("escrita")}
                className="flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink"
              >
                <Icon icon={Settings02Icon} className="size-4" />
                Instruções e estilo de escrita
              </button>
            </Popover.Close>
            <button
              onClick={async () => {
                await api.authAction("logout");
                await refreshAuth();
              }}
              className="flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              <Icon icon={Logout01Icon} className="size-4" />
              {auth.mode === "system" ? "Parar de usar esta conta" : "Sair"}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Diálogo de login. O OAuth acontece na página da OpenAI; aqui só acompanhamos. */
export function LoginDialog() {
  const open = useApp((s) => s.loginOpen);
  const setOpen = useApp((s) => s.setLoginOpen);
  const auth = useApp((s) => s.auth);
  const refreshAuth = useApp((s) => s.refreshAuth);
  const [starting, setStarting] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasPending = useRef(false);

  const pending = Boolean(auth?.loginPending) || starting;

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(async () => {
      const next = await refreshAuth();
      if (!next) return;
      if (next.loginUrl) setUrl(next.loginUrl);
      if (next.connected && wasPending.current) {
        wasPending.current = false;
        setOpen(false);
        toast.success(next.email ? `Conectado como ${next.email}` : "ChatGPT conectado");
      } else if (!next.loginPending && wasPending.current && next.loginError) {
        wasPending.current = false;
        setError(next.loginError);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [open, refreshAuth, setOpen]);

  useEffect(() => {
    if (open) {
      setError(null);
      setUrl(null);
    }
  }, [open]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const status = await api.authAction("login");
      wasPending.current = true;
      if (status.loginUrl) setUrl(status.loginUrl);
      if (status.loginError) {
        wasPending.current = false;
        setError(status.loginError);
      }
      await refreshAuth();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const useSystem = async () => {
    await api.authAction("use-system");
    const next = await refreshAuth();
    if (next?.connected) {
      setOpen(false);
      toast.success(next.email ? `Usando ${next.email}` : "ChatGPT conectado");
    }
  };

  const cancel = async () => {
    wasPending.current = false;
    await api.authAction("cancel");
    await refreshAuth();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v && pending ? cancel().then(() => setOpen(false)) : setOpen(v))}>
      <DialogContent
        title={pending ? "Termine o login no navegador" : "Entre com sua conta do ChatGPT"}
        description={
          pending
            ? "Abrimos a página de login da OpenAI numa nova aba. Assim que você confirmar, esta janela fecha sozinha."
            : "O Arrasta trabalha com a sua conta do ChatGPT pelo Codex, da OpenAI. O login acontece na página da OpenAI e fica salvo só neste computador."
        }
        className="w-[min(440px,calc(100vw-32px))]"
      >
        {pending ? (
          <div className="flex flex-col items-center gap-5 pb-1 pt-3 text-center">
            <ThinkingOrb state="connecting" size={64} theme="dark" aria-label="Aguardando o login" />
            <div className="flex w-full flex-col gap-2">
              {url && (
                <Button variant="glass" size="lg" className="w-full" onClick={() => window.open(url, "_blank", "noopener")}>
                  <Icon icon={LinkSquare02Icon} />
                  Abrir a página de login de novo
                </Button>
              )}
              <Button variant="ghost" size="md" className="w-full" onClick={cancel}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-1">
            <ul className="mb-2 flex flex-col gap-2.5 text-[13.5px] text-ink-2">
              {["Usa o seu plano do ChatGPT, sem chave de API", "Nada passa por servidores do Arrasta", "Você pode sair quando quiser"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <Icon icon={Tick02Icon} className="size-4 text-ink-3" />
                  {t}
                </li>
              ))}
            </ul>
            {error && <p className="rounded-[12px] border border-red-400/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-200">{error}</p>}
            <Button variant="primary" size="lg" className="w-full" onClick={start} disabled={starting}>
              Continuar com ChatGPT
            </Button>
            {auth?.system && (
              <Button variant="glass" size="lg" className={cn("w-full justify-start px-4")} onClick={useSystem}>
                <Icon icon={ComputerIcon} className="text-ink-2" />
                <span className="min-w-0 truncate">
                  Usar o Codex deste computador
                  <span className="text-ink-3"> · {auth.system.email}</span>
                </span>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
