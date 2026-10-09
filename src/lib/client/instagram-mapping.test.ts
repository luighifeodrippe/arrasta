import assert from "node:assert/strict";
import { test } from "node:test";
import type { InstagramImportResult, Profile, StyleReference } from "../types.ts";
import { mergeInstagramProfile, mergeInstagramReference } from "./instagram-mapping.ts";

const profile = (): Profile => ({ name: "Nome anterior", handle: "criador", avatar: null, verified: false, about: "", audience: "", voice: "Guia anterior", samples: "", cta: "Salve", followers: null, goal: "Ensinar", preferences: "Sem clichês", styleReferences: [] });
const mapped = (): InstagramImportResult => ({
  handle: "criador", name: "Nome público", avatar: "/api/assets/profile/avatar.jpg", verified: true, followers: 42,
  samples: "Texto público", imported: { name: true, avatar: true, captions: 2 }, notice: "Amostra pública",
  analysis: { status: "ready", guide: "Guia aprendido", about: "Tecnologia", audience: "Criadores", analyzedAt: "2026-10-09T12:00:00.000Z", reused: false, sampleCount: 2, imageCount: 1, sourceUrls: ["https://www.instagram.com/p/Example123/"], message: "" },
});
const reference = (id: string, handle: string): StyleReference => ({ id, name: `@${handle}`, handle, focus: "Humor", samples: "Exemplo", weight: 5, guide: "Guia salvo" });

test("análise aplica identidade e guia sem apagar gostos nem edições feitas durante a espera", () => {
  const baseline = profile();
  const changed = { ...baseline, name: "Nome editado durante a análise", preferences: "Com humor", goal: "Conversar", styleReferences: [reference("ref-1", "outra")] };
  const next = mergeInstagramProfile(changed, mapped(), baseline);
  assert.equal(next.name, changed.name);
  assert.equal(next.voice, "Guia aprendido");
  assert.equal(next.about, "Tecnologia");
  assert.equal(next.preferences, "Com humor");
  assert.equal(next.goal, "Conversar");
  assert.deepEqual(next.styleReferences, changed.styleReferences);
  assert.equal(next.voiceAnalysis?.sampleCount, 2);
});

test("não substitui guia editado durante a leitura nem aplica resultado de outro perfil", () => {
  const baseline = profile();
  const changed = { ...baseline, voice: "Guia editado agora" };
  const next = mergeInstagramProfile(changed, mapped(), baseline);
  assert.equal(next.voice, changed.voice);
  assert.equal(next.voiceAnalysis, undefined);
  const other = { ...baseline, handle: "outroperfil" };
  assert.equal(mergeInstagramProfile(other, mapped(), baseline), other);
});

test("falha de análise mantém o guia existente e permite aproveitar identidade pública", () => {
  const baseline = profile();
  const result = mapped();
  result.analysis.status = "needs_login";
  result.analysis.guide = "";
  const next = mergeInstagramProfile(baseline, result, baseline);
  assert.equal(next.voice, "Guia anterior");
  assert.equal(next.name, "Nome público");
  assert.equal(next.voiceAnalysis, undefined);
});

test("mesmo @ atualiza referência sem duplicar ou perder peso e foco", () => {
  const saved = reference("stable-id", "CRIADOR");
  const next = mergeInstagramReference([saved], mapped(), "new-id");
  assert.equal(next.length, 1);
  assert.equal(next[0].id, "stable-id");
  assert.equal(next[0].weight, 5);
  assert.equal(next[0].focus, "Humor");
  assert.equal(next[0].guide, "Guia aprendido");
  const failed = mapped();
  failed.analysis.status = "unavailable";
  failed.analysis.guide = "";
  assert.equal(mergeInstagramReference(next, failed, "other-id")[0].guide, "Guia aprendido");
});

test("reutiliza rascunho vazio no limite de referências, preservando todas as preenchidas", () => {
  const filled = [reference("a", "a"), reference("b", "b"), reference("c", "c"), reference("d", "d")];
  const empty: StyleReference = { id: "empty", name: "", focus: "", samples: "", weight: 3 };
  const next = mergeInstagramReference([...filled, empty], mapped(), "new-id");
  assert.equal(next.length, 5);
  assert.deepEqual(next.slice(0, 4), filled);
  assert.equal(next[4].handle, "criador");
  assert.equal(next[4].id, "empty");
  const other = { ...mapped(), handle: "sexto" };
  assert.equal(mergeInstagramReference(next, other, "sixth"), next);
});
