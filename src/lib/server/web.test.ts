import assert from "node:assert/strict";
import { test } from "node:test";
import { detectLink, youtubeId } from "./web.ts";

test("separa Instagram, X e sites", () => {
  assert.equal(detectLink("https://www.instagram.com/p/DeKt6XFj3DM/")?.kind, "instagram");
  assert.equal(detectLink("instagram.com/reel/DeJQ5rUARUN")?.kind, "instagram");
  assert.equal(detectLink("https://x.com/OpenAIDevs/status/2108269021430710412")?.kind, "x");
  assert.equal(detectLink("https://twitter.com/jack/status/20?s=20")?.kind, "x");
  assert.equal(detectLink("https://x.com/OpenAIDevs")?.kind, "x");
  assert.equal(detectLink("paulgraham.com/greatwork.html")?.kind, "web");
  assert.equal(detectLink("https://youtu.be/w0R29uK3Hfk?si=abc")?.kind, "youtube");
  assert.equal(detectLink("m.youtube.com/watch?v=w0R29uK3Hfk")?.kind, "youtube");
});

test("acha o id do vídeo em todo tipo de link do YouTube", () => {
  const id = (link: string) => youtubeId(detectLink(link)!.url);
  assert.equal(id("https://www.youtube.com/watch?v=w0R29uK3Hfk&t=42s"), "w0R29uK3Hfk");
  assert.equal(id("https://youtu.be/w0R29uK3Hfk?si=abc"), "w0R29uK3Hfk");
  assert.equal(id("https://www.youtube.com/shorts/w0R29uK3Hfk"), "w0R29uK3Hfk");
  assert.equal(id("https://www.youtube-nocookie.com/embed/w0R29uK3Hfk"), "w0R29uK3Hfk");
  assert.equal(id("https://www.youtube.com/@kaye.creatives"), null);
});

test("recusa o que não é link", () => {
  assert.equal(detectLink("nada aqui"), null);
  assert.equal(detectLink("localhost"), null);
});
