import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTable } from "./table.ts";

test("lê cabeçalho e itens em duas ou três colunas, sem perder destaques", () => {
  assert.deepEqual(parseTable("Item | Valor\nA | 10\nB | 20\nC | **30**"), [
    ["Item", "Valor"], ["A", "10"], ["B", "20"], ["C", "**30**"],
  ]);
  assert.deepEqual(parseTable("\n Item | Antes | Depois \r\n A | 10 | 12\r\n B | 20 | 22\r\n C | 30 | 32\n"), [
    ["Item", "Antes", "Depois"], ["A", "10", "12"], ["B", "20", "22"], ["C", "30", "32"],
  ]);
});

test("aceita até seis linhas e células vazias durante a edição", () => {
  const six = "Item | Valor\nA | 1\nB | 2\nC | 3\nD | 4\nE | 5";
  assert.equal(parseTable(six)?.length, 6);
  assert.deepEqual(parseTable("Item | Valor\n | "), [["Item", "Valor"], ["", ""]]);
  assert.equal(parseTable(`${six}\nF | 6`), null);
});

test("texto fora do formato continua disponível como texto, sem truncar dados", () => {
  for (const body of ["", "Um texto", "Uma\nColuna", "A | B", "A | B\nC | D | E", "A | B | C | D\n1 | 2 | 3 | 4"]) {
    assert.equal(parseTable(body), null, body);
  }
});
