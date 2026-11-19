import type { Project } from "./types";

/** Uma linha da revisão antes de postar: o que está pronto, o que falta e o pedido que resolve. */
export interface ReviewCheck {
  id: "capa" | "titulos" | "textos" | "vazios" | "final" | "imagens" | "legenda" | "hashtags";
  name: string;
  ok: boolean;
  detail: string;
  /** Os cards que o problema toca (ids), para o pedido valer só para eles. */
  slideIds: string[];
  /** O pedido que vai ao ChatGPT Work para resolver; sem ele, a linha só leva ao lugar certo. */
  request?: string;
}

// As mesmas réguas que o redator segue (defaults.ts e prompts.ts): título com até 12 palavras, texto com até
// 40 palavras por slide, último slide com a chamada, até 5 hashtags. O Instagram corta a legenda em 2200 caracteres.
export const TITLE_WORDS = 12;
export const BODY_WORDS = 40;
export const MAX_HASHTAGS = 5;
export const CAPTION_LIMIT = 2200;

export const words = (text: string) => text.replace(/\*\*/g, "").split(/\s+/).filter(Boolean).length;

const list = (numbers: number[]) =>
  numbers.length <= 1 ? String(numbers[0] ?? "") : `${numbers.slice(0, -1).join(", ")} e ${numbers[numbers.length - 1]}`;
const cards = (numbers: number[]) => (numbers.length === 1 ? `o card ${numbers[0]}` : `os cards ${list(numbers)}`);

export function reviewProject(project: Pick<Project, "slides" | "caption" | "hashtags">): ReviewCheck[] {
  const { slides } = project;
  if (!slides.length) return [];
  const cover = slides[0];
  const last = slides[slides.length - 1];
  const at = (test: (index: number) => boolean) => slides.map((_, index) => index).filter(test);
  const ids = (indexes: number[]) => indexes.map((index) => slides[index].id);
  const human = (indexes: number[]) => indexes.map((index) => index + 1);

  const coverWords = words(cover.title);
  const longTitles = at((i) => i > 0 && words(slides[i].title) > TITLE_WORDS);
  const longBodies = at((i) => slides[i].kind !== "table" && words(slides[i].body) > BODY_WORDS);
  const empty = at((i) => !slides[i].title.trim() && !slides[i].body.trim());
  const noPicture = at((i) => Boolean(slides[i].imageIdea) && !slides[i].image);
  const captionLength = project.caption.trim().length;

  return [
    {
      id: "capa",
      name: "Capa lê de uma vez",
      ok: coverWords > 0 && coverWords <= TITLE_WORDS,
      detail: coverWords === 0 ? "A capa está sem título." : coverWords <= TITLE_WORDS ? `${coverWords} palavras no título.` : `${coverWords} palavras no título; até ${TITLE_WORDS} lê de uma vez.`,
      slideIds: [cover.id],
      request: coverWords === 0 ? "Escreva o título da capa: o gancho do carrossel, em até 12 palavras." : `Encurte o título da capa para até ${TITLE_WORDS} palavras, mantendo o gancho.`,
    },
    {
      id: "titulos",
      name: "Títulos curtos",
      ok: longTitles.length === 0,
      detail: longTitles.length ? `Título longo n${longTitles.length === 1 ? "o card" : "os cards"} ${list(human(longTitles))}.` : `Nenhum título passa de ${TITLE_WORDS} palavras.`,
      slideIds: ids(longTitles),
      request: `Encurte o título para até ${TITLE_WORDS} palavras, sem perder a ideia.`,
    },
    {
      id: "textos",
      name: "Texto que cabe na leitura",
      ok: longBodies.length === 0,
      detail: longBodies.length ? `Texto com mais de ${BODY_WORDS} palavras n${longBodies.length === 1 ? "o card" : "os cards"} ${list(human(longBodies))}.` : `Nenhum card passa de ${BODY_WORDS} palavras.`,
      slideIds: ids(longBodies),
      request: `Enxugue o texto para até ${BODY_WORDS} palavras, mantendo o que importa.`,
    },
    {
      id: "vazios",
      name: "Nenhum card vazio",
      ok: empty.length === 0,
      detail: empty.length ? `Falta escrever ${cards(human(empty))}.` : "Todos os cards têm texto.",
      slideIds: ids(empty),
      request: "Escreva este card seguindo a sequência do carrossel.",
    },
    {
      id: "final",
      name: "Último card chama para a ação",
      ok: last.kind === "cta",
      detail: last.kind === "cta" ? "O carrossel fecha com a chamada." : "O último card não é um final com chamada.",
      slideIds: [last.id],
      request: "Transforme este card no final do carrossel: uma frase que fecha a ideia e uma chamada clara.",
    },
    {
      id: "imagens",
      name: "Imagens sugeridas geradas",
      ok: noPicture.length === 0,
      detail: noPicture.length ? `Falta gerar a imagem d${noPicture.length === 1 ? "o card" : "os cards"} ${list(human(noPicture))}.` : "Nenhuma imagem sugerida ficou para trás.",
      slideIds: ids(noPicture),
    },
    {
      id: "legenda",
      name: "Legenda escrita",
      ok: captionLength > 0 && captionLength <= CAPTION_LIMIT,
      detail: captionLength === 0 ? "O post está sem legenda." : captionLength > CAPTION_LIMIT ? `A legenda tem ${captionLength} caracteres; o Instagram aceita ${CAPTION_LIMIT}.` : `${captionLength} caracteres.`,
      slideIds: [],
      request: captionLength > CAPTION_LIMIT ? "Encurte a legenda, mantendo a chamada final." : "Escreva a legenda do post pelos cards, na minha voz, com chamada final.",
    },
    {
      id: "hashtags",
      name: `Até ${MAX_HASHTAGS} hashtags`,
      ok: project.hashtags.length > 0 && project.hashtags.length <= MAX_HASHTAGS,
      detail: project.hashtags.length === 0 ? "O post está sem hashtags." : project.hashtags.length > MAX_HASHTAGS ? `${project.hashtags.length} hashtags; fique com as ${MAX_HASHTAGS} mais ligadas ao assunto.` : `${project.hashtags.length} hashtag${project.hashtags.length === 1 ? "" : "s"}.`,
      slideIds: [],
      request: `Deixe até ${MAX_HASHTAGS} hashtags, as mais ligadas ao assunto do carrossel.`,
    },
  ];
}
