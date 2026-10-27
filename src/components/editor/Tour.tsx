"use client";

import { useModKey } from "@/lib/client/shortcut";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Button } from "../ui/button";

const KEY = "arrasta:tour-done";

const STEPS = [
  {
    target: "stage",
    title: "Edite direto no slide",
    text: "Clique no texto de qualquer slide e escreva. Selecione palavras e aperte ⌘B para destacar. Arraste ou cole (⌘V) uma imagem no card.",
  },
  {
    target: "toolbar",
    title: "Formate como no Canva",
    text: "Fonte, tamanho, cores, espaçamento, alinhamento, imagem e fundo. Clique num texto do card para mudar só ele; clique na sua foto para trocar foto e nome.",
  },
  {
    target: "agent",
    title: "Peça ao ChatGPT",
    text: "Escreva o que quer mudar, no carrossel todo ou só no slide escolhido, e escolha o modelo e o ritmo ali do lado. Cada resposta diz o que mudou e dá para desfazer.",
  },
  {
    target: "export",
    title: "Baixe e poste",
    text: "Quando gostar, baixe os PNGs e a legenda. Modelos e proporção ficam em Design; as instruções do redator, em Ajustes.",
  },
];

export function tourDone() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

type Rect = { top: number; left: number; width: number; height: number };

/** Primeiro elemento visível com data-tour igual ao alvo. */
function findTarget(target: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
  return nodes.find((n) => {
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) ?? null;
}

/** Tour curto da primeira vez: holofote no elemento e um cartão explicando. */
export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const modKey = useModKey();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [agentRect, setAgentRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(240);
  const step = STEPS[index];

  const measureCard = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const measure = () => setCardHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Sem armazenamento: o tour pode voltar.
    }
    setIndex(0);
    onClose();
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const agent = findTarget("agent")?.getBoundingClientRect();
      setAgentRect(agent ? { top: agent.top, left: agent.left, width: agent.width, height: agent.height } : null);
      const el = findTarget(step.target);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      let top = Math.max(8, r.top);
      let left = Math.max(8, r.left);
      let right = Math.min(window.innerWidth - 8, r.right);
      let bottom = Math.min(window.innerHeight - 8, r.bottom);
      // A fileira pode ultrapassar a área rolável: ilumine só a parte visível.
      if (step.target === "stage") {
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          const bounds = parent.getBoundingClientRect();
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
            left = Math.max(left, bounds.left);
            right = Math.min(right, bounds.right);
          }
          if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
            top = Math.max(top, bounds.top);
            bottom = Math.min(bottom, bounds.bottom);
          }
        }
        if (agent) bottom = Math.min(bottom, agent.top - 16);
      }
      setRect({ top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const timer = setInterval(measure, 400);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearInterval(timer);
    };
  }, [open, step.target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") setIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open) return null;
  const pad = 8;
  const spot = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const cardWidth = Math.min(340, vw - 32);
  // Tente embaixo, em cima e dos lados, sem encobrir a barra de mudanças.
  const tall = spot ? spot.height > vh * 0.55 && vw > 700 : false;
  const centeredLeft = spot ? Math.min(Math.max(16, spot.left + spot.width / 2 - cardWidth / 2), vw - cardWidth - 16) : (vw - cardWidth) / 2;
  const sides = spot ? [
    { top: Math.min(Math.max(16, spot.top), vh - cardHeight - 16), left: spot.left - 16 - cardWidth },
    { top: Math.min(Math.max(16, spot.top), vh - cardHeight - 16), left: spot.left + spot.width + 16 },
  ] : [];
  const vertical = spot ? [
    { top: spot.top + spot.height + 12, left: centeredLeft },
    { top: spot.top - 12 - cardHeight, left: centeredLeft },
  ] : [];
  const overlapsAgent = (top: number, left: number) => step.target !== "agent" && agentRect
    && left < agentRect.left + agentRect.width + 12 && left + cardWidth > agentRect.left - 12
    && top < agentRect.top + agentRect.height + 12 && top + cardHeight > agentRect.top - 12;
  const candidates = [
    ...(tall ? [...sides, ...vertical] : [...vertical, ...sides]),
    { top: 16, left: centeredLeft },
    { top: vh - cardHeight - 16, left: centeredLeft },
    { top: 16, left: 16 },
    { top: 16, left: vw - cardWidth - 16 },
  ];
  const avoidAgent = step.target !== "agent" && agentRect;
  const aboveAgent = avoidAgent ? Math.max(0, agentRect.top - 28) : vh - 32;
  const belowAgent = avoidAgent ? Math.max(0, vh - agentRect.top - agentRect.height - 28) : 0;
  const fallback = aboveAgent >= belowAgent
    ? { top: 16, left: centeredLeft }
    : { top: agentRect!.top + agentRect!.height + 12, left: centeredLeft };
  const position = candidates.find(({ top, left }) => top >= 16 && left >= 16
    && top + cardHeight <= vh - 16 && left + cardWidth <= vw - 16 && !overlapsAgent(top, left))
    ?? fallback;
  const maxHeight = avoidAgent && position.left < agentRect.left + agentRect.width + 12
    && position.left + cardWidth > agentRect.left - 12 && position.top < agentRect.top
    ? Math.max(0, agentRect.top - position.top - 12)
    : vh - position.top - 16;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Tour rápido do editor">
      <button className="absolute inset-0 cursor-default" aria-label="Fechar o tour" onClick={finish} />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed rounded-[18px]"
        initial={false}
        animate={spot ?? { top: vh / 2, left: vw / 2, width: 0, height: 0 }}
        transition={{ type: "spring", duration: 0.45, bounce: 0.12 }}
        style={{ boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.45), 0 0 0 2px rgb(255 255 255 / 0.85)" }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          ref={measureCard}
          key={index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="glass fixed overflow-y-auto rounded-[18px] p-4"
          style={{ top: position.top, left: position.left, width: cardWidth, maxHeight }}
        >
          <p className="text-[11.5px] font-medium tabular-nums text-ink-3">
            {index + 1} de {STEPS.length}
          </p>
          <p className="mt-1 text-[15px] font-semibold tracking-[-0.01em]">{step.title}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{step.text.replaceAll("⌘", modKey)}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex gap-1.5" aria-hidden>
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/25"}`} />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={finish}>
                Pular
              </Button>
              <Button size="sm" variant="primary" onClick={() => (index < STEPS.length - 1 ? setIndex(index + 1) : finish())}>
                {index < STEPS.length - 1 ? "Próximo" : "Começar"}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
