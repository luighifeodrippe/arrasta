import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultDesign, makeSlide, MAX_SLIDES } from "../defaults.ts";
import type { Project } from "../types.ts";
import { useEditor } from "./editor-store.ts";
import { anchorRoom, anchoredScroll, cardWidth, clampZoom, DEFAULT_ZOOM, intersects, selectionRect, stepZoom, zoomAnchor } from "./stage-math.ts";

const project = (count = 4): Project => ({
  id: "stage-test", title: "Palco", createdAt: "", updatedAt: "", source: null,
  slides: Array.from({ length: count }, (_, index) => makeSlide({ id: `s${index}`, title: `Slide ${index}` })),
  design: defaultDesign(), caption: "", hashtags: [], chat: [], images: [],
});

test("zoom contínuo respeita limites e passos multiplicativos reversíveis", () => {
  assert.equal(DEFAULT_ZOOM, 0.72);
  assert.equal(clampZoom(-1), 0.3);
  assert.equal(clampZoom(9), 2.5);
  assert.equal(clampZoom(0.813), 0.813);
  assert.ok(Math.abs(stepZoom(0.72, 1) - 0.9) < 1e-12);
  assert.ok(Math.abs(stepZoom(0.9, -1) - 0.72) < 1e-12);
  assert.equal(stepZoom(2.5, 1), 2.5);
  assert.equal(stepZoom(0.3, -1), 0.3);
});

test("largura segue altura × zoom na linha, sem teto, e o clamp da coluna", () => {
  for (const ratio of [1440 / 1080, 1350 / 1080]) {
    assert.equal(cardWidth(600, 0.72, ratio, "row", 900), 432 / ratio);
    assert.equal(cardWidth(600, 2.5, ratio, "row", 900), 1500 / ratio);
    assert.ok(cardWidth(600, 2.5, ratio, "row", 900) > 440);
  }
  assert.ok(Math.abs(cardWidth(600, 0.72, 4 / 3, "column", 900) - 440) < 1e-10);
  assert.equal(cardWidth(600, 0.3, 4 / 3, "column", 900), 440 * 0.3 / 0.72);
  assert.equal(cardWidth(600, 2.5, 4 / 3, "column", 900), 852);
  assert.equal(cardWidth(600, 0.01, 4 / 3, "column", 900), 160);
  assert.equal(cardWidth(600, 0.72, 4 / 3, "column", 180), 132);
});

test("seleção funciona em todas as direções e inclui cards que apenas encostam", () => {
  const rect = selectionRect({ x: 80, y: 90 }, { x: 20, y: 30 });
  assert.deepEqual(rect, { left: 20, top: 30, width: 60, height: 60 });
  assert.ok(intersects(rect, { left: 80, top: 90, width: 30, height: 30 }));
  assert.ok(intersects(rect, { left: 30, top: 40, width: 2, height: 2 }));
  assert.ok(!intersects(rect, { left: 81, top: 90, width: 30, height: 30 }));
  assert.ok(!intersects(rect, { left: 20, top: 91, width: 30, height: 30 }));
});

test("âncora mantém o ponto sob o cursor, mesmo com origens, gaps e rolagens diferentes", () => {
  for (const pointer of [{ x: 180, y: 170 }, { x: 480, y: 700 }]) {
    const before = { left: 100, top: 50, width: 300, height: 400 };
    const scroll = { x: 320, y: 80 };
    const after = { left: 140, top: 80, width: 600, height: 800 };
    const fraction = zoomAnchor(pointer, before);
    const next = anchoredScroll(scroll, pointer, fraction, after);
    assert.equal(after.left + fraction.x * after.width - (next.x - scroll.x), pointer.x);
    assert.equal(after.top + fraction.y * after.height - (next.y - scroll.y), pointer.y);
  }
});

test("âncora abre espaço nas bordas, inclusive quando o conteúdo cabe na tela", () => {
  assert.deepEqual(anchorRoom({ x: -20, y: -30 }, { x: 500, y: 600 }, { x: 900, y: 800 }), { left: 20, top: 30, right: 0, bottom: 0 });
  assert.deepEqual(anchorRoom({ x: 20, y: 30 }, { x: 500, y: 600 }, { x: 900, y: 800 }), { left: 0, top: 0, right: 420, bottom: 230 });
  assert.deepEqual(anchorRoom({ x: 20, y: 30 }, { x: 1200, y: 1000 }, { x: 900, y: 800 }), { left: 0, top: 0, right: 0, bottom: 0 });
});

test("duplicar em lote intercala as cópias e ocupa um único passo do desfazer", () => {
  const original = project();
  useEditor.getState().load(original);
  useEditor.getState().duplicateSlides(["s0", "s2", "s0", "inexistente"]);
  const state = useEditor.getState();
  assert.deepEqual(state.project!.slides.map((s) => s.title), ["Slide 0", "Slide 0", "Slide 1", "Slide 2", "Slide 2", "Slide 3"]);
  assert.equal(new Set(state.project!.slides.map((s) => s.id)).size, 6);
  assert.equal(state.selection.length, 2);
  assert.equal(state.past.length, 1);
  state.undo();
  assert.deepEqual(useEditor.getState().project!.slides, original.slides);
  assert.deepEqual(useEditor.getState().selection, []);
  useEditor.getState().redo();
  assert.equal(useEditor.getState().project!.slides.length, 6);
  assert.deepEqual(useEditor.getState().selection, []); // Não faz parte do histórico.
});

test("duplicar em lote respeita o limite de slides e ids inexistentes não criam histórico", () => {
  useEditor.getState().load(project(MAX_SLIDES - 1));
  useEditor.getState().duplicateSlides(["s0", "s1"]);
  assert.equal(useEditor.getState().project!.slides.length, MAX_SLIDES);
  assert.equal(useEditor.getState().selection.length, 1);
  useEditor.getState().load(project());
  useEditor.getState().duplicateSlides(["ausente"]);
  useEditor.getState().removeSlides(["ausente"]);
  assert.equal(useEditor.getState().past.length, 0);
});

test("excluir em lote é um passo só, limpa ids sumidos e nunca zera o projeto", () => {
  useEditor.getState().load(project());
  useEditor.getState().setSelection(["s0", "s1", "s2"]);
  useEditor.getState().removeSlides(["s0", "s2"]);
  let state = useEditor.getState();
  assert.deepEqual(state.project!.slides.map((s) => s.id), ["s1", "s3"]);
  assert.deepEqual(state.selection, ["s1"]);
  assert.equal(state.selectedId, "s1");
  assert.equal(state.past.length, 1);
  state.undo();
  assert.equal(useEditor.getState().project!.slides.length, 4);
  useEditor.getState().removeSlides(["s0", "s1", "s2", "s3"]);
  state = useEditor.getState();
  assert.equal(state.project!.slides.length, 1);
  state.removeSlides([state.project!.slides[0].id]);
  assert.equal(useEditor.getState().project!.slides.length, 1);
});

test("seleção valida ids e não entra no histórico; select e load limpam", () => {
  useEditor.getState().load(project());
  useEditor.getState().setSelection(["s0", "s0", "s1", "ausente"]);
  assert.deepEqual(useEditor.getState().selection, ["s0", "s1"]);
  useEditor.getState().toggleInSelection("s1");
  assert.deepEqual(useEditor.getState().selection, ["s0"]);
  useEditor.getState().clearSelection();
  useEditor.getState().toggleInSelection("s2");
  assert.deepEqual(useEditor.getState().selection, ["s0", "s2"]);
  assert.equal(useEditor.getState().past.length, 0);
  assert.equal(useEditor.getState().revision, 0);
  useEditor.getState().select("s1");
  assert.deepEqual(useEditor.getState().selection, []);
  useEditor.getState().setSelection(["s0", "s1"]);
  useEditor.getState().load(project(1));
  assert.deepEqual(useEditor.getState().selection, []);
});

test("replace, removeSlide, undo e redo eliminam ids ausentes sem restaurar seleção", () => {
  useEditor.getState().load(project());
  useEditor.getState().setSelection(["s0", "s1", "s2"]);
  useEditor.getState().removeSlide("s1");
  assert.deepEqual(useEditor.getState().selection, ["s0", "s2"]);
  useEditor.getState().replace({ slides: [makeSlide({ id: "novo" }), makeSlide({ id: "s2" })] });
  assert.deepEqual(useEditor.getState().selection, ["s2"]);
  useEditor.getState().setSelection(["novo", "s2"]);
  useEditor.getState().undo();
  assert.deepEqual(useEditor.getState().selection, ["s2"]);
  useEditor.getState().setSelection(["s0", "s2"]);
  useEditor.getState().redo();
  assert.deepEqual(useEditor.getState().selection, ["s2"]);
});
