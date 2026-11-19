import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultDesign, effectiveFont, fontChoice } from "./defaults.ts";
import { coverTitleSize, mancheteColors, mancheteTone } from "./manchete.ts";

test("Manchete segue o ritmo de 5, 7, 8, 9 e 12 cards", () => {
  const expected = {
    5: ["dark", "dark", "light", "dark", "light"],
    7: ["dark", "dark", "light", "dark", "light", "accent", "light"],
    8: ["dark", "dark", "light", "dark", "light", "dark", "accent", "light"],
    9: ["dark", "dark", "light", "dark", "light", "dark", "light", "accent", "light"],
    12: ["dark", "dark", "light", "dark", "light", "dark", "light", "dark", "light", "dark", "accent", "light"],
  };
  for (const [total, tones] of Object.entries(expected)) {
    assert.deepEqual(Array.from({ length: Number(total) }, (_, index) => mancheteTone(index, Number(total), "dark")), tones);
  }
  assert.deepEqual(Array.from({ length: 5 }, (_, index) => mancheteTone(index, 5, "light")), ["light", "light", "dark", "light", "light"]);
  for (const theme of ["light", "dark"] as const) assert.equal(mancheteTone(0, 1, theme), theme);
});

test("Minimal é quase todo claro e Bold é quase todo escuro, sem três iguais do Bold em sequência", () => {
  const minimal = Array.from({ length: 9 }, (_, index) => mancheteTone(index, 9, "dark", "minimalista"));
  assert.equal(minimal.filter((tone) => tone === "dark").length, 2);
  const bold = Array.from({ length: 9 }, (_, index) => mancheteTone(index, 9, "dark", "bold"));
  assert.deepEqual(bold, ["dark", "dark", "light", "dark", "dark", "light", "dark", "accent", "light"]);
});

test("a letra vem do estilo até a pessoa escolher outra", () => {
  const design = defaultDesign({ template: "manchete", style: "classico" });
  assert.equal(effectiveFont(design, "title"), "playfair");
  assert.equal(effectiveFont(design, "body"), "dmsans");
  const chosen = { ...design, ...fontChoice(design, "anton") };
  assert.equal(effectiveFont(chosen, "title"), "anton");
  assert.equal(effectiveFont(chosen, "body"), "anton");
  const other = defaultDesign({ template: "perfil", font: "poppins" });
  assert.equal(effectiveFont(other, "title"), "poppins");
  assert.equal(fontChoice(other, "inter").titleFont, null);
});

test("a cor por nicho troca os fundos", () => {
  const colors = mancheteColors("#64FFDA", { light: "#F0F4F8", dark: "#020C1B" });
  assert.equal(colors.lightBg, "#F0F4F8");
  assert.equal(colors.darkBg, "#020C1B");
});

test("as cores do modelo saem de uma cor só, com a temperatura dela", () => {
  const warm = mancheteColors("#ff3500");
  assert.equal(warm.light, "#ff5d33");
  assert.equal(warm.dark, "#b32500");
  assert.equal(warm.lightBg, "#F7F4F1");
  assert.equal(warm.darkBg, "#0F0D0C");
  assert.ok(warm.gradient.includes("#ff3500"));
  const cool = mancheteColors("#1d9bf0");
  assert.equal(cool.lightBg, "#F0F2F5");
  assert.equal(cool.darkBg, "#0C0D10");
});

test("a capa diminui a letra conforme o título cresce", () => {
  assert.equal(coverTitleSize("A morte do gosto pessoal"), 136);
  assert.equal(coverTitleSize("a".repeat(80)), 120);
  assert.equal(coverTitleSize("a".repeat(120)), 104);
  assert.equal(coverTitleSize("a".repeat(121)), 88);
  assert.equal(coverTitleSize(`**${"a".repeat(56)}**`), 136);
});
