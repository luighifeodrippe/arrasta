import type { CarouselFormat, CarouselSource, Design, FontId, Profile, Project, RemixLevel, Slide, SlideImage, SlideKind, SlideSize, TemplateId, TextAlign, TextStyle, WritingSettings } from "./types";

export const APP_NAME = "Arrasta AI";

/** Largura real de exportação; a altura vem da proporção escolhida. */
export const SLIDE_W = 1080;
export const MAX_SLIDES = 20;

export const SLIDE_SIZES: { id: SlideSize; height: number; hint: string }[] = [
  { id: "3:4", height: 1440, hint: "1080×1440 · aparece inteiro na grade do perfil" },
  { id: "4:5", height: 1350, hint: "1080×1350 · o retrato clássico do feed" },
];

export function slideHeight(size: SlideSize | undefined): number {
  return size === "4:5" ? 1350 : 1440;
}

/** Largura do card sem ultrapassar o espaço disponível no editor. */
export function fitSlideWidth(size: SlideSize, width: number, height: number, preferredWidth = SLIDE_W): number {
  return Math.max(0, Math.floor(Math.min(width, height * SLIDE_W / slideHeight(size), preferredWidth)));
}

/** Completa um card quase inteiro na borda, sem reduzir o zoom em mais de 12%. */
export function fitRowSlideWidth(width: number, available: number, count: number, gap = 20): number {
  if (width <= 0 || available <= 0) return width;
  const fullCards = Math.floor((available + gap) / (width + gap));
  const visible = available - fullCards * (width + gap);
  if (fullCards >= count || visible <= width * 0.8 || visible >= width) return width;
  const fitted = Math.floor((available - fullCards * gap) / (fullCards + 1));
  return fitted >= width * 0.88 ? fitted : width;
}

export const TEMPLATES: { id: TemplateId; name: string; hint: string }[] = [
  { id: "perfil", name: "Perfil", hint: "Estilo post de texto, com foto e @" },
  { id: "editorial", name: "Editorial", hint: "Título grande e destaque em cor" },
  { id: "foto", name: "Foto", hint: "Imagem de fundo com texto por cima" },
  { id: "minimal", name: "Minimal", hint: "Centralizado, limpo" },
  { id: "neon", name: "Neon", hint: "Escuro, destaque brilhando como neon" },
  { id: "notas", name: "Notas", hint: "App de notas, com marca-texto" },
  { id: "revista", name: "Revista", hint: "Serifa, número grande e itálico" },
  { id: "poster", name: "Pôster", hint: "Tipografia forte, cor e moldura" },
  { id: "caderno", name: "Caderno", hint: "Papel pautado e anotações" },
];

export const FONTS: { id: FontId; name: string; cssVar: string; weight: number }[] = [
  { id: "inter", name: "Inter", cssVar: "--font-inter", weight: 700 },
  { id: "montserrat", name: "Montserrat", cssVar: "--font-montserrat", weight: 800 },
  { id: "poppins", name: "Poppins", cssVar: "--font-poppins", weight: 700 },
  { id: "bricolage", name: "Bricolage", cssVar: "--font-bricolage", weight: 800 },
  { id: "space", name: "Space Grotesk", cssVar: "--font-space", weight: 700 },
  { id: "instrument", name: "Instrument", cssVar: "--font-instrument", weight: 400 },
  { id: "playfair", name: "Playfair", cssVar: "--font-playfair", weight: 700 },
  { id: "dmserif", name: "DM Serif", cssVar: "--font-dmserif", weight: 400 },
  { id: "anton", name: "Anton", cssVar: "--font-anton", weight: 400 },
  { id: "caveat", name: "Caveat", cssVar: "--font-caveat", weight: 700 },
];

/** Fontes com serifa: os modelos ajustam espaçamento e itálico para elas. */
export const SERIF_FONTS: FontId[] = ["instrument", "playfair", "dmserif"];

export const ACCENTS = ["#ff3500", "#1d9bf0", "#7c3aed", "#16a34a", "#eab308", "#ec4899", "#0a0a0a", "#ffffff"];

export const SLIDE_KINDS: { id: SlideKind; name: string }[] = [
  { id: "cover", name: "Capa" },
  { id: "content", name: "Conteúdo" },
  { id: "list", name: "Lista" },
  { id: "quote", name: "Citação" },
  { id: "cta", name: "Final" },
];

export function textStyle(partial?: Partial<TextStyle> | null): TextStyle {
  return { color: null, align: null, size: null, leading: null, tracking: null, ...partial };
}

export function defaultDesign(partial?: Partial<Design>): Design {
  return {
    template: "perfil",
    theme: "light",
    font: "inter",
    accent: "#ff3500",
    background: null,
    textScale: 1,
    align: "left",
    size: "3:4",
    titleFont: null,
    bodyFont: null,
    gap: 1,
    showProfile: true,
    showCounter: false,
    showSwipe: true,
    ...partial,
    titleStyle: textStyle(partial?.titleStyle),
    bodyStyle: textStyle(partial?.bodyStyle),
  };
}

/** listProjects já entrega primeiro o carrossel editado mais recentemente. */
export function initialDesign(projects: readonly Pick<Project, "design">[]): Design {
  return defaultDesign(projects[0]?.design);
}

export function defaultProfile(): Profile {
  return {
    name: "",
    handle: "",
    avatar: null,
    verified: false,
    about: "",
    audience: "",
    voice: "",
    samples: "",
    cta: "",
    followers: null,
    goal: "",
    preferences: "",
    styleReferences: [],
  };
}

/** Perfis antigos continuam válidos; referências incompletas podem ser salvas como rascunho. */
export function normalizeProfile(profile: Partial<Profile>): Profile {
  const references = Array.isArray(profile.styleReferences) ? profile.styleReferences : [];
  return {
    ...defaultProfile(),
    ...profile,
    handle: typeof profile.handle === "string" ? profile.handle.replace(/^@+/, "").trim() : "",
    goal: typeof profile.goal === "string" ? profile.goal.slice(0, 500) : "",
    preferences: typeof profile.preferences === "string" ? profile.preferences.slice(0, 1200) : "",
    voiceAnalysis: profile.voiceAnalysis && typeof profile.voiceAnalysis.handle === "string" && typeof profile.voiceAnalysis.analyzedAt === "string" ? {
      handle: profile.voiceAnalysis.handle.replace(/^@+/, "").slice(0, 30),
      analyzedAt: profile.voiceAnalysis.analyzedAt,
      sampleCount: Math.min(6, Math.max(0, Number(profile.voiceAnalysis.sampleCount) || 0)),
      imageCount: Math.min(4, Math.max(0, Number(profile.voiceAnalysis.imageCount) || 0)),
      sourceUrls: Array.isArray(profile.voiceAnalysis.sourceUrls) ? profile.voiceAnalysis.sourceUrls.filter((url) => typeof url === "string" && /^https:\/\/www\.instagram\.com\/p\/[\w-]+\/$/.test(url)).slice(0, 6) : [],
    } : undefined,
    styleReferences: references.filter((reference) => reference && typeof reference === "object").slice(0, 5).map((reference, index) => ({
      id: typeof reference.id === "string" && reference.id ? reference.id : `reference-${index}`,
      name: typeof reference.name === "string" ? reference.name.slice(0, 100) : "",
      focus: typeof reference.focus === "string" ? reference.focus.slice(0, 500) : "",
      samples: typeof reference.samples === "string" ? reference.samples.slice(0, 4000) : "",
      weight: Number.isFinite(reference.weight) ? Math.min(5, Math.max(1, Math.round(reference.weight))) : 3,
      handle: typeof reference.handle === "string" ? reference.handle.replace(/^@+/, "").slice(0, 30) : "",
      avatar: typeof reference.avatar === "string" ? reference.avatar : null,
      guide: typeof reference.guide === "string" ? reference.guide.slice(0, 1800) : "",
      analyzedAt: typeof reference.analyzedAt === "string" ? reference.analyzedAt : null,
      sampleCount: Number.isFinite(reference.sampleCount) ? Math.min(6, Math.max(0, reference.sampleCount!)) : 0,
      imageCount: Number.isFinite(reference.imageCount) ? Math.min(4, Math.max(0, reference.imageCount!)) : 0,
    })),
  };
}

export function uid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export function makeSlide(partial?: Partial<Slide>): Slide {
  return {
    id: uid(),
    kind: "content",
    title: "",
    body: "",
    image: null,
    background: null,
    valign: null,
    gap: null,
    ...partial,
    offsets: partial?.offsets ?? {},
    titleStyle: textStyle(partial?.titleStyle),
    bodyStyle: textStyle(partial?.bodyStyle),
  };
}

export function makeImage(src: string, partial?: Partial<SlideImage>): SlideImage {
  return { src, fit: "cover", focusX: 50, focusY: 50, zoom: 1, mode: "inline", ...partial };
}

export const REMIX_LEVELS: { id: RemixLevel; name: string; hint: string }[] = [
  { id: "manter", name: "Nada", hint: "Mantém o texto original e só refaz o design." },
  { id: "pouco", name: "Pouco", hint: "Mesma estrutura, mesmo gancho e mesmo tamanho. Muda as palavras para a sua voz." },
  { id: "medio", name: "Médio", hint: "Mesma estrutura, com exemplos e ângulo do seu nicho." },
  { id: "muito", name: "Muito", hint: "Usa o original só como inspiração." },
];

export function emptySource(kind: CarouselSource["kind"]): CarouselSource {
  return {
    kind,
    url: null,
    author: null,
    caption: "",
    slides: [],
    likes: null,
    comments: null,
    brief: null,
    analysis: null,
    title: null,
    text: null,
    site: null,
    media: [],
    style: null,
    duration: null,
    formatId: null,
  };
}

/** Projetos salvos por versões anteriores ganham os campos novos com valores padrão. */
export function normalizeProject(project: Project): Project {
  return {
    ...project,
    design: defaultDesign(project.design),
    slides: (project.slides ?? []).map((slide) => {
      // Versões anteriores guardavam cor e alinhamento em campos soltos.
      const old = slide as Slide & { titleColor?: string | null; bodyColor?: string | null; titleAlign?: TextAlign | null; bodyAlign?: TextAlign | null };
      const { titleColor, bodyColor, titleAlign, bodyAlign, ...rest } = old;
      return makeSlide({
        ...rest,
        image: slide.image ? makeImage(slide.image.src, slide.image) : null,
        titleStyle: { ...textStyle({ color: titleColor ?? null, align: titleAlign ?? null }), ...slide.titleStyle },
        bodyStyle: { ...textStyle({ color: bodyColor ?? null, align: bodyAlign ?? null }), ...slide.bodyStyle },
      });
    }),
    source: project.source ? { ...emptySource(project.source.kind), ...project.source, media: project.source.media ?? [] } : null,
    chat: project.chat ?? [],
    images: project.images ?? [],
  };
}

export function fontVar(id: FontId): string {
  return `var(${(FONTS.find((f) => f.id === id) ?? FONTS[0]).cssVar})`;
}

export function fontWeight(id: FontId): number {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).weight;
}

/**
 * Formatos que já vêm no Arrasta. Os da pessoa (clones do Dify, por exemplo) ficam em data/formats.
 */
export const BUILTIN_FORMATS: CarouselFormat[] = [
  {
    id: "storytelling",
    name: "Storytelling",
    description: "Uma história com gancho, conflito, virada e lição. Ótimo para vídeos e casos reais.",
    origin: "builtin",
    createdAt: "2026-10-08T00:00:00.000Z",
    prompt: `Carrossel narrativo: conta uma história que prende do primeiro ao último slide e termina numa lição útil para quem segue o perfil.

Estrutura, de 7 a 10 slides:
1. Gancho de cena (capa): comece no meio da ação ou num contraste forte. Uma frase curta que abre uma pergunta na cabeça de quem lê. Nada de "neste carrossel" ou "você sabia".
2. Contexto: quem, onde e quando. Só o necessário para entender a história.
3. Conflito: o problema, o erro ou o obstáculo, e o que estava em jogo.
4. Tensão: a tentativa que deu errado ou o momento de dúvida, com detalhes concretos (números, falas, objetos).
5. Virada: a descoberta, a decisão ou o fato que muda tudo.
6. Resultado: o que mudou, com um dado ou exemplo concreto.
7. Lição: o que isso ensina para quem lê, em linguagem direta.
8. Aplicação: como usar isso hoje, em até 3 passos (pode ser um slide de lista).
9. Fechamento (final): uma frase que amarra o começo e o fim, e a chamada.

Regras de escrita:
- Cada slide termina puxando o próximo: uma pergunta aberta, um "mas", um "foi aí que".
- Frases curtas. Título com até 12 palavras; texto com até 40 palavras por slide.
- Use os fatos, nomes e números do conteúdo de origem. Não invente nada.
- Primeira pessoa quando a história é do próprio perfil; terceira quando é de outra pessoa ou empresa.
- Destaque só a palavra-chave de cada slide.`,
  },
  {
    id: "lista",
    name: "Lista de dicas",
    description: "Um número na capa e uma dica prática por slide, para consultar depois.",
    origin: "builtin",
    createdAt: "2026-10-08T00:00:00.000Z",
    prompt: `Carrossel de lista: promete um número de dicas na capa e entrega uma dica por slide.

Estrutura:
1. Capa: o número e a promessa ("7 jeitos de…", "5 erros que…"), em até 10 palavras.
2. Um slide de contexto curto: por que isso importa agora.
3. Uma dica por slide, numerada no título ("1. …"). O título diz a dica; o texto explica como aplicar, com um exemplo concreto.
4. Último slide: um resumo de uma linha e a chamada (salvar para consultar depois).

Regras:
- As dicas vão da mais fácil de aplicar para a mais poderosa.
- Cada dica é acionável hoje, sem depender de ferramenta paga.
- Nada de dica genérica ("tenha consistência"): diga o que fazer, quanto e quando.`,
  },
  {
    id: "passo-a-passo",
    name: "Passo a passo",
    description: "Tutorial em etapas numeradas, do zero ao resultado. Bom para ensinar um processo.",
    origin: "builtin",
    createdAt: "2026-10-08T00:00:00.000Z",
    prompt: `Carrossel tutorial: leva quem lê do zero ao resultado, em etapas.

Estrutura:
1. Capa: o resultado final e o tempo ou esforço ("Como fazer X em 10 minutos").
2. O que você precisa: ferramentas ou pré-requisitos, em lista curta.
3. Um passo por slide, com o número no título ("Passo 1: …") e o texto dizendo exatamente o que fazer, onde clicar ou o que escrever.
4. Um slide com o erro mais comum e como evitar.
5. Último slide: o resultado esperado e a chamada.

Regras:
- Verbos no imperativo, uma ação por passo.
- Use os nomes reais de botões, comandos e ferramentas que estão no conteúdo.
- Se o conteúdo tiver números (tempo, preço, quantidade), mantenha.`,
  },
  {
    id: "mitos",
    name: "Mitos e verdades",
    description: "Quebra crenças comuns do nicho, uma por slide, com o que é verdade no lugar.",
    origin: "builtin",
    createdAt: "2026-10-08T00:00:00.000Z",
    prompt: `Carrossel de mitos e verdades: derruba crenças comuns e mostra o que funciona de verdade.

Estrutura:
1. Capa: provoca ("Você ainda acredita nisso sobre…?").
2. Um mito por slide: o título traz o mito entre aspas, marcado como mito; o texto explica a verdade, com um dado ou exemplo do conteúdo.
3. Penúltimo slide: a verdade mais importante, a que muda o jogo.
4. Último slide: a chamada (comentar qual mito a pessoa acreditava).

Regras:
- De 4 a 6 mitos, do mais comum ao mais surpreendente.
- Tom firme e respeitoso: corrige a ideia, nunca a pessoa.
- Não invente estudos ou números; use só o que está no conteúdo.`,
  },
  {
    id: "prompts",
    name: "Carrossel de prompts",
    description: "Um pedido pronto para o ChatGPT por slide, com o benefício na frente.",
    origin: "builtin",
    createdAt: "2026-10-27T00:00:00.000Z",
    prompt: `Carrossel de prompts: cada slide entrega um pedido pronto para usar no ChatGPT, com o benefício na frente.

Estrutura, de 8 a 10 slides:
1. Capa: uma afirmação forte ou um contraste sobre o assunto e a promessa com número. Exemplo de tom: "O ChatGPT não vai roubar o seu trabalho. Vai tirar dele as partes mais chatas. Estes 8 prompts te poupam horas de tarefa repetitiva."
2. Do slide 2 ao penúltimo, um prompt por slide, começando pelo mais surpreendente e fácil:
   - título: o número e o resultado (ex.: "1. Simplifique textos difíceis");
   - texto: uma frase com o benefício e, depois, o prompt entre aspas, escrito como uma pessoa pediria: o que quer, o contexto e o que deve receber de volta, com as partes a trocar entre colchetes [assim];
   - até 30 palavras fora do prompt; o prompt com até 45 palavras.
3. Último slide: um pedido só (salvar para usar depois ou mandar para quem precisa).

Regras:
- Sem emojis e sem jargão técnico.
- Prompt útil de verdade, que funciona colado como está; nada de "aja como um especialista" vazio.
- Não prometa resultado garantido nem invente recurso de ferramenta.`,
  },
  {
    id: "ferramentas",
    name: "Carrossel de ferramentas",
    description: "Uma ferramenta por slide: o que ela resolve e como usar hoje.",
    origin: "builtin",
    createdAt: "2026-10-27T00:00:00.000Z",
    prompt: `Carrossel de ferramentas: cada slide apresenta uma ferramenta (site, app ou extensão) e o que ela resolve.

Estrutura, de 8 a 10 slides:
1. Capa: um dado do conteúdo ou um contraste que abre a lacuna, e a promessa com número. Exemplo de tom: "Quase ninguém usa as extensões de IA do navegador. Aqui estão 7 que economizam horas."
2. Do slide 2 ao penúltimo, uma ferramenta por slide, começando pela mais surpreendente e fácil de testar (de preferência grátis e sem instalar nada):
   - título: o número e o nome da ferramenta (ex.: "1. Nome da ferramenta");
   - texto: o que ela faz e um uso prático do dia a dia, em até 30 palavras.
3. Último slide: um pedido só (salvar a lista ou mandar para quem precisa).

Regras:
- Use só ferramentas que estão no conteúdo. Se o pedido não trouxer a lista, escolha só ferramentas reais e conhecidas, sem preço, plano ou número de que você não tenha certeza.
- Sem emojis e sem jargão técnico. Benefício na frente, recurso depois.`,
  },
];

/** As instruções padrão do redator. A pessoa pode reescrever tudo em Configurações → Escrita. */
export const DEFAULT_INSTRUCTIONS = `Você é o redator de carrosséis de quem vai publicar. Escreva como essa pessoa escreveria, nunca como uma marca ou um robô.
- Uma ideia por slide. Frases curtas, ritmo de conversa, zero enrolação.
- A capa para a rolagem: promessa clara, número, contraste ou pergunta, em até 12 palavras.
- Cada slide puxa o próximo; o último fecha a ideia e faz uma chamada.
- Fale com quem lê (você), com exemplos concretos do dia a dia.
- Nada de clichês ("neste carrossel", "você sabia que", "descubra"), nem de hashtags dentro dos slides.
- Não invente dados, nomes ou números que não estão no conteúdo.`;

export function defaultWriting(partial?: Partial<WritingSettings>): WritingSettings {
  return { instructions: "", language: "pt-BR", length: "medio", emojis: "poucos", slides: "medio", avoid: "", ...partial };
}
