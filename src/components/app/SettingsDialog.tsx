"use client";

import {
  AiMagicIcon,
  Camera01Icon,
  ChatGptIcon,
  Delete02Icon,
  Layers01Icon,
  Logout01Icon,
  NoteEditIcon,
  PlusSignIcon,
  QuillWrite01Icon,
  Tick02Icon,
  Upload04Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { Dialog as D } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ThinkingOrb } from "thinking-orbs";
import { Icon, type IconData } from "@/components/ui/icon";
import { api, runAgent } from "@/lib/client/api";
import { useApp, type SettingsTab } from "@/lib/client/app-store";
import { DEFAULT_INSTRUCTIONS, defaultProfile, defaultWriting, uid } from "@/lib/defaults";
import type { Effort, Profile, WritingSettings } from "@/lib/types";
import { planLabel } from "./ChatGPTAccount";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Input, Label, Textarea } from "../ui/field";
import { Segmented } from "../ui/segmented";
import { Toggle } from "../ui/switch";

const TABS: { value: SettingsTab; label: string; icon: IconData; title: string; description: string }[] = [
  { value: "perfil", label: "Perfil", icon: UserCircleIcon, title: "Seu perfil nos slides", description: "Foto, nome e @ que aparecem nos carrosséis." },
  { value: "voz", label: "Sua voz", icon: QuillWrite01Icon, title: "Sua voz", description: "Público, gostos e referências usados em cada carrossel." },
  { value: "escrita", label: "Escrita", icon: NoteEditIcon, title: "Como o ChatGPT escreve", description: "As instruções do redator e o formato dos textos." },
  { value: "formatos", label: "Formatos", icon: Layers01Icon, title: "Formatos de carrossel", description: "Estruturas que o ChatGPT segue ao criar: escolha uma na hora de colar o link." },
  { value: "chatgpt", label: "ChatGPT", icon: ChatGptIcon, title: "Sua conta do ChatGPT", description: "Modelo e ritmo usados em todas as tarefas." },
];

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

type SaveStatus = "saving" | "saved" | "error";

/**
 * Rascunho que salva sozinho meio segundo depois da última mudança. Ao abrir as configurações,
 * recomeça do que está salvo (a barra do editor também muda o perfil).
 */
function useDraft<T>(source: T | null, open: boolean, save: (value: T) => Promise<unknown>, onStatus: (status: SaveStatus) => void) {
  const [draft, setDraft] = useState<T | null>(source);
  const saved = useRef<string | null>(source ? JSON.stringify(source) : null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if ((open && !wasOpen.current) || draft === null) {
      if (source) {
        setDraft(source);
        saved.current = JSON.stringify(source);
      }
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  useEffect(() => {
    if (draft === null) return;
    const json = JSON.stringify(draft);
    if (json === saved.current) return;
    onStatus("saving");
    const timer = setTimeout(() => {
      save(draft)
        .then(() => {
          saved.current = json;
          onStatus("saved");
        })
        .catch(() => onStatus("error"));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return [draft, setDraft] as const;
}

/** Configurações em abas: perfil, voz, escrita (instruções do sistema), formatos e conta do ChatGPT. */
export function SettingsDialog() {
  const tab = useApp((s) => s.settingsTab);
  const openSettings = useApp((s) => s.openSettings);
  const closeSettings = useApp((s) => s.closeSettings);
  const [status, setStatus] = useState<"idle" | SaveStatus>("idle");
  const current = TABS.find((t) => t.value === tab) ?? TABS[0];
  const open = tab !== null;
  const storedProfile = useApp((s) => s.profile);
  const setStoredProfile = useApp((s) => s.setProfile);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const [profile, setProfile] = useDraft(storedProfile, open, async (next) => setStoredProfile(await api.saveProfile(next)), setStatus);
  const [writing, setWriting] = useDraft(settings?.writing ?? null, open, async (next) => setSettings((await api.saveSettings({ writing: next })).settings), setStatus);
  const profileProps = {
    draft: profile ?? defaultProfile(),
    patch: (p: Partial<Profile>) => setProfile((d) => ({ ...(d ?? defaultProfile()), ...p })),
    replace: (next: Profile) => setProfile(next),
  };

  useEffect(() => {
    if (tab) setStatus("idle");
  }, [tab]);

  return (
    <D.Root open={tab !== null} onOpenChange={(open) => (open ? openSettings(current.value) : closeSettings())}>
      <D.Portal>
        <D.Overlay className="arrasta-veil fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <D.Content className="arrasta-dialog glass fixed left-1/2 top-1/2 z-50 flex h-[min(680px,calc(100dvh-32px))] w-[min(820px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[22px] text-ink outline-none sm:flex-row">
          <nav aria-label="Configurações" className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-line p-2 sm:w-[196px] sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-3">
            <p className="hidden px-2.5 pb-2 pt-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3 sm:block">Configurações</p>
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => openSettings(t.value)}
                aria-current={t.value === current.value ? "page" : undefined}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] transition-colors",
                  t.value === current.value ? "bg-white/[0.09] text-ink" : "text-ink-2 hover:bg-white/[0.05] hover:text-ink",
                )}
              >
                <Icon icon={t.icon} className="size-[18px]" />
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 px-6 pb-1 pt-5">
              <div className="min-w-0">
                <D.Title className="text-[17px] font-semibold tracking-[-0.01em]">{current.title}</D.Title>
                <D.Description className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{current.description}</D.Description>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-4">
              {current.value === "perfil" && <ProfileTab {...profileProps} />}
              {current.value === "voz" && <VoiceTab {...profileProps} />}
              {current.value === "escrita" && <WritingTab writing={writing ?? defaultWriting()} patch={(p) => setWriting((w) => ({ ...(w ?? defaultWriting()), ...p }))} />}
              {current.value === "formatos" && <FormatsTab />}
              {current.value === "chatgpt" && <AccountTab />}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-3.5">
              <p className="text-[12.5px] text-ink-3" aria-live="polite">
                {status === "saving" ? "Salvando…" : status === "saved" ? "Tudo salvo" : status === "error" ? "Não consegui salvar. Confira se o Arrasta está rodando." : "As mudanças são salvas sozinhas."}
              </p>
              <Button variant="primary" size="sm" onClick={closeSettings}>
                Pronto
              </Button>
            </div>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

interface ProfileProps {
  draft: Profile;
  patch: (patch: Partial<Profile>) => void;
  replace: (next: Profile) => void;
}

function ProfileTab({ draft, patch, replace }: ProfileProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fetching, setFetching] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [importError, setImportError] = useState("");

  const uploadAvatar = async (file: File) => {
    try {
      patch({ avatar: (await api.upload("profile", file)).url });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const fromInstagram = async () => {
    if (!draft.handle.trim()) return;
    setFetching(true);
    setImportError("");
    setImportNotice("");
    try {
      const data = await api.profileFromInstagram(draft.handle);
      replace({ ...draft, handle: data.handle, name: data.imported.name ? data.name : draft.name || data.handle, verified: data.verified, followers: data.followers, avatar: data.avatar ?? draft.avatar, samples: data.samples || draft.samples });
      setImportNotice(data.notice);
      toast.success("Dados públicos disponíveis importados.");
    } catch (error) {
      setImportError((error as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const initial = (draft.name || draft.handle || "?").charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <button onClick={() => fileRef.current?.click()} className="group relative size-20 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.05]" aria-label="Trocar a foto">
          {draft.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.avatar} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-[26px] font-semibold text-ink-2">{initial}</span>
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
            <Icon icon={Camera01Icon} className="size-6" />
          </span>
        </button>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <Icon icon={Upload04Icon} />
            {draft.avatar ? "Trocar foto" : "Enviar foto"}
          </Button>
          {draft.avatar && (
            <Button size="sm" variant="ghost" onClick={() => patch({ avatar: null })}>
              Remover
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadAvatar(file);
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label htmlFor="st-name">Nome</Label>
          <Input id="st-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Seu nome" />
        </div>
        <div>
          <Label htmlFor="st-handle" hint={draft.followers ? `${compact.format(draft.followers)} seguidores` : undefined}>
            @ no Instagram
          </Label>
          <div className="field flex h-10 items-center pl-3 pr-1">
            <span className="text-[14px] text-ink-3">@</span>
            <input
              id="st-handle"
              autoCapitalize="none"
              autoComplete="off"
              aria-invalid={Boolean(importError)}
              aria-describedby="st-instagram-help"
              value={draft.handle}
              onChange={(e) => patch({ handle: e.target.value.replace(/^@+/, "").replace(/\s/g, "") })}
              onKeyDown={(e) => e.key === "Enter" && fromInstagram()}
              placeholder="seuperfil"
              className="h-full min-w-0 flex-1 bg-transparent px-1 text-[14px] outline-none placeholder:text-ink-3"
            />
            <Button size="sm" variant="glass" className="h-8 rounded-[9px] px-2.5" onClick={fromInstagram} disabled={!draft.handle.trim() || fetching}>
              {fetching ? "Buscando…" : "Buscar perfil"}
            </Button>
          </div>
          <p id="st-instagram-help" className={cn("mt-2 text-[12px] leading-relaxed", importError ? "text-red-300" : "text-ink-3")} role={importError ? "alert" : "status"}>
            {importError || importNotice || "Busca nome, foto e uma amostra de legendas públicas. Se o Instagram bloquear a leitura, preencha manualmente."}
          </p>
        </div>
      </div>

      <Toggle checked={draft.verified} onChange={(verified) => patch({ verified })} label="Mostrar selo de verificado nos slides" />

      <div className="glass-flat flex items-center gap-3 rounded-[16px] p-4">
        {draft.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.avatar} alt="" className="size-11 rounded-full object-cover" />
        ) : (
          <span className="grid size-11 place-items-center rounded-full bg-white/10 text-[15px] font-semibold text-ink-2">{initial}</span>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[14.5px] font-semibold">
            {draft.name || "Seu nome"}
            {draft.verified && <Icon icon={Tick02Icon} className="size-3.5 rounded-full bg-[#1d9bf0] p-[1px] text-white" strokeWidth={2.6} />}
          </p>
          <p className="truncate text-[13px] text-ink-3">@{draft.handle || "seuperfil"}</p>
        </div>
        <p className="ml-auto text-[12px] text-ink-3">Assim aparece nos slides</p>
      </div>
    </div>
  );
}

function VoiceTab({ draft, patch, replace }: ProfileProps) {
  const auth = useApp((s) => s.auth);
  const setLoginOpen = useApp((s) => s.setLoginOpen);
  const [learning, setLearning] = useState(false);
  const [openReference, setOpenReference] = useState<string | null>(null);
  const references = draft.styleReferences ?? [];

  const learnVoice = async () => {
    if (!draft.samples.trim()) {
      toast("Cole textos seus em “Seus textos” para analisar a escrita.");
      return;
    }
    if (!auth?.connected) {
      setLoginOpen(true);
      return;
    }
    setLearning(true);
    try {
      const last = await runAgent({ task: "voice", samples: draft.samples, name: draft.name, handle: draft.handle }, () => undefined);
      if (last?.type === "done" && last.data) {
        const data = last.data as { voice: string; about: string; audience: string };
        replace({ ...draft, voice: data.voice, about: draft.about || data.about, audience: draft.audience || data.audience });
        toast.success("Guia baseado nos seus exemplos. Revise o que combina com você.");
      } else if (last?.type === "error") {
        toast.error(last.message);
        if (last.needsLogin) setLoginOpen(true);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLearning(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="st-about">Sobre o que você fala</Label>
          <Input id="st-about" value={draft.about} onChange={(e) => patch({ about: e.target.value })} placeholder="IA aplicada, marketing…" />
        </div>
        <div>
          <Label htmlFor="st-aud">Para quem</Label>
          <Input id="st-aud" value={draft.audience} onChange={(e) => patch({ audience: e.target.value })} placeholder="Criadores, empreendedores…" />
        </div>
      </div>
      <div>
        <Label htmlFor="st-goal">O que você quer que o conteúdo provoque?</Label>
        <Input id="st-goal" value={draft.goal ?? ""} maxLength={500} onChange={(e) => patch({ goal: e.target.value })} placeholder="Ensinar, gerar conversa, atrair clientes…" />
      </div>
      <div>
        <Label htmlFor="st-preferences">O que você gosta — e o que quer evitar?</Label>
        <Textarea id="st-preferences" rows={3} value={draft.preferences ?? ""} maxLength={1200} onChange={(e) => patch({ preferences: e.target.value })} placeholder="Gosto de exemplos práticos e humor seco. Evite tom de guru, promessas e frases prontas." />
      </div>
      <div className="relative">
        <Label
          htmlFor="st-voice"
          hint={
            <button onClick={learnVoice} disabled={learning} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-2 transition-colors hover:text-ink disabled:opacity-50">
              <Icon icon={AiMagicIcon} className="size-3.5" />
              Analisar meus textos
            </button>
          }
        >
          Como você escreve
        </Label>
        <Textarea
          id="st-voice"
          rows={4}
          value={draft.voice}
          onChange={(e) => patch({ voice: e.target.value })}
          placeholder={"- Tom direto e próximo\n- Frases curtas\n- Fecha sempre com uma pergunta"}
        />
        {learning && (
          <div className="absolute inset-x-0 bottom-0 top-6 flex items-center justify-center gap-3 rounded-[14px] bg-[#141414]/90 text-[13.5px] text-ink-2 backdrop-blur-sm">
            <ThinkingOrb state="composing" size={20} theme="dark" aria-hidden />
            Analisando seus exemplos…
          </div>
        )}
      </div>
      <div>
        <details className="group rounded-[12px] border border-line p-3">
          <summary className="cursor-pointer text-[13px] font-medium">Seus textos <span className="font-normal text-ink-3">· {draft.samples.trim() ? "Exemplos salvos" : "Adicione exemplos"}</span></summary>
          <div className="mt-3">
            <Label htmlFor="st-samples">Legendas, roteiros ou posts que você escreveu</Label>
            <Textarea id="st-samples" rows={5} value={draft.samples} onChange={(e) => patch({ samples: e.target.value })} placeholder="Cole dois ou três textos seus. Eles ajudam a reconhecer seu ritmo e vocabulário." />
          </div>
        </details>
      </div>
      <section aria-labelledby="st-references-title">
        <div className="flex items-center justify-between gap-3">
          <h3 id="st-references-title" className="text-[13px] font-medium">Referências de escrita</h3>
          <Button size="sm" variant="ghost" disabled={references.length >= 5} onClick={() => {
            const id = uid();
            patch({ styleReferences: [...references, { id, name: "", focus: "", samples: "", weight: 3 }] });
            setOpenReference(id);
          }}>
            <Icon icon={PlusSignIcon} /> Adicionar
          </Button>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-ink-3">Combine até cinco referências. Cole exemplos e escolha o que aproveitar; só o @ não revela o estilo.</p>
        <div className="space-y-2">
          {references.map((reference, index) => {
            const update = (changes: Partial<typeof reference>) => patch({ styleReferences: references.map((item) => item.id === reference.id ? { ...item, ...changes } : item) });
            return (
              <details key={reference.id} open={openReference === reference.id} className="rounded-[12px] border border-line p-3">
                <summary onClick={(event) => { event.preventDefault(); setOpenReference(openReference === reference.id ? null : reference.id); }} className="cursor-pointer text-[13px] font-medium">{reference.name || `Referência ${index + 1}`} <span className="font-normal text-ink-3">· {reference.samples.trim() ? `Influência ${reference.weight}/5` : "Faltam exemplos"}</span></summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <Label htmlFor={`ref-name-${reference.id}`}>Nome ou @ da referência</Label>
                    <Input id={`ref-name-${reference.id}`} value={reference.name} maxLength={100} onChange={(e) => update({ name: e.target.value })} placeholder="Ex.: @criador" />
                  </div>
                  <div>
                    <Label htmlFor={`ref-focus-${reference.id}`}>O que você gosta nessa escrita?</Label>
                    <Input id={`ref-focus-${reference.id}`} value={reference.focus} maxLength={500} onChange={(e) => update({ focus: e.target.value })} placeholder="Ganchos diretos, ritmo, exemplos, humor…" />
                  </div>
                  <div>
                    <Label htmlFor={`ref-samples-${reference.id}`}>Textos de exemplo</Label>
                    <Textarea id={`ref-samples-${reference.id}`} rows={4} maxLength={4000} value={reference.samples} onChange={(e) => update({ samples: e.target.value })} placeholder="Cole trechos de posts dessa referência. Eles orientam o estilo, sem copiar frases." />
                  </div>
                  <div>
                    <Label htmlFor={`ref-weight-${reference.id}`} hint={`${reference.weight}/5`}>Influência na mistura</Label>
                    <input id={`ref-weight-${reference.id}`} type="range" min={1} max={5} step={1} value={reference.weight} onChange={(e) => update({ weight: Number(e.target.value) })} className="h-6 w-full accent-white" />
                    <div className="flex justify-between text-[11px] text-ink-3"><span>Sutil</span><span>Forte</span></div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => patch({ styleReferences: references.filter((item) => item.id !== reference.id) })}><Icon icon={Delete02Icon} /> Remover referência</Button>
                </div>
              </details>
            );
          })}
        </div>
      </section>
      <div>
        <Label htmlFor="st-cta">Chamada final preferida</Label>
        <Input id="st-cta" value={draft.cta} onChange={(e) => patch({ cta: e.target.value })} placeholder="Salva e me segue para mais…" />
      </div>
    </div>
  );
}

function WritingTab({ writing: w, patch }: { writing: WritingSettings; patch: (patch: Partial<WritingSettings>) => void }) {
  const instructions = w.instructions.trim() ? w.instructions : DEFAULT_INSTRUCTIONS;
  const custom = Boolean(w.instructions.trim()) && w.instructions.trim() !== DEFAULT_INSTRUCTIONS;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Choice label="Idioma">
          <Segmented
            label="Idioma"
            size="sm"
            className="w-full"
            value={w.language}
            onChange={(language) => patch({ language })}
            options={[
              { value: "pt-BR", label: "Português" },
              { value: "en", label: "Inglês" },
              { value: "es", label: "Espanhol" },
            ]}
          />
        </Choice>
        <Choice label="Tamanho dos textos">
          <Segmented
            label="Tamanho dos textos"
            size="sm"
            className="w-full"
            value={w.length}
            onChange={(length) => patch({ length })}
            options={[
              { value: "curto", label: "Curto" },
              { value: "medio", label: "Médio" },
              { value: "longo", label: "Longo" },
            ]}
          />
        </Choice>
        <Choice label="Emojis">
          <Segmented
            label="Emojis"
            size="sm"
            className="w-full"
            value={w.emojis}
            onChange={(emojis) => patch({ emojis })}
            options={[
              { value: "nunca", label: "Nunca" },
              { value: "poucos", label: "Poucos" },
              { value: "livre", label: "À vontade" },
            ]}
          />
        </Choice>
        <Choice label="Número de slides">
          <Segmented
            label="Número de slides"
            size="sm"
            className="w-full"
            value={w.slides}
            onChange={(slides) => patch({ slides })}
            options={[
              { value: "poucos", label: "5 a 7" },
              { value: "medio", label: "7 a 9" },
              { value: "muitos", label: "9 a 12" },
            ]}
          />
        </Choice>
      </div>
      <div>
        <Label htmlFor="st-avoid" hint="Separe por vírgula">
          Nunca usar
        </Label>
        <Input id="st-avoid" value={w.avoid} onChange={(e) => patch({ avoid: e.target.value })} placeholder="incrível, game changer, alavancar…" />
      </div>
      <div>
        <Label
          htmlFor="st-instructions"
          hint={
            custom ? (
              <button onClick={() => patch({ instructions: "" })} className="text-[12.5px] font-medium text-ink-2 transition-colors hover:text-ink">
                Restaurar padrão
              </button>
            ) : (
              "Padrão do Arrasta"
            )
          }
        >
          Instruções do redator (system prompt)
        </Label>
        <Textarea
          id="st-instructions"
          rows={11}
          value={instructions}
          onChange={(e) => patch({ instructions: e.target.value.trim() === DEFAULT_INSTRUCTIONS ? "" : e.target.value })}
          className="font-mono text-[12.5px] leading-relaxed"
        />
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
          Vale para criar, recriar e ajustar. O formato da resposta (o JSON dos slides) fica fora daqui, para nada quebrar.
        </p>
      </div>
    </div>
  );
}

function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">{label}</p>
      {children}
    </div>
  );
}

function FormatsTab() {
  const formats = useApp((s) => s.formats);
  const setFormats = useApp((s) => s.setFormats);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const builtin = formats.filter((f) => f.origin === "builtin");
  const own = formats.filter((f) => f.origin !== "builtin");

  const add = (format: (typeof formats)[number]) => {
    setFormats([...builtin, ...[...own, format].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))]);
    toast.success(`Formato “${format.name}” pronto. Ele aparece na hora de criar.`);
  };
  const create = async () => {
    try {
      add(await api.createFormat({ name, prompt }));
      setCreating(false);
      setName("");
      setPrompt("");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  const remove = async (id: string) => {
    await api.deleteFormat(id);
    setFormats(formats.filter((f) => f.id !== id));
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Já vêm no Arrasta</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {builtin.map((f) => (
            <li key={f.id} className="glass-flat rounded-[14px] px-3.5 py-3">
              <p className="text-[14px] font-medium">{f.name}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{f.description}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Seus formatos</p>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => setCreating((v) => !v)}>
              <Icon icon={PlusSignIcon} />
              Criar formato
            </Button>
          </div>
        </div>
        {creating && (
          <div className="glass-flat mb-3 flex flex-col gap-3 rounded-[14px] p-3.5">
            <div>
              <Label htmlFor="fmt-name">Nome</Label>
              <Input id="fmt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Antes e depois" />
            </div>
            <div>
              <Label htmlFor="fmt-prompt">Como o carrossel deve ser</Label>
              <Textarea
                id="fmt-prompt"
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={"Estrutura, slide a slide, tom e exemplos.\nEx.: 1. Capa com o antes. 2. O problema. 3. O que mudou…"}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button size="sm" variant="primary" onClick={create} disabled={!name.trim() || prompt.trim().length < 20}>
                Salvar formato
              </Button>
            </div>
          </div>
        )}
        {own.length ? (
          <ul className="flex flex-col gap-1.5">
            {own.map((f) => (
              <li key={f.id} className="glass-flat flex items-center gap-2.5 rounded-[12px] py-2 pl-3.5 pr-1.5">
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{f.name}</span>
                <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-ink-3">Seu</span>
                <button onClick={() => remove(f.id)} className="grid size-8 place-items-center rounded-[9px] text-ink-3 transition-colors hover:bg-red-500/15 hover:text-red-300" aria-label={`Excluir o formato ${f.name}`}>
                  <Icon icon={Delete02Icon} className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          !creating && (
            <p className="text-[13px] leading-relaxed text-ink-3">
              Salve uma estrutura para reutilizar: ordem dos cards, tom e exemplos.
            </p>
          )
        )}
      </section>
    </div>
  );
}

const EFFORTS: { value: Effort; label: string; hint: string }[] = [
  { value: "low", label: "Rápido", hint: "Responde em segundos. Bom para o dia a dia." },
  { value: "medium", label: "Equilibrado", hint: "Pensa um pouco mais antes de escrever." },
  { value: "high", label: "Caprichado", hint: "Mais lento, para os carrosséis mais importantes." },
];

function AccountTab() {
  const auth = useApp((s) => s.auth);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const refreshAuth = useApp((s) => s.refreshAuth);
  const setLoginOpen = useApp((s) => s.setLoginOpen);

  const save = async (patch: { model?: string | null; effort?: Effort }) => {
    try {
      setSettings((await api.saveSettings(patch)).settings);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (!auth?.connected) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[14px] leading-relaxed text-ink-2">Entre com sua conta do ChatGPT para o Arrasta ler e escrever. Usa o seu plano, sem chave de API.</p>
        <Button variant="primary" onClick={() => setLoginOpen(true)}>
          Entrar com ChatGPT
        </Button>
      </div>
    );
  }

  const plan = planLabel(auth.plan);
  return (
    <div className="flex flex-col gap-6">
      <div className="glass-flat flex items-center gap-3 rounded-[16px] p-4">
        <span className="grid size-10 place-items-center rounded-full bg-white/[0.08]">
          <Icon icon={ChatGptIcon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{auth.email ?? "Conta conectada"}</p>
          <p className="text-[12.5px] text-ink-3">
            {auth.mode === "system" ? "Conta do Codex deste computador" : "Conectado com o ChatGPT"}
            {plan ? ` · ${plan}` : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await api.authAction("logout");
            await refreshAuth();
          }}
        >
          <Icon icon={Logout01Icon} />
          {auth.mode === "system" ? "Parar de usar" : "Sair"}
        </Button>
      </div>

      <section>
        <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Ritmo</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {EFFORTS.map((e) => {
            const active = (settings?.effort ?? "low") === e.value;
            return (
              <button
                key={e.value}
                onClick={() => save({ effort: e.value })}
                aria-pressed={active}
                className={cn("rounded-[14px] border p-3 text-left transition-colors", active ? "selected" : "border-white/[0.08] hover:border-white/[0.16]")}
              >
                <p className="text-[14px] font-medium">{e.label}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{e.hint}</p>
              </button>
            );
          })}
        </div>
      </section>

      {auth.models.length > 0 && (
        <section>
          <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Modelo</p>
          <div className="flex flex-col gap-1">
            {[{ slug: "", name: "Padrão do ChatGPT" }, ...auth.models].map((m) => {
              const active = (settings?.model ?? "") === m.slug;
              return (
                <button
                  key={m.slug || "padrao"}
                  onClick={() => save({ model: m.slug || null })}
                  className={cn("flex h-10 items-center justify-between rounded-[11px] px-3 text-left text-[13.5px] transition-colors", active ? "bg-white/[0.08] text-ink" : "text-ink-2 hover:bg-white/[0.05] hover:text-ink")}
                >
                  {m.name}
                  {active && <Icon icon={Tick02Icon} className="size-4" />}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
