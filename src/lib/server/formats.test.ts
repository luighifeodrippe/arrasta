import assert from "node:assert/strict";
import { test } from "node:test";
import { FormatError, parseDify } from "./formats.ts";

const prompt = "Você escreve carrosséis de prompts. Slide 1: gancho. Slides 2 a 8: um prompt por slide. Último: CTA.";

test("lê o prompt de um app de chat do Dify", () => {
  const format = parseDify(`app:\n  name: Carrossel de Prompts\n  description: Um prompt por slide\n  mode: chat\nmodel_config:\n  pre_prompt: "${prompt}"\n`);
  assert.equal(format.name, "Carrossel de Prompts");
  assert.equal(format.description, "Um prompt por slide");
  assert.equal(format.prompt, prompt);
});

test("junta os prompts dos nós de LLM de um workflow", () => {
  const yml = `app:
  name: Ferramentas
  mode: workflow
workflow:
  graph:
    nodes:
      - data: { type: start, title: Início }
      - data:
          type: llm
          prompt_template:
            - role: system
              text: "${prompt}"
            - role: assistant
              text: exemplo que não entra
`;
  const format = parseDify(yml);
  assert.equal(format.name, "Ferramentas");
  assert.equal(format.prompt, prompt);
});

test("recusa arquivo sem prompt ou que não é yaml", () => {
  assert.throws(() => parseDify("app:\n  name: Vazio\n"), FormatError);
  assert.throws(() => parseDify("{ isto: [não fecha"), FormatError);
});
