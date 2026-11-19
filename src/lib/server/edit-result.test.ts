import assert from "node:assert/strict";
import { test } from "node:test";
import { makeImage, makeSlide, MAX_SLIDES } from "../defaults.ts";
import type { EditResult } from "./prompts.ts";
import { applyEditResult } from "./edit-result.ts";

const images = ["/api/assets/projeto/img-1.jpg", "/api/assets/projeto/img-2.jpg"];
const current = [
  makeSlide({
    id: "capa",
    kind: "cover",
    title: "Capa atual",
    image: makeImage("/api/assets/projeto/anterior.jpg", { mode: "background", fit: "contain", zoom: 2, focusX: 20 }),
    background: "#123456",
    imageIdea: "Sugestão atual",
    valign: "bottom",
    gap: 2,
    titleStyle: { color: "#ffffff", align: "left", size: 1.2, leading: 1, tracking: 0 },
    offsets: { title: { x: 10, y: 20 } },
  }),
  makeSlide({ id: "conteudo", title: "Texto atual", image: makeImage("/api/assets/projeto/outra.jpg") }),
  makeSlide({ id: "sem-imagem", title: "Sem imagem" }),
];

function edited(id: string, image: number | null): EditResult["slides"][number] {
  return { id, kind: "content", tag: "Novo", title: "Título editado", body: "Texto editado", image, picture: null };
}

test("aplica imagens por número base 1 e encontra o slide anterior pelo id, mesmo em outra ordem", () => {
  const before = structuredClone(current);
  const result = [edited("conteudo", 2), edited("capa", 1)];
  const slides = applyEditResult(current, result, images);
  assert.deepEqual(slides.map((slide) => slide.id), ["conteudo", "capa"]);
  assert.deepEqual(slides[0].image, makeImage(images[1], { mode: "inline" }));
  assert.deepEqual(slides[1].image, makeImage(images[0], { mode: "background" }));
  assert.deepEqual(slides[1], { ...current[0], kind: "content", tag: "Novo", title: "Título editado", body: "Texto editado", image: makeImage(images[0], { mode: "background" }) });
  assert.deepEqual(current, before);
  assert.deepEqual(result, [edited("conteudo", 2), edited("capa", 1)]);
});

test("image null mantém a imagem inteira, incluindo recorte, e permite anexos não usados", () => {
  const [slide] = applyEditResult(current, [edited("capa", null)], images);
  assert.equal(slide.image, current[0].image);
  assert.equal(slide.title, "Título editado");
  assert.deepEqual(images, ["/api/assets/projeto/img-1.jpg", "/api/assets/projeto/img-2.jpg"]);
});

test("números inválidos são tratados como null sem perder a imagem anterior", () => {
  for (const image of [0, -1, 3, 1.5, NaN, Infinity]) {
    const [slide] = applyEditResult(current, [edited("capa", image)], images);
    assert.equal(slide.image, current[0].image, String(image));
  }
});

test("sem anexos, até um número de imagem devolvido por engano preserva as imagens atuais", () => {
  for (const image of [null, 1]) {
    const slides = applyEditResult(current, [edited("capa", image), edited("sem-imagem", image)], []);
    assert.equal(slides[0].image, current[0].image);
    assert.equal(slides[1].image, null);
  }
});

test("slides sem imagem e slides novos recebem a imagem em modo inline", () => {
  const slides = applyEditResult(current, [edited("sem-imagem", 1), edited("novo", 2), edited("novo", null)], images);
  assert.deepEqual(slides[0].image, makeImage(images[0]));
  assert.deepEqual(slides[1].image, makeImage(images[1]));
  assert.equal(slides[2].image, null);
  for (const slide of slides.slice(1)) {
    assert.notEqual(slide.id, "novo");
    assert.ok(slide.id);
    assert.equal(slide.kind, "content");
    assert.equal(slide.body, "Texto editado");
  }
  assert.notEqual(slides[1].id, slides[2].id);
});

test("mantém o limite de slides do editor e aceita resultado vazio", () => {
  const result = Array.from({ length: MAX_SLIDES + 1 }, () => edited("novo", null));
  assert.equal(applyEditResult(current, result, images).length, MAX_SLIDES);
  assert.deepEqual(applyEditResult(current, [], images), []);
});
