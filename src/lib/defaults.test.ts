import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultWriting, fitSlideWidth, normalizeProject, slideHeight } from "./defaults.ts";
import type { Project } from "./types.ts";

test("projetos antigos ganham estilos de texto, biblioteca de imagens e proporção", () => {
  const old = {
    id: "abc123",
    title: "Antigo",
    createdAt: "",
    updatedAt: "",
    source: null,
    slides: [{ id: "s1", kind: "cover", title: "Oi", body: "", image: null, background: null, valign: null, titleColor: "#ff0000", bodyAlign: "justify" }],
    design: { template: "perfil", theme: "light", font: "inter", accent: "#ff3500", background: null, textScale: 1, align: "left", showProfile: true, showCounter: false, showSwipe: true },
    caption: "",
    hashtags: [],
    chat: [],
  } as unknown as Project;
  const project = normalizeProject(old);
  const slide = project.slides[0] as unknown as Record<string, unknown>;
  assert.equal(project.slides[0].titleStyle.color, "#ff0000");
  assert.equal(project.slides[0].bodyStyle.align, "justify");
  assert.equal(project.slides[0].titleStyle.size, null);
  assert.equal("titleColor" in slide, false);
  assert.deepEqual(project.images, []);
  assert.equal(project.design.size, "3:4");
  assert.equal(project.design.titleStyle.leading, null);
  assert.equal(slideHeight(project.design.size), 1440);
  assert.equal(slideHeight("4:5"), 1350);
});

test("ajustes de escrita começam no padrão e aceitam mudanças parciais", () => {
  assert.equal(defaultWriting().instructions, "");
  assert.equal(defaultWriting().language, "pt-BR");
  assert.equal(defaultWriting({ emojis: "nunca" }).emojis, "nunca");
  assert.equal(defaultWriting({ emojis: "nunca" }).length, "medio");
});

test("cards respeitam a largura e a altura disponíveis em cada proporção", () => {
  for (const size of ["3:4", "4:5"] as const) {
    for (const [width, height] of [[130, 320], [640, 120], [900, 600]]) {
      const card = fitSlideWidth(size, width, height, 440);
      assert.ok(card <= width);
      assert.ok(card * slideHeight(size) / 1080 <= height);
      assert.ok(card <= 440);
    }
    assert.equal(fitSlideWidth(size, 0, 0), 0);
  }
});
