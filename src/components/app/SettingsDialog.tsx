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
import { emptyStyleReference, instagramHandle, mergeInstagramProfile, mergeInstagramReference } from "@/lib/client/instagram-mapping";
import { DEFAULT_INSTRUCTIONS, defaultProfile, defaultWriting, uid } from "@/lib/defaults";
import type { Effort, Profile, WritingSettings } from "@/lib/types";
import { planLabel } from "./ChatGPTAccount";
import { InstagramMapper, MappingEvidence } from "./InstagramMapper";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Input, Label, Textarea } from "../ui/field";
import { Segmented } from "../ui/segmented";
import { Toggle } from "../ui/switch";

const TABS: { value: SettingsTab; label: string; icon: IconData; title: string; description: string }[] = [
  { value: "perfil", label: "Perfil", icon: UserCircleIcon, title: "Seu perfil e sua escrita", description: "Informe seu @ para trazer sua identidade e aprender seu estilo." },
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
    update: (apply: (current: Profile) => Profile) => setProfile((current) => apply(current ?? defaultProfile())),
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
  update: (apply: (current: Profile) => Profile) => void;
}

function ProfileTab({ draft, patch, update }: ProfileProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const mappingBaseline = useRef(draft);

  const uploadAvatar = async (file: File) => {
    try {
      patch({ avatar: (await api.upload("profile", file)).url });
    } catch (error) {
      toast.error((error as Error).message);
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
        <InstagramMapper handle={draft.handle} onHandleChange={(handle) => patch({ handle })} onStart={() => { mappingBaseline.current = draft; }} onMapped={(result) => update((current) => mergeInstagramProfile(current, result, mappingBaseline.current))} evidence={instagramHandle(draft.voiceAnalysis?.handle ?? "") === instagramHandle(draft.handle) ? draft.voiceAnalysis : undefined} />
        {draft.followers ? <p className="text-[12px] text-ink-3">{compact.format(draft.followers)} seguidores</p> : null}
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

function VoiceTab({ draft, patch, update }: ProfileProps) {
  const auth = useApp((s) => s.auth);
  const setLoginOpen = useApp((s) => s.setLoginOpen);
  const [learning, setLearning] = useState(false);
  const [referenceHandle, setReferenceHandle] = useState("");
  const references = draft.styleReferences ?? [];
  const mappingBaseline = useRef(draft);
  const referenceExists = references.some((reference) => instagramHandle(reference.handle || reference.name) === instagramHandle(referenceHandle));

  const learnVoice = async () => {
    if (!draft.samples.trim() || learning) return;
    if (!auth?.connected) {
      setLoginOpen(true);
      return;
    }
    const baseline = draft;
    setLearning(true);
    try {
      const last = await runAgent({ task: "voice", samples: draft.samples, name: draft.name, handle: draft.handle }, () => undefined);
      if (last?.type === "done" && last.data) {
        const data = last.data as { voice: string; about: string; audience: string };
        update((current) => ({ ...current, voice: current.voice === baseline.voice ? data.voice : current.voice, about: current.about || data.about, audience: current.audience || data.audience }));
        toast.success("Guia atualizado com seus textos.");
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
    <div className="flex min-w-0 flex-col gap-6">
      <section aria-labelledby="st-references-title">
        <h3 id="st-references-title" className="text-[14px] font-medium">Referências de escrita</h3>
        <p className="mb-4 mt-1 text-[12.5px] leading-relaxed text-ink-3">Informe o @. A IA analisa a escrita e você escolhe a influência de cada perfil.</p>
        <InstagramMapper
          handle={referenceHandle}
          onHandleChange={setReferenceHandle}
          label="@ da referência"
          buttonLabel={referenceExists ? "Mapear" : "Adicionar"}
          canSubmit={references.length < 5 || referenceExists || references.some(emptyStyleReference)}
          onMapped={(result) => {
            const id = uid();
            update((current) => ({ ...current, styleReferences: mergeInstagramReference(current.styleReferences ?? [], result, id) }));
          }}
        />
        {references.length >= 5 && <p className="mt-2 text-[12px] text-ink-3">Cinco referências salvas. Remova uma para adicionar outro perfil; os @ salvos podem ser atualizados.</p>}
        <div className="mt-4 space-y-3">
          {references.map((reference, index) => {
            const change = (changes: Partial<typeof reference>) => update((current) => ({ ...current, styleReferences: (current.styleReferences ?? []).map((item) => item.id === reference.id ? { ...item, ...changes } : item) }));
            return (
              <article key={reference.id} className="rounded-[14px] border border-line p-3.5">
                <div className="flex items-center gap-2.5">
                  {reference.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={reference.avatar} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                  ) : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[13px] text-ink-2">{(reference.name || reference.handle || String(index + 1)).replace(/^@/, "").charAt(0).toUpperCase()}</span>}
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-[13.5px] font-medium">{reference.name || `Referência ${index + 1}`}</h4>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">{reference.guide ? <MappingEvidence sampleCount={reference.sampleCount} imageCount={reference.imageCount} /> : reference.samples.trim() ? "Textos salvos" : "Análise pendente"}</p>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remover ${reference.name || `referência ${index + 1}`}`} onClick={() => update((current) => ({ ...current, styleReferences: (current.styleReferences ?? []).filter((item) => item.id !== reference.id) }))}><Icon icon={Delete02Icon} /></Button>
                </div>
                <div className="mt-3">
                  <Label htmlFor={`ref-weight-${reference.id}`} hint={`${reference.weight}/5`}>Influência na mistura</Label>
                  <input id={`ref-weight-${reference.id}`} type="range" min={1} max={5} step={1} value={reference.weight} onChange={(e) => change({ weight: Number(e.target.value) })} className="h-6 w-full accent-white" />
                  <div className="flex justify-between text-[11px] text-ink-3"><span>Sutil</span><span>Forte</span></div>
                </div>
                <details className="mt-3 text-[12.5px]">
                  <summary className="cursor-pointer text-ink-2">Guia e ajustes opcionais</summary>
                  <div className="mt-3 space-y-3">
                    <div><Label htmlFor={`ref-name-${reference.id}`}>Nome</Label><Input id={`ref-name-${reference.id}`} value={reference.name} maxLength={100} onChange={(e) => change({ name: e.target.value })} /></div>
                    {reference.handle && <Button size="sm" variant="ghost" onClick={() => setReferenceHandle(reference.handle!)}>Usar @{reference.handle} no mapeamento</Button>}
                    {reference.guide && <div><Label htmlFor={`ref-guide-${reference.id}`}>Guia de escrita</Label><Textarea id={`ref-guide-${reference.id}`} rows={5} maxLength={1800} value={reference.guide} onChange={(e) => change({ guide: e.target.value })} /></div>}
                    <div><Label htmlFor={`ref-focus-${reference.id}`} hint="Opcional">O que aproveitar</Label><Input id={`ref-focus-${reference.id}`} value={reference.focus} maxLength={500} onChange={(e) => change({ focus: e.target.value })} placeholder="Ganchos, ritmo, humor…" /></div>
                    <details>
                      <summary className="cursor-pointer text-ink-3">Textos de exemplo · opcional</summary>
                      <div className="mt-3"><Label htmlFor={`ref-samples-${reference.id}`}>Amostra coletada ou textos seus</Label><Textarea id={`ref-samples-${reference.id}`} rows={4} maxLength={4000} value={reference.samples} onChange={(e) => change({ samples: e.target.value })} placeholder="Acrescente exemplos se quiser refinar o guia." /></div>
                    </details>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="st-own-voice-title" className="border-t border-line pt-5">
        <h3 id="st-own-voice-title" className="mb-3 text-[14px] font-medium">Sua escrita</h3>
        <InstagramMapper handle={draft.handle} onHandleChange={(handle) => patch({ handle })} label="Seu @ no Instagram" onStart={() => { mappingBaseline.current = draft; }} onMapped={(result) => update((current) => mergeInstagramProfile(current, result, mappingBaseline.current))} evidence={instagramHandle(draft.voiceAnalysis?.handle ?? "") === instagramHandle(draft.handle) ? draft.voiceAnalysis : undefined} />
        <div className="mt-4 space-y-3">
          <div><Label htmlFor="st-samples">Ou cole textos seus</Label><Textarea id="st-samples" rows={6} value={draft.samples} onChange={(e) => patch({ samples: e.target.value })} placeholder="Cole 3 a 6 legendas, roteiros ou posts seus." /></div>
          <Button size="sm" disabled={learning || !draft.samples.trim()} onClick={() => void learnVoice()}>{learning ? <ThinkingOrb state="composing" size={20} theme="dark" aria-hidden /> : <Icon icon={AiMagicIcon} />}{learning ? "Analisando…" : "Aprender minha voz"}</Button>
        </div>
        {draft.voice && <details className="mt-3 rounded-[12px] border border-line p-3"><summary className="cursor-pointer text-[13px] text-ink-2">Revisar seu guia de escrita</summary><div className="mt-3"><Label htmlFor="st-voice">Como você escreve</Label><Textarea id="st-voice" rows={5} value={draft.voice} onChange={(e) => patch({ voice: e.target.value })} /></div></details>}
      </section>

      <details className="rounded-[14px] border border-line p-3.5">
        <summary className="cursor-pointer text-[13px] font-medium">Seus gostos e ajustes <span className="font-normal text-ink-3">· opcional</span></summary>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label htmlFor="st-about">Sobre o que você fala</Label><Input id="st-about" value={draft.about} onChange={(e) => patch({ about: e.target.value })} placeholder="IA aplicada, marketing…" /></div>
            <div><Label htmlFor="st-aud">Para quem</Label><Input id="st-aud" value={draft.audience} onChange={(e) => patch({ audience: e.target.value })} placeholder="Criadores, empreendedores…" /></div>
          </div>
          <div><Label htmlFor="st-goal">O que você quer provocar?</Label><Input id="st-goal" value={draft.goal ?? ""} maxLength={500} onChange={(e) => patch({ goal: e.target.value })} placeholder="Ensinar, gerar conversa, atrair clientes…" /></div>
          <div><Label htmlFor="st-preferences">Do que você gosta — e o que evita?</Label><Textarea id="st-preferences" rows={3} value={draft.preferences ?? ""} maxLength={1200} onChange={(e) => patch({ preferences: e.target.value })} placeholder="Exemplos práticos, humor seco. Sem tom de guru ou frases prontas." /></div>
          <div><Label htmlFor="st-cta">Chamada final preferida</Label><Input id="st-cta" value={draft.cta} onChange={(e) => patch({ cta: e.target.value })} placeholder="Salva e me segue para mais…" /></div>
          {!draft.voice && <div><Label htmlFor="st-voice-manual">Guia de escrita manual</Label><Textarea id="st-voice-manual" rows={4} value={draft.voice} onChange={(e) => patch({ voice: e.target.value })} placeholder="Seu tom, ritmo e vocabulário." /></div>}
          <Button size="sm" variant="ghost" disabled={references.length >= 5} onClick={() => update((current) => ({ ...current, styleReferences: [...(current.styleReferences ?? []), { id: uid(), name: "Referência manual", focus: "", samples: "", weight: 3 }].slice(0, 5) }))}><Icon icon={PlusSignIcon} />Adicionar referência manual</Button>
        </div>
      </details>
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
