import { parse } from "yaml";

/**
 * Lê o arquivo .yml que o Dify exporta ("DSL") e tira dele o prompt do app:
 * o pre_prompt dos apps de chat/agente ou os prompts de sistema dos nós de LLM dos workflows.
 */
export class FormatError extends Error {}

type Node = { data?: { type?: string; title?: string; prompt_template?: { role?: string; text?: string }[] | { text?: string } } };

export function parseDify(text: string): { name: string; description: string; prompt: string } {
  let doc: Record<string, unknown>;
  try {
    doc = parse(text) as Record<string, unknown>;
  } catch {
    throw new FormatError("Esse arquivo não é um .yml válido do Dify.");
  }
  const app = (doc?.app ?? {}) as { name?: string; description?: string };
  const modelConfig = (doc?.model_config ?? {}) as { pre_prompt?: string };
  let prompt = typeof modelConfig.pre_prompt === "string" ? modelConfig.pre_prompt : "";
  if (!prompt) {
    const nodes = ((doc?.workflow as { graph?: { nodes?: Node[] } } | undefined)?.graph?.nodes ?? []).filter((n) => n.data?.type === "llm");
    prompt = nodes
      .map((n) => {
        const template = n.data?.prompt_template;
        const texts = Array.isArray(template) ? template.filter((t) => t.role !== "assistant").map((t) => t.text ?? "") : [template?.text ?? ""];
        return texts.filter(Boolean).join("\n\n");
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
  }
  prompt = prompt.trim();
  if (!app.name || prompt.length < 40) throw new FormatError("Não achei o prompt nesse arquivo. Exporte o app no Dify (Exportar DSL) e envie o .yml.");
  return { name: String(app.name).slice(0, 60), description: String(app.description ?? "").slice(0, 200), prompt: prompt.slice(0, 20000) };
}
