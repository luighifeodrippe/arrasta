"use client";

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
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[index];

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
      const el = findTarget(step.target);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
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
  const cardHeight = 190;
  // Alvo alto (um painel inteiro): o cartão vai ao lado. Senão, embaixo se couber, ou em cima; sempre dentro da tela.
  const tall = spot ? spot.height > vh * 0.55 && vw > 700 : false;
  const below = spot ? spot.top + spot.height + 12 + cardHeight < vh : true;
  let cardTop = vh / 2 - cardHeight / 2;
  let cardLeft = vw / 2 - cardWidth / 2;
  if (spot && tall) {
    const leftSide = spot.left - 16 - cardWidth > 16;
    cardLeft = leftSide ? spot.left - 16 - cardWidth : Math.min(spot.left + spot.width + 16, vw - cardWidth - 16);
    cardTop = Math.min(Math.max(16, spot.top + 80), vh - cardHeight - 16);
  } else if (spot) {
    cardTop = below ? spot.top + spot.height + 12 : Math.max(16, spot.top - 12 - cardHeight);
    cardLeft = Math.min(Math.max(16, spot.left + spot.width / 2 - cardWidth / 2), vw - cardWidth - 16);
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Tour rápido do editor">
      <button className="absolute inset-0 cursor-default" aria-label="Fechar o tour" onClick={finish} />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed rounded-[18px]"
        initial={false}
        animate={spot ?? { top: vh / 2, left: vw / 2, width: 0, height: 0 }}
        transition={{ type: "spring", duration: 0.45, bounce: 0.12 }}
        style={{ boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.62), 0 0 0 2px rgb(255 255 255 / 0.85)" }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="glass fixed rounded-[18px] p-4"
          style={{ top: cardTop, left: cardLeft, width: cardWidth }}
        >
          <p className="text-[11.5px] font-medium tabular-nums text-ink-3">
            {index + 1} de {STEPS.length}
          </p>
          <p className="mt-1 text-[15px] font-semibold tracking-[-0.01em]">{step.title}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{step.text}</p>
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
