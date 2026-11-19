"use client";

import { AiChat02Icon, ComputerIcon, LinkSquare02Icon, Logout01Icon, Settings02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ThinkingOrb } from "thinking-orbs";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/app-store";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Dialog, DialogContent } from "../ui/dialog";
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
export function ChatGPTAccount({ compact = false, status = false }: { compact?: boolean; status?: boolean }) {
  const auth = useApp((s) => s.auth);
  const setLoginOpen = useApp((s) => s.setLoginOpen);

  if (!auth) return <div className={cn("bg-white/[0.04]", compact ? "size-[32px] rounded-[10px]" : "home-account-placeholder h-9 rounded-full")} aria-hidden />;
  if (!auth.connected) {
    return (
      <Button variant="glass" size={compact ? "icon-sm" : "md"} aria-label="Entrar com ChatGPT" title="Entrar com ChatGPT" onClick={() => setLoginOpen(true)} className={compact ? undefined : "home-pill home-account h-9 rounded-full px-4 text-[14px] font-medium"}>
        {compact ? <Icon icon={AiChat02Icon} /> : <><span className="home-login-full">Entrar com ChatGPT</span><span className="home-login-short">Entrar</span></>}
      </Button>
    );
  }
  return <AccountMenu compact={compact} status={status} />;
}

/** `status` mostra a conta como uma linha de estado ("Conectado · Pro") que abre o mesmo menu. */
function AccountMenu({ compact, status }: { compact: boolean; status: boolean }) {
  const auth = useApp((s) => s.auth)!;
  const refreshAuth = useApp((s) => s.refreshAuth);
  const openSettings = useApp((s) => s.openSettings);
  const plan = planLabel(auth.plan);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        {status ? (
          <button aria-label={`Conta do ChatGPT${plan ? ` ${plan}` : ""}, conectada`} className="flex h-8 min-w-0 items-center gap-1.5 rounded-[9px] px-2 text-[12px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink data-[state=open]:bg-white/[0.1] data-[state=open]:text-ink">
            <i className="led shrink-0" aria-hidden />
            <span className="truncate">{plan || "Conectado"}</span>
          </button>
        ) : (
        <button aria-label={`ChatGPT${plan ? ` ${plan}` : ""} · conectado`} title={`ChatGPT${plan ? ` ${plan}` : ""} · conectado`} className={cn("relative flex items-center justify-center gap-2 text-ink transition-colors", compact ? "control size-[32px] rounded-[10px] p-0 text-[13.5px] hover:border-line-strong" : "home-pill home-account px-4")}>
          <Icon icon={AiChat02Icon} className="size-4 shrink-0" />
          {compact && <span className="absolute right-1 top-1 flex size-1.5">
            <span className="absolute inset-0 rounded-full bg-ok" />
          </span>}
          {!compact && <><span>ChatGPT</span>{plan && <span className="home-account-plan text-ink-3">{plan}</span>}</>}
        </button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="arrasta-pop glass z-50 w-[300px] rounded-[18px] p-2 text-ink outline-none">
          <div className="px-3 pb-3 pt-2.5">
            <p className="text-[12px] text-ink-3">{auth.mode === "system" ? "Conta do ChatGPT deste computador" : "Conectado com o ChatGPT"}</p>
            <p className="mt-0.5 truncate text-[14px] font-medium">{auth.email ?? "Conta conectada"}</p>
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
              {auth.mode === "system" ? "Sair" : "Sair"}
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
            : "O Arrasta AI usa sua própria conta do ChatGPT pelo Codex, da OpenAI. O login acontece na página da OpenAI e fica salvo neste computador."
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
              {["Sem chave nem cobrança de API separada", "Usa os limites do Codex na sua conta", "Sem servidor intermediário do Arrasta AI"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <Icon icon={Tick02Icon} className="size-4 text-ink-3" />
                  {t}
                </li>
              ))}
            </ul>
            {error && <p className="rounded-[12px] border border-red-400/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-200">{error}</p>}
            <Button variant="lit" size="lg" className="w-full rounded-full" onClick={start} disabled={starting}>
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
