import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultDesign, makeImage, makeSlide } from "../defaults.ts";
import type { CoverOption, Project } from "../types.ts";
import { useEditor } from "./editor-store.ts";

test("trocar capa altera só título e texto, em um passo reversível", () => {
  const cover = makeSlide({ kind: "cover", title: "Capa atual", body: "Texto atual", image: makeImage("/imagem-de-teste.png") });
  const content = makeSlide({ title: "Conteúdo preservado" });
  const project: Project = {
    id: "covers-test", title: "Teste", createdAt: "", updatedAt: "", source: null,
    slides: [cover, content], design: defaultDesign(), caption: "Legenda", hashtags: ["teste"], chat: [], images: [],
  };
  const option: CoverOption = { angle: "Pergunta", title: "Qual é a **prioridade**?", body: "Veja como escolher." };
  useEditor.getState().load(project);
  useEditor.getState().updateSlide(cover.id, { title: option.title, body: option.body });
  const state = useEditor.getState();
  assert.equal(state.past.length, 1);
  assert.equal(state.revision, 1);
  assert.deepEqual(state.project!.slides[0], { ...cover, title: option.title, body: option.body });
  assert.equal(state.project!.slides[0].image, cover.image);
  assert.equal(state.project!.slides[1], content);
  assert.equal(state.project!.caption, project.caption);
  assert.deepEqual(state.project!.hashtags, project.hashtags);
  state.undo();
  assert.deepEqual(useEditor.getState().project!.slides, project.slides);
  useEditor.getState().redo();
  assert.equal(useEditor.getState().project!.slides[0].title, option.title);
});
