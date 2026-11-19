import assert from "node:assert/strict";
import { test } from "node:test";
import type { WriteResult } from "./prompts.ts";
import { isValidReview, withoutSources, withReviewFallback } from "./review.ts";

const original: WriteResult = {
  title: "Semana",
  analysis: { hook: "Prioridades", structure: "Exemplo", why: "Aplicação" },
  slides: [
    { kind: "cover", tag: "", title: "Três prioridades", body: "", imageIdea: "", sourceImage: null },
    { kind: "cta", tag: "", title: "Qual é a sua prioridade?", body: "", imageIdea: "", sourceImage: 0 },
  ],
  caption: "Planeje a semana.",
  hashtags: ["planejamento"],
};

test("a fonte sai do card, no fim da frase ou em parágrafo próprio, e o resto fica", () => {
  const bodies = ["Em 2023 a Adobe anunciou. Fonte: Adobe, 2023.", "Um fato.\n\nFonte: STJ, 2025.", "Linha um.\n\nFontes: A, B.\n\nLinha dois.", "Sem fonte nenhuma"];
  const slides = bodies.map((body) => ({ ...original.slides[0], body }));
  assert.deepEqual(withoutSources({ ...original, slides }).slides.map((slide) => slide.body), ["Em 2023 a Adobe anunciou.", "Um fato.", "Linha um.\n\nLinha dois.", "Sem fonte nenhuma"]);
});

test("revisão só vale com slides e a mesma quantidade da primeira versão", () => {
  assert.equal(isValidReview(original, 2), true);
  for (const result of [null, undefined, {}, { slides: null }, { slides: "dois" }, { slides: [] }, { slides: original.slides.slice(0, 1) }, { slides: [...original.slides, original.slides[0]] }]) {
    assert.equal(isValidReview(result, 2), false);
  }
  assert.equal(isValidReview({ slides: [] }, 0), false);
});

test("usa a revisão válida e preserva a primeira versão se vier sem slides ou com quantidade diferente", async () => {
  const signal = new AbortController().signal;
  const revised = { ...original, caption: "Qual é a sua prioridade na semana?" };
  assert.equal(await withReviewFallback(original, async () => revised, signal), revised);
  for (const result of [null, {}, { ...original, slides: [] }, { ...original, slides: original.slides.slice(0, 1) }, { ...original, slides: [...original.slides, original.slides[0]] }]) {
    // Simula o JSON recebido do modelo, sem a garantia estática do schema.
    assert.equal(await withReviewFallback(original, async () => JSON.parse(JSON.stringify(result)), signal), original);
  }
});

test("erro do revisor devolve a primeira versão", async () => {
  assert.equal(await withReviewFallback(original, async () => { throw new Error("Falha na revisão"); }, new AbortController().signal), original);
});

test("cancelamento anterior à revisão impede a segunda chamada", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(withReviewFallback(original, async () => { assert.fail("não deve chamar o revisor"); }, controller.signal), { name: "AbortError" });
});

test("cancelamento durante a revisão interrompe mesmo se ela devolver um resultado", async () => {
  for (const fails of [false, true]) {
    const controller = new AbortController();
    await assert.rejects(withReviewFallback(original, async () => {
      controller.abort();
      if (fails) throw new Error("Cancelado pelo executor");
      return original;
    }, controller.signal), { name: "AbortError" });
  }
});

test("AbortError do revisor não vira fallback", async () => {
  await assert.rejects(withReviewFallback(original, async () => { throw new DOMException("Cancelado", "AbortError"); }, new AbortController().signal), { name: "AbortError" });
});
