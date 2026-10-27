import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILTIN_FORMATS, defaultProfile, defaultWriting, emptySource } from "../defaults.ts";
import { createPrompt, linkPrompt } from "./prompts.ts";

const base = { profile: defaultProfile(), writing: defaultWriting(), instructions: "" };

test("os formatos de prompts e de ferramentas vêm depois de mitos e passam seu texto para criação e links", () => {
  assert.deepEqual(BUILTIN_FORMATS.map((format) => format.id), ["storytelling", "lista", "passo-a-passo", "mitos", "prompts", "ferramentas"]);
  for (const format of BUILTIN_FORMATS.slice(-2)) {
    assert.equal(format.origin, "builtin");
    assert.equal(format.createdAt, "2026-10-27T00:00:00.000Z");
    const created = createPrompt({ ...base, brief: "Organizar tarefas", format });
    const linked = linkPrompt({ ...base, source: emptySource("web"), level: "pouco", format });
    for (const prompt of [created, linked]) {
      assert.ok(prompt.includes(`FORMATO ESCOLHIDO: "${format.name}"`));
      assert.ok(prompt.includes(format.prompt));
    }
    assert.ok(!created.includes("Estrutura que funciona:"));
  }
});
