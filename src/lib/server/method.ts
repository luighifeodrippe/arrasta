import { readFileSync } from "node:fs";
import path from "node:path";

/** O método editorial mora na pasta metodo/: quem quiser pode ler e mudar os arquivos. */
const cache = new Map<string, string>();

function file(name: string): string {
  let text = cache.get(name);
  if (text === undefined) {
    text = readFileSync(path.join(process.cwd(), "metodo", name), "utf8").trim();
    cache.set(name, text);
  }
  return text;
}

function section(text: string, from: string, to: string): string {
  return text.slice(text.indexOf(from), text.indexOf(to));
}

const ANCHOR = { type: "object", properties: { fact: { type: "string" }, source: { type: "string" } }, required: ["fact", "source"], additionalProperties: false } as const;

/** Vem antes dos slides: a ordem dos campos faz o modelo cumprir as etapas nessa ordem. */
export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    carouselType: { type: "string", enum: ["Tendência Interpretada", "Tese Contraintuitiva", "Case/Benchmark", "Previsão/Futuro"] },
    transformation: { type: "string" },
    friction: { type: "string" },
    angle: { type: "string" },
    evidence: { type: "array", items: ANCHOR },
    axis: { type: "string", enum: ["Mercado", "Cases", "Notícias", "Cultura", "Produto"] },
    funnel: { type: "string", enum: ["Topo", "Meio", "Fundo"] },
    headlines: {
      type: "array",
      minItems: 10,
      maxItems: 10,
      items: {
        type: "object",
        properties: { text: { type: "string" }, trigger: { type: "string" }, verdict: { type: "string" } },
        required: ["text", "trigger", "verdict"],
        additionalProperties: false,
      },
    },
    chosen: { type: "integer" },
    spine: {
      type: "object",
      properties: {
        hook: { type: "string" },
        mechanism: { type: "string" },
        proof: { type: "array", items: { type: "string" } },
        application: { type: "string" },
        direction: { type: "string" },
      },
      required: ["hook", "mechanism", "proof", "application", "direction"],
      additionalProperties: false,
    },
  },
  required: ["carouselType", "transformation", "friction", "angle", "evidence", "axis", "funnel", "headlines", "chosen", "spine"],
  additionalProperties: false,
} as const;

export interface EditorialPlan {
  carouselType: string;
  transformation: string;
  friction: string;
  angle: string;
  evidence: { fact: string; source: string }[];
  axis: string;
  funnel: string;
  headlines: { text: string; trigger: string; verdict: string }[];
  chosen: number;
  spine: { hook: string; mechanism: string; proof: string[]; application: string; direction: string };
}

/** O filtro vale para toda escrita com o método, inclusive edições. */
export function methodRules(): string {
  return file("filtro-editorial.md");
}

/** O método foi escrito para uma conversa em etapas; aqui ele roda de uma vez, dentro do app. */
export function methodTask(search: boolean): string {
  return `COMO O MÉTODO RODA AQUI
Você roda dentro do Arrasta, um app que desenha, edita e exporta os slides. Os arquivos abaixo foram escritos para uma conversa em etapas; aqui tudo acontece de uma vez, sem conversa.
- O Briefing Criativo já está respondido: marca é o perfil acima; nicho é "sobre o que fala"; tipo de carrossel é o formato escolhido e, sem formato, o que o insumo pedir; chamada é a do pedido ou a do perfil; número de slides é o do ajuste de escrita. Cor, estilo, imagens, HTML e PNG ficam com o app.
- Não faça perguntas, não espere aprovação, não mostre tabela e não fale com quem publica. Cumpra em silêncio Triagem, Headlines, Espinha Dorsal, Validação Editorial e Legenda, e devolva o JSON.
- plan guarda as etapas internas, nesta ordem: carouselType, a triagem (transformation, friction, angle, evidence, axis, funnel), as 10 headlines com a avaliação de cada uma (text, trigger com até 2 gatilhos, verdict APROVADO depois de reescrever as reprovadas), chosen (de 1 a 10, a capa que mais provoca, não a mais segura) e spine. Em evidence, source diz "conteúdo" ou o nome, o ano e o endereço da fonte.
- A voz do perfil manda no jeito de falar, inclusive em usar "você". O método manda na apuração, na estrutura, nas capas e no rigor. Instruções próprias de quem publica vêm antes do método.
- Se o pedido ou o formato escolhido for uma lista (N jeitos, prompts, ferramentas), a lista e o número ficam: o formato manda na estrutura e a capa diz quantos são, com tensão. Com formato, o arco dele manda nos slides internos.
- Título interno tem até 8 palavras e diz o que a pessoa descobre ou ganha naquele slide.
- Afirme como quem já apurou. Nada de "eu faria", "eu testaria", "eu começaria", "eu manteria", "eu teria cautela", "minha leitura", "minha hipótese", "uma possibilidade". Se a frase depende disso, troque por um fato ou por uma instrução direta.
- Fonte fica na legenda, no bloco Fontes. Dentro do slide, cite a fonte no máximo uma vez, dentro da frase ("segundo a Adobe"); nunca "Fonte: X, 2026" no fim do texto.
- Sem aviso de recorte: se o dado não serve para o público, não use. Um slide nunca explica os limites de uma pesquisa.
- Cada slide traz algo novo: o que já apareceu não volta com outras palavras.
- Nada de dado inventado: todo fato vem do conteúdo${search ? " ou da busca" : ""}. Os números dos exemplos e das referências são de outros carrosséis: nunca os use como dados deste.
- Não prometa material que não existe: "Comenta X" só se o pedido ou a chamada do perfil trouxer a palavra.
${search ? "- O pedido é curto: use a busca na web para achar de 3 a 6 âncoras verificáveis antes de escrever. Se não achar nada confiável, escreva sem dado.\n" : ""}
Mapa para o JSON:
- Slide 1: kind cover, title é a headline da capa. O limite de tamanho do title não vale para a capa: use até 5 linhas, cerca de 120 caracteres. Numa narrativa longa, a primeira frase fica no title e as outras no body.
- Tag do slide vai em tag. Título interno vai em title. Bloco 1 e Bloco 2 vão em body, separados por uma linha em branco. Palavra em accent vai entre **asteriscos duplos**.
- Big stat vira kind stat. Tabela vira kind table. Card vira kind quote. Linhas com seta viram kind list, um item por linha, começando com "1. ", "2. ".
- O slide gradient é o penúltimo. O CTA é o último, kind cta: body é a frase-ponte, title é a headline do CTA, tag é a palavra-chave quando existir.
- Legenda vai em caption, no formato da Etapa 6.

=== MÉTODO ===
${file("sistema.md")}

=== BANCO DE HEADLINES ===
${file("headlines.md")}

=== MANUAL DE QUALIDADE ===
${file("manual-de-qualidade.md")}

=== PRINCÍPIOS DE DESIGN ===
${file("principios-de-design.md")}

=== REFERÊNCIAS ===
${file("referencias.md")}

=== BOAS PRÁTICAS ===
${file("boas-praticas.md")}`;
}

export function reviewTask(facts: string, carousel: string): string {
  return `TAREFA: você é o editor que aprova o carrossel antes de ir ao ar. Rode o processo do Manual abaixo, com os 7 parâmetros, a nota mínima 8 e os 5 testes finais, mais o Filtro. Mantenha a voz do perfil, o número de slides, a ordem, o tipo e a tag de cada slide e o que já está bom. Slide aprovado volta igual, palavra por palavra. Revisar não é suavizar: mantenha a tensão e a convicção do texto, e não acrescente ressalva que o pedido não trouxe.

Fatos permitidos (a única fonte):
"""
${facts}
"""

Carrossel (JSON):
${carousel}

=== MANUAL DE QUALIDADE ===
${file("manual-de-qualidade.md")}

Devolva o carrossel completo no mesmo formato, sem a tabela de notas. Fato que não está nos fatos permitidos sai. Em sourceImage, mantenha o valor de cada slide. Aplique os mesmos testes em caption e hashtags. Em title e analysis, repita o que veio, ajustando só se o texto mudou.`;
}

export function methodCovers(): string {
  const system = file("sistema.md");
  return `Use o método de headlines abaixo para gerar as 10 opções.

${section(system, "### Etapa 2 — Headlines (10 opções)", "### Formato de apresentação das headlines")}

${section(system, "## BLOCO 5 — ENGINE DE HEADLINES", "## BLOCO 6 — DESIGN SYSTEM E TEMPLATE")}

=== BANCO DE HEADLINES ===
${file("headlines.md")}

Para cada opção:
- title: a capa, até 120 caracteres, com a frase que cabe em 5 linhas. Marque de 1 a 3 palavras-chave com **asteriscos duplos**. Numa narrativa longa, a primeira frase fica no title e as outras no body.
- body: vazio, exceto na narrativa longa.
- angle: o nome do ângulo da distribuição interna (Reenquadramento, Conflito oculto, Implicação sistêmica, Contradição, Ameaça ou oportunidade, Nomeação, Diagnóstico cultural, Inversão, Ambição de mercado, Mecanismo social).
- Se o carrossel é uma lista, a capa diz quantos itens são, com tensão.
- Não prometa o que o carrossel não entrega. Não invente número, nome nem dado. Os números do banco são de outros carrosséis.`;
}
