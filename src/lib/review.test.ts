import assert from "node:assert/strict";
import test from "node:test";
import { makeSlide } from "./defaults.ts";
import { reviewProject, words } from "./review.ts";

const slide = (id: string, patch: Parameters<typeof makeSlide>[0]) => makeSlide({ id, ...patch });
const byId = (checks: ReturnType<typeof reviewProject>) => Object.fromEntries(checks.map((check) => [check.id, check]));

test("conta palavras sem os asteriscos do destaque", () => {
  assert.equal(words("Meus **carrosséis** trouxeram  300 mil"), 5);
  assert.equal(words("  "), 0);
});

test("carrossel sem cards não tem o que revisar", () => {
  assert.deepEqual(reviewProject({ slides: [], caption: "", hashtags: [] }), []);
});

test("carrossel pronto passa em tudo", () => {
  const checks = reviewProject({
    slides: [
      slide("a", { kind: "cover", title: "O **gancho** em poucas palavras", body: "Complemento." }),
      slide("b", { kind: "content", title: "Uma ideia", body: "Um texto curto." }),
      slide("c", { kind: "cta", title: "Salve para depois", body: "Comente o que achou." }),
    ],
    caption: "Legenda pronta.",
    hashtags: ["ia", "carrossel"],
  });
  assert.equal(checks.length, 8);
  assert.deepEqual(checks.filter((check) => !check.ok).map((check) => check.id), []);
});

test("aponta o que falta e em quais cards", () => {
  const long = Array.from({ length: 41 }, () => "palavra").join(" ");
  const checks = byId(
    reviewProject({
      slides: [
        slide("a", { kind: "cover", title: "um dois três quatro cinco seis sete oito nove dez onze doze treze", body: "" }),
        slide("b", { kind: "content", title: "Curto", body: long, imageIdea: "uma mesa de trabalho" }),
        slide("c", { kind: "content", title: "", body: "" }),
        slide("d", { kind: "content", title: "Fim", body: "Sem chamada." }),
      ],
      caption: "",
      hashtags: ["a", "b", "c", "d", "e", "f"],
    }),
  );
  assert.equal(checks.capa.ok, false);
  assert.match(checks.capa.detail, /13 palavras/);
  assert.deepEqual(checks.capa.slideIds, ["a"]);
  assert.equal(checks.titulos.ok, true);
  assert.deepEqual(checks.textos.slideIds, ["b"]);
  assert.deepEqual(checks.vazios.slideIds, ["c"]);
  assert.match(checks.vazios.detail, /o card 3/);
  assert.equal(checks.final.ok, false);
  assert.deepEqual(checks.final.slideIds, ["d"]);
  assert.deepEqual(checks.imagens.slideIds, ["b"]);
  assert.equal(checks.legenda.ok, false);
  assert.equal(checks.hashtags.ok, false);
  assert.match(checks.hashtags.detail, /6 hashtags/);
});

test("tabela não entra na conta de palavras do texto", () => {
  const rows = Array.from({ length: 30 }, (_, index) => `Item ${index} | ${index}`).join("\n");
  const checks = byId(reviewProject({ slides: [slide("a", { kind: "table", title: "Tabela", body: rows }), slide("b", { kind: "cta", title: "Fim", body: "Salve." })], caption: "x", hashtags: ["a"] }));
  assert.equal(checks.textos.ok, true);
});
