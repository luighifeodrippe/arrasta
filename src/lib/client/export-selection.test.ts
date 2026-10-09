import assert from "node:assert/strict";
import { test } from "node:test";
import { exportIndices, slideFilename } from "./export-selection.ts";

test("exportação parcial segue a ordem original e ignora seleção inválida", () => {
  const selected = exportIndices(10, [8, 2, 8, -1, 10, 1.5, NaN, 0]);
  assert.deepEqual(selected, [0, 2, 8]);
  assert.deepEqual(selected.map((index) => slideFilename("Ação & criação", index)), ["acao-criacao-01.png", "acao-criacao-03.png", "acao-criacao-09.png"]);
});

test("nenhum card selecionado não vira uma exportação de todos", () => {
  assert.deepEqual(exportIndices(10, []), []);
  assert.deepEqual(exportIndices(0, [0, 1]), []);
});

test("nome de download tem fallback e não permite criar caminhos", () => {
  assert.equal(slideFilename("!!!", 4), "carrossel-05.png");
  assert.equal(slideFilename("../../Meu carrossel", 0), "meu-carrossel-01.png");
});
