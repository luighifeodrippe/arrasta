/** O que o pedido alcança: o carrossel inteiro, a capa ou um card do meio. */
export type AskTarget = "carousel" | "cover" | "slide";

/** Pedidos prontos, uma lista só para o chat, a barra de baixo e o menu de reescrever; mudam com o alvo. */
const SUGGESTIONS: Record<AskTarget, string[]> = {
  carousel: ["Gancho mais forte na capa", "Deixe tudo mais curto", "Mais provocativo", "Adicione um exemplo prático", "Traduza para inglês"],
  cover: ["Gancho mais forte", "Mais curto", "Mais provocativo", "Outra versão"],
  slide: ["Mais curto", "Mais simples", "Adicione um exemplo prático", "Outra versão", "Corrigir erros"],
};

export function suggestionsFor(target: AskTarget): string[] {
  return SUGGESTIONS[target];
}

/** O alvo a partir dos cards escolhidos (posições, a partir de 0). */
export function askTarget(focus: number[]): AskTarget {
  if (focus.length !== 1) return "carousel";
  return focus[0] === 0 ? "cover" : "slide";
}
