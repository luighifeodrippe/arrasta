import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultDesign, fitRowSlideWidth, fitSlideWidth, initialDesign } from "./defaults.ts";
import type { Design } from "./types.ts";

test("visual inicial usa o primeiro projeto da lista ou o padrão quando vazia", () => {
  assert.deepEqual(initialDesign([]), defaultDesign());
  const design = defaultDesign({
    template: "editorial", theme: "dark", font: "montserrat", accent: "#7c3aed",
    background: "#111111", textScale: 1.2, align: "center", size: "4:5",
    titleFont: "anton", bodyFont: "inter", gap: 1.4,
    showProfile: false, showCounter: true, showSwipe: false,
    titleStyle: { color: "#ffffff", align: "right", size: 72, leading: 1.2, tracking: -1 },
  });
  const inherited = initialDesign([{ design }, { design: defaultDesign() }]);
  assert.deepEqual(inherited, design);
  assert.notEqual(inherited, design);
  assert.notEqual(inherited.titleStyle, design.titleStyle);
  inherited.titleStyle.color = "#000000";
  assert.equal(design.titleStyle.color, "#ffffff");
  assert.deepEqual(initialDesign([{ design: { theme: "dark" } as Design }]), defaultDesign({ theme: "dark" }));
});

test("lado a lado completa cards acima de 80% nos três zooms e nas duas proporções", () => {
  for (const size of ["3:4", "4:5"] as const) {
    for (const zoom of [0.5, 0.72, 0.9]) {
      const width = fitSlideWidth(size, 1200, 500 * zoom, 440);
      for (const gap of [20, 25]) {
        const available = 2 * (width + gap) + width * 0.95;
        const fitted = fitRowSlideWidth(width, available, 8, gap);
        assert.ok(fitted < width);
        assert.ok(fitted >= width * 0.88);
        assert.ok(3 * fitted + 2 * gap <= available);
        assert.equal(fitRowSlideWidth(width, 2 * (width + gap) + width * 0.1, 8, gap), width);
        assert.equal(fitRowSlideWidth(width, 2 * (width + gap) + width * 0.5, 8, gap), width);
        assert.equal(fitRowSlideWidth(width, available, 2, gap), width);
        assert.equal(fitRowSlideWidth(width, 3 * width + 2 * gap, 8, gap), width);
      }
    }
  }
  assert.equal(fitRowSlideWidth(300, 250, 8), 300); // Exigiria reduzir mais de 12%.
  assert.equal(fitRowSlideWidth(0, 900, 8), 0);
});
