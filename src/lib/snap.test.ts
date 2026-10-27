import assert from "node:assert/strict";
import { test } from "node:test";
import { clampOffset, nearestSnap, snapOffset, snapTargets } from "./snap.ts";
import { defaultDesign, makeSlide } from "./defaults.ts";
import { useEditor } from "./client/editor-store.ts";

test("alvos incluem margens, centro, Explorar e as três âncoras das outras peças", () => {
  assert.deepEqual(snapTargets(1440, [{ x: 100, y: 200, width: 80, height: 60 }]), {
    x: [64, 540, 1016, 100, 140, 180], y: [720, 180, 1260, 200, 230, 260],
  });
  assert.deepEqual(snapTargets(1350, []).y, [675, 135, 1215]);
});

test("escolhe a menor distância global por eixo e preserva empates", () => {
  assert.deepEqual(nearestSnap([60, 110, 160], [64, 162], 6), { delta: 2, line: 162 });
  assert.deepEqual(nearestSnap([60], [58, 62], 6), { delta: -2, line: 58 });
  assert.equal(nearestSnap([60], [66], 6), null);
  assert.equal(nearestSnap([], [64], 6), null);
});

test("encaixe usa 6 px de tela em qualquer zoom e escolhe cada eixo independentemente", () => {
  const base = { x: 100, y: 200, width: 200, height: 100 };
  const targets = { x: [64], y: [720] };
  const desired = { x: -26, y: 422 };
  const result = snapOffset(base, desired, targets, 0.5, 1080, 1440);
  assert.deepEqual(result, { offset: { x: -36, y: 420 }, x: 64, y: 720 });
  assert.equal(snapOffset(base, desired, targets, 1, 1080, 1440).x, null);
  assert.deepEqual(snapOffset(base, desired, targets, 0.5, 1080, 1440, true), { offset: desired, x: null, y: null });
});

test("borda esquerda, centro e direita; topo, meio e base podem encaixar", () => {
  const base = { x: 0, y: 0, width: 200, height: 100 };
  for (const edge of [0, 100, 200]) {
    const result = snapOffset(base, { x: 540 - edge + 2, y: 0 }, { x: [540], y: [] }, 1, 1080, 1440);
    assert.equal(result.offset.x, 540 - edge);
  }
  for (const edge of [0, 50, 100]) {
    const result = snapOffset(base, { x: 0, y: 720 - edge - 2 }, { x: [], y: [720] }, 1, 1080, 1440);
    assert.equal(result.offset.y, 720 - edge);
  }
});

test("limite deixa 40 px visíveis em ambos os eixos e não corta peças menores", () => {
  const base = { x: 100, y: 200, width: 200, height: 100 };
  assert.deepEqual(clampOffset(base, { x: -9999, y: -9999 }, 1080, 1440), { x: -260, y: -260 });
  assert.deepEqual(clampOffset(base, { x: 9999, y: 9999 }, 1080, 1440), { x: 940, y: 1200 });
  assert.deepEqual(clampOffset({ x: 100, y: 200, width: 20, height: 30 }, { x: -9999, y: -9999 }, 1080, 1440), { x: -100, y: -200 });
  assert.equal(snapOffset(base, { x: 940, y: 0 }, { x: [1079], y: [] }, 0.1, 1080, 1440).x, null);
});

test("makeSlide normaliza projetos antigos e preserva deslocamentos", () => {
  assert.deepEqual(makeSlide().offsets, {});
  assert.deepEqual(makeSlide({ offsets: undefined }).offsets, {});
  assert.deepEqual(makeSlide({ offsets: { title: { x: 12, y: -30 } } }).offsets, { title: { x: 12, y: -30 } });
});

test("movimento, duplicação e organização preservam histórico e isolamento entre slides", () => {
  const a = makeSlide({ id: "a", gap: 1.5, valign: "bottom" });
  const b = makeSlide({ id: "b", offsets: { body: { x: -10, y: 20 } } });
  useEditor.getState().load({ id: "test", createdAt: "", updatedAt: "", source: null, slides: [a, b], title: "Teste", design: defaultDesign(), caption: "", hashtags: [], chat: [], images: [] });
  const editor = () => useEditor.getState();
  editor().moveBlock("a", "title", { x: 25, y: 35 });
  assert.equal(editor().past.length, 1);
  assert.deepEqual(editor().project!.slides[0].offsets.title, { x: 25, y: 35 });
  editor().duplicateSlide("a");
  assert.deepEqual(editor().project!.slides[1].offsets, { title: { x: 25, y: 35 } });
  editor().duplicateSlides(["b"]);
  assert.deepEqual(editor().project!.slides.at(-1)!.offsets, b.offsets);
  const before = editor().past.length;
  editor().organizeSlides(["a", "b"]);
  assert.equal(editor().past.length, before + 1);
  const organized = editor().project!.slides.filter((s) => s.id === "a" || s.id === "b");
  assert.ok(organized.every((s) => !Object.keys(s.offsets).length && s.gap === null && s.valign === null));
  assert.deepEqual(editor().project!.slides[1].offsets.title, { x: 25, y: 35 });
  editor().undo();
  assert.equal(editor().project!.slides[0].gap, 1.5);
  assert.deepEqual(editor().project!.slides.find((s) => s.id === "b")!.offsets, b.offsets);
  editor().redo();
  editor().moveBlock("a", "title", { x: 8, y: 9 });
  editor().moveBlock("a", "title", null);
  assert.deepEqual(editor().project!.slides[0].offsets, {});
  const unchanged = editor().past.length;
  editor().moveBlock("missing", "title", { x: 1, y: 1 });
  editor().organizeSlides(["a"]);
  assert.equal(editor().past.length, unchanged);
});
