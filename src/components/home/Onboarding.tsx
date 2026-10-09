"use client";

import { AtIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ThinkingOrb } from "thinking-orbs";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/app-store";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Icon } from "@/components/ui/icon";

const DONE_KEY = "arrasta:onboarding-done";
const SKIP_VOICE_KEY = "arrasta:skip-voice";
const WRITING_KEY = "arrasta:writing-seen";

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Navegador sem armazenamento: o guia volta na próxima visita.
  }
}

/** Guia de primeira vez: conexão, perfil, gostos e primeira criação. */
export function Onboarding({ hasProjects, onPaste }: { hasProjects: boolean; onPaste: () => void }) {
  const auth = useApp((s) => s.auth);
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const setLoginOpen = useApp((s) => s.setLoginOpen);
  const openSettings = useApp((s) => s.openSettings);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [skipVoice, setSkipVoice] = useState(false);
  const [writingSeen, setWritingSeen] = useState(false);
  const [handle, setHandle] = useState("");
  const [learning, setLearning] = useState<string | null>(null);
  const [importError, setImportError] = useState("");

  useEffect(() => {
    setMounted(true);
    setDismissed(readFlag(DONE_KEY));
    setSkipVoice(readFlag(SKIP_VOICE_KEY));
    setWritingSeen(readFlag(WRITING_KEY));
  }, []);

  if (!mounted || !auth || !profile || dismissed) return null;

  const steps = [
    {
      id: "chatgpt",
      title: "Conecte o ChatGPT",
      text: "É ele quem lê e escreve. Usa o seu plano, sem chave de API.",
      done: auth.connected,
    },
    {
      id: "voice",
      title: "Traga seu perfil",
      text: "Busque nome, foto e algumas legendas públicas pelo @. A leitura depende do que o Instagram disponibilizar.",
      done: Boolean(profile.handle.trim()) || skipVoice,
    },
    {
      id: "writing",
      title: "Defina sua voz",
      text: "Sobre o que você fala, para quem, o que quer provocar e quais estilos admira. Seus exemplos deixam o texto mais próximo de você.",
      done: Boolean(profile.about.trim() && (profile.voice.trim() || profile.preferences?.trim())) || writingSeen,
    },
    {
      id: "link",
      title: "Cole seu primeiro link",
      text: "Um carrossel que viralizou, um vídeo do YouTube, um post do X ou um artigo.",
      done: hasProjects,
    },
  ];
  if (steps.every((s) => s.done)) return null;
  const current = steps.find((s) => !s.done)?.id;
  const doneCount = steps.filter((s) => s.done).length;

  const learn = async () => {
    if (!handle.trim()) return;
    setImportError("");
    try {
      setLearning("Buscando dados públicos");
      const data = await api.profileFromInstagram(handle);
      const next = { ...profile, handle: data.handle, name: data.imported.name ? data.name : profile.name || data.handle, avatar: data.avatar ?? profile.avatar, verified: data.verified, followers: data.followers, samples: data.samples || profile.samples };
      setProfile(await api.saveProfile(next));
      toast.success(data.notice);
    } catch (error) {
      setImportError((error as Error).message);
    } finally {
      setLearning(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
      className="glass mt-8 w-full max-w-[560px] rounded-[20px] p-2 text-left"
      aria-label="Primeiros passos"
    >
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
        <p className="text-[13.5px] font-medium">
          Comece em {steps.length} passos{" "}
          <span className="font-normal text-ink-3">
            · {doneCount} de {steps.length}
          </span>
        </p>
        <button
          onClick={() => {
            writeFlag(DONE_KEY);
            setDismissed(true);
          }}
          className="rounded-[8px] px-2 py-1 text-[12.5px] text-ink-3 transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          Pular guia
        </button>
      </div>
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const active = step.id === current;
          return (
            <li key={step.id} className={cn("rounded-[14px] px-3 py-2.5 transition-colors", active && "bg-white/[0.045]")}>
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-px grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums",
                    step.done ? "bg-white/[0.12] text-ink" : active ? "keycap" : "border border-white/[0.12] text-ink-3",
                  )}
                >
                  {step.done ? <Icon icon={Tick02Icon} className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[14px] font-medium", step.done ? "text-ink-3 line-through decoration-white/20" : "text-ink")}>
                    {step.title}
                    {(step.id === "voice" || step.id === "writing") && !step.done && <span className="ml-1.5 text-[12px] font-normal text-ink-3">opcional</span>}
                  </p>
                  <AnimatePresence initial={false}>
                    {active && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{step.text}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 pb-0.5">
                          {step.id === "chatgpt" && (
                            <Button variant="primary" size="sm" onClick={() => setLoginOpen(true)}>
                              Entrar com ChatGPT
                            </Button>
                          )}
                          {step.id === "voice" &&
                            (learning ? (
                              <span className="flex h-8 items-center gap-2.5 text-[13px] text-ink-2">
                                <ThinkingOrb state="composing" size={20} theme="dark" aria-hidden />
                                <span className="arrasta-shimmer-text">{learning}…</span>
                              </span>
                            ) : (
                              <>
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void learn();
                                  }}
                                  className="field flex h-8 items-center pl-2.5 pr-1"
                                >
                                  <Icon icon={AtIcon} className="size-3.5 text-ink-3" />
                                  <input
                                    value={handle}
                                    onChange={(e) => setHandle(e.target.value.replace(/^@+/, ""))}
                                    placeholder="seuperfil"
                                    aria-label="Seu @ do Instagram"
                                    aria-invalid={Boolean(importError)}
                                    aria-describedby={importError ? "onboarding-instagram-error" : undefined}
                                    autoCapitalize="none"
                                    autoComplete="off"
                                    className="h-full w-36 bg-transparent px-1.5 text-[13px] outline-none placeholder:text-ink-3"
                                  />
                                </form>
                                <Button size="sm" variant="primary" onClick={learn} disabled={!handle.trim()}>
                                  Buscar perfil
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openSettings("perfil")}>Preencher manualmente</Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    writeFlag(SKIP_VOICE_KEY);
                                    setSkipVoice(true);
                                  }}
                                >
                                  Agora não
                                </Button>
                              </>
                            ))}
                          {step.id === "writing" && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  openSettings("voz");
                                }}
                              >
                                Definir minha voz
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  writeFlag(WRITING_KEY);
                                  setWritingSeen(true);
                                }}
                              >
                                Agora não
                              </Button>
                            </>
                          )}
                          {step.id === "link" && (
                            <Button variant="primary" size="sm" onClick={onPaste}>
                              Colar um link
                            </Button>
                          )}
                        </div>
                        {step.id === "voice" && importError && <p id="onboarding-instagram-error" role="alert" className="mt-2 text-[12px] leading-relaxed text-red-300">{importError} Você pode preencher o perfil manualmente.</p>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
}
