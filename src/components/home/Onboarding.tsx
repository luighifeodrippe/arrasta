"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/app-store";
import { mergeInstagramProfile } from "@/lib/client/instagram-mapping";
import { InstagramMapper } from "../app/InstagramMapper";
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
  const reducedMotion = useReducedMotion();
  const auth = useApp((s) => s.auth);
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const setLoginOpen = useApp((s) => s.setLoginOpen);
  const openSettings = useApp((s) => s.openSettings);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [skipVoice, setSkipVoice] = useState(false);
  const [writingSeen, setWritingSeen] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const mappingBaseline = useRef(profile);

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
      text: "Entre com a sua conta para o ChatGPT escrever por você.",
      done: auth.connected,
    },
    {
      id: "voice",
      title: "Ensine sua voz",
      text: "Informe seu @ ou cole legendas e roteiros seus.",
      done: Boolean(profile.voice.trim()) || skipVoice,
    },
    {
      id: "writing",
      title: "Ajuste ao seu gosto",
      text: "Combine outros perfis como referência ou ajuste seus gostos. Seu guia já está pronto para usar.",
      done: writingSeen,
    },
    {
      id: "link",
      title: "Crie seu primeiro carrossel",
      text: "Cole um texto, envie prints ou um link.",
      done: hasProjects,
    },
  ];
  if (steps.every((s) => s.done)) return null;
  const current = steps.find((s) => !s.done)?.id;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
      className="home-onboarding"
      aria-label="Primeiros passos"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-semibold">Comece em {steps.length} passos</p>
        <button
          onClick={() => {
            writeFlag(DONE_KEY);
            setDismissed(true);
          }}
          className="shrink-0 rounded-md py-1 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
        >
          Pular guia
        </button>
      </div>
      <div className="mb-1 mt-3 flex items-center gap-3">
        <span className="text-[13px] tabular-nums text-ink-3">{doneCount} de {steps.length} feitos</span>
        <div className="home-guide-progress" role="progressbar" aria-label="Passos concluídos" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
          <span style={{ transform: `scaleX(${doneCount / steps.length})` }} />
        </div>
      </div>
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const active = step.id === current;
          return (
            <li key={step.id} className="home-guide-step">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "home-guide-number",
                    step.done ? "home-guide-done" : active ? "home-guide-current" : "home-guide-pending",
                  )}
                >
                  {step.done ? <Icon icon={Tick02Icon} className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[15px] font-semibold", step.done ? "text-ink-3" : "text-ink")}>
                    {step.title}
                    {(step.id === "voice" || step.id === "writing") && !step.done && <span className="ml-1.5 text-[13px] font-normal text-ink-3">opcional</span>}
                  </p>
                  <AnimatePresence initial={false}>
                    {active && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: reducedMotion ? 0 : 0.25, ease: [0.23, 1, 0.32, 1] }}
                        className="home-guide-details"
                      >
                        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{step.text}</p>
                        <div className="mt-[14px] flex flex-wrap items-center gap-2">
                          {step.id === "chatgpt" && (
                            <Button variant="lit" size="sm" onClick={() => setLoginOpen(true)}>
                              Entrar com ChatGPT
                            </Button>
                          )}
                          {step.id === "voice" && <div className="w-full space-y-2">
                            <InstagramMapper
                              buttonVariant="lit"
                              handle={handle ?? profile.handle}
                              onHandleChange={setHandle}
                              onStart={() => { mappingBaseline.current = useApp.getState().profile; }}
                              onMapped={async (result) => {
                                const currentProfile = useApp.getState().profile;
                                if (!currentProfile || !mappingBaseline.current) return;
                                const next = mergeInstagramProfile(currentProfile, result, mappingBaseline.current);
                                const saved = await api.saveProfile(next);
                                const latest = useApp.getState().profile;
                                setProfile(latest === currentProfile ? saved : latest ? mergeInstagramProfile(latest, result, mappingBaseline.current) : saved);
                              }}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" variant="glass" className="home-pill h-9 rounded-full px-4 text-[14px]" onClick={() => openSettings("voz")}>Colar meus textos</Button>
                              <Button size="sm" variant="ghost" className="h-9" onClick={() => { writeFlag(SKIP_VOICE_KEY); setSkipVoice(true); }}>Agora não</Button>
                            </div>
                          </div>}
                          {step.id === "writing" && (
                            <>
                              <Button
                                variant="lit"
                                size="sm"
                                onClick={() => {
                                  openSettings("voz");
                                  writeFlag(WRITING_KEY);
                                  setWritingSeen(true);
                                }}
                              >
                                Ajustar minha voz
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9"
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
                            <Button variant="lit" size="sm" onClick={onPaste}>
                              Começar
                            </Button>
                          )}
                        </div>
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
