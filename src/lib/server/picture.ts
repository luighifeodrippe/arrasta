import type { Design, Slide } from "../types";

/** A resposta só confirma: a imagem em si fica na pasta de imagens geradas da conversa. */
export const PICTURE_SCHEMA = {
  type: "object",
  properties: { made: { type: "boolean" }, note: { type: "string" } },
  required: ["made", "note"],
  additionalProperties: false,
} as const;

export interface PictureResult {
  made: boolean;
  note: string;
}

/**
 * O pedido de uma imagem para um card. A capa (e o card com a imagem no fundo) pede retrato com área calma para o
 * texto; nos outros a imagem fica junto do texto, deitada. Nunca há texto dentro da imagem: o texto é do card.
 */
export function picturePrompt(input: { slide: Pick<Slide, "kind" | "title" | "body" | "imageIdea">; design: Pick<Design, "theme" | "accent">; cover: boolean; idea: string }): string {
  const plain = (text: string) => text.replace(/\*\*/g, "").trim();
  const scene = plain(input.idea) || plain(input.slide.imageIdea) || plain(input.slide.title);
  const shape = input.cover
    ? "Formato retrato 3:4. A imagem vai atrás do título: deixe a metade de baixo mais escura e calma, com o assunto principal na metade de cima."
    : "Formato paisagem 3:2, com o assunto principal no centro, para caber num card ao lado de texto.";
  return `Gere UMA imagem com a ferramenta de geração de imagens. Não escreva código nem rode comandos.

A imagem ilustra um card de carrossel do Instagram.
Título do card: """${plain(input.slide.title).slice(0, 300)}"""
Texto do card: """${plain(input.slide.body).slice(0, 600)}"""
Cena pedida: """${scene.slice(0, 600)}"""

Como deve ser:
- Fotografia editorial realista, luz de cinema, com profundidade; nada de ilustração genérica, 3D de banco de imagens ou colagem.
- ${shape}
- Clima ${input.design.theme === "dark" ? "escuro, com contraste alto" : "claro e limpo"}; um ponto de cor próximo de ${input.design.accent} pode aparecer como luz, sem dominar.
- Sem nenhum texto, letra, número, logotipo, marca-d'água, interface de aplicativo legível nem moldura.
- Sem pessoas reais reconhecíveis e sem marcas registradas.

Depois de gerar, responda no JSON pedido: made true se a imagem foi gerada, e em note uma frase curta dizendo o que ela mostra.`;
}
