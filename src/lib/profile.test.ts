import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultProfile, defaultWriting, normalizeProfile } from "./defaults.ts";
import { createPrompt } from "./server/prompts.ts";

test("perfil antigo mantém identidade e textos ao ganhar preferências", () => {
  const old = { name: "Ana", handle: "@ana", samples: "Um texto já salvo", voice: "Direta" };
  const profile = normalizeProfile(old);
  assert.equal(profile.name, "Ana");
  assert.equal(profile.handle, "ana");
  assert.equal(profile.samples, old.samples);
  assert.equal(profile.voice, old.voice);
  assert.equal(profile.goal, "");
  assert.deepEqual(profile.styleReferences, []);
});

test("preferências e pesos das referências sobrevivem à normalização", () => {
  const profile = normalizeProfile({
    goal: "Ensinar com exemplos",
    preferences: "Humor seco, sem promessas",
    styleReferences: [{ id: "um", name: "Referência", focus: "Ritmo", samples: "Exemplo", weight: 99 }],
  });
  assert.equal(profile.goal, "Ensinar com exemplos");
  assert.equal(profile.preferences, "Humor seco, sem promessas");
  assert.equal(profile.styleReferences?.[0].weight, 5);
  assert.equal(profile.styleReferences?.[0].samples, "Exemplo");
});

test("geração usa a mistura ponderada só quando há exemplos", () => {
  const profile = {
    ...defaultProfile(),
    goal: "Explicar IA para professores",
    preferences: "Sem jargão",
    styleReferences: [
      { id: "a", name: "Referência A", focus: "Humor", samples: "Texto de A", weight: 1 },
      { id: "b", name: "Referência B", focus: "Ritmo", samples: "Texto de B", weight: 3 },
      { id: "c", name: "@sem_exemplos", focus: "Tudo", samples: "  ", weight: 5 },
    ],
  };
  const prompt = createPrompt({ profile, writing: defaultWriting(), brief: "Aprendizado", instructions: "" });
  assert.match(prompt, /Explicar IA para professores/);
  assert.match(prompt, /Sem jargão/);
  assert.match(prompt, /Referência A\. Influência relativa: 25%/);
  assert.match(prompt, /Referência B\. Influência relativa: 75%/);
  assert.match(prompt, /Texto de A/);
  assert.match(prompt, /Texto de B/);
  assert.doesNotMatch(prompt, /@sem_exemplos/);
  assert.match(prompt, /não copie frases, identidade ou histórias pessoais/);
});

test("guia mapeado substitui exemplos brutos nas próximas gerações", () => {
  const profile = {
    ...defaultProfile(), voice: "Voz própria mapeada", samples: "TEXTO_BRUTO_PROPRIO",
    styleReferences: [{ id: "a", name: "Referência", focus: "", samples: "TEXTO_BRUTO_REFERENCIA", guide: `Guia salvo ${"r".repeat(1400)}`, weight: 3 }],
  };
  const prompt = createPrompt({ profile, writing: defaultWriting(), brief: "Ideia", instructions: "" });
  assert.match(prompt, /Voz própria mapeada/);
  assert.match(prompt, /Guia salvo/);
  assert.doesNotMatch(prompt, /TEXTO_BRUTO_/);
  assert.doesNotMatch(prompt, new RegExp("r".repeat(901)));
});
