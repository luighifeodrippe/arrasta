"use client";

import { identityOf, useApp } from "@/lib/client/app-store";
import { defaultDesign, makeSlide } from "@/lib/defaults";
import type { Design, Slide } from "@/lib/types";
import { SlideCanvas, SlideFrame } from "../slide/SlideCanvas";
import { Marquee } from "../ui/marquee";

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

export function Showcase() {
  const profile = useApp((s) => s.profile);
  const identity = identityOf(profile);
  return (
    <div aria-hidden className="relative left-1/2 w-screen -translate-x-1/2 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <Marquee pauseOnHover repeat={2} className="[--duration:70s] [--gap:20px] py-4">
        {SLIDES.map(({ design, slide }, i) => (
          <div
            key={i}
            className="w-[150px] shrink-0 overflow-hidden rounded-[14px] shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_24px_50px_-24px_rgb(0_0_0/0.9)] sm:w-[196px]"
          >
            <SlideFrame>
              <SlideCanvas slide={slide} index={0} total={7} design={design} identity={identity} />
            </SlideFrame>
          </div>
        ))}
      </Marquee>
    </div>
  );
}
