import assert from "node:assert/strict";
import { test } from "node:test";
import { joinItems, listItems } from "./list.ts";

test("reconhece listas numeradas e com marcadores", () => {
  assert.deepEqual(listItems("1. Um\n2. Dois")?.map((i) => i.text), ["Um", "Dois"]);
  assert.deepEqual(listItems("→ a\n→ b\n→ c")?.map((i) => i.prefix), ["→ ", "→ ", "→ "]);
  assert.equal(listItems("Só uma linha"), null);
  assert.equal(listItems("Texto normal\n1. item"), null);
});

test("renumera ao inserir ou remover itens", () => {
  const items = listItems("1. Um\n2. Dois\n3. Três")!;
  items.splice(1, 0, { prefix: "2. ", marker: "2", text: "Novo" });
  assert.equal(joinItems(items), "1. Um\n2. Novo\n3. Dois\n4. Três");
  assert.equal(joinItems(items.filter((_, i) => i !== 0)), "1. Novo\n2. Dois\n3. Três");
});
