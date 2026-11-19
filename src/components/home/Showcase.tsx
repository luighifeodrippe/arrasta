"use client";

import { identityOf, useApp } from "@/lib/client/app-store";
import { defaultDesign, makeSlide, TEMPLATES } from "@/lib/defaults";
import type { Design, Slide } from "@/lib/types";
import { SlideCanvas, SlideFrame } from "../slide/SlideCanvas";

/** Slides de exemplo, um de cada modelo, com o nome e a foto de quem está usando. */
const DEMO: { design: Partial<Design>; slide: Partial<Slide> }[] = [
  { design: { template: "perfil", theme: "light" }, slide: { kind: "cover", title: "Ninguém lê o slide 2 se o **slide 1** não prender." } },
  { design: { template: "neon", theme: "dark" }, slide: { kind: "cover", title: "Uma boa referência ensina **estrutura**.", body: "Entenda o ritmo. Conte a sua história." } },
  { design: { template: "notas", theme: "light" }, slide: { kind: "list", title: "Checklist do carrossel que **segura**", body: "1. Gancho em até 12 palavras\n2. Uma ideia por slide\n3. Chamada no último" } },
  { design: { template: "revista", theme: "light", font: "instrument" }, slide: { kind: "quote", title: "Carrossel bom não tem **design**. Tem ritmo." } },
  { design: { template: "editorial", theme: "dark" }, slide: { kind: "content", title: "**7 slides.** Uma ideia em cada.", body: "O resto é enfeite." } },
  { design: { template: "foto", theme: "dark" }, slide: { kind: "cover", title: "Sua próxima ideia vira **carrossel**." } },
  { design: { template: "minimal", theme: "light", align: "center" }, slide: { kind: "content", title: "Pare de escrever legenda. Comece a escrever **gancho**." } },
  { design: { template: "perfil", theme: "dark" }, slide: { kind: "content", title: "O segundo card também pode ser **a entrada**.", body: "O Instagram pode reapresentar o post por outra imagem. Faça cada começo valer." } },
];

const SLIDES = DEMO.map((d) => ({ design: defaultDesign({ showCounter: false, ...d.design }), slide: makeSlide(d.slide) }));

export function Showcase({ onChoose, disabled = false }: { onChoose: (design: Partial<Design>) => void; disabled?: boolean }) {
  const profile = useApp((s) => s.profile);
  const identity = identityOf(profile);
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      <div role="group" aria-label="Escolher um modelo" className="flex gap-5 overflow-x-auto px-(--home-margin) pb-4 pt-1">
        {SLIDES.map(({ design, slide }, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChoose(DEMO[i].design)}
            className="control w-[150px] shrink-0 rounded-[18px] p-1 text-left transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-45 sm:w-[196px]"
          >
            <div aria-hidden className="pointer-events-none overflow-hidden rounded-[14px]">
              <SlideFrame>
                <SlideCanvas slide={slide} index={0} total={7} design={design} identity={identity} />
              </SlideFrame>
            </div>
            <span className="block px-2 py-2 text-[13px] font-medium">Usar {TEMPLATES.find((template) => template.id === design.template)?.name} · {design.theme === "light" ? "claro" : "escuro"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
