import assert from "node:assert/strict";
import { test } from "node:test";
import { publicNetwork } from "./public-network.ts";
import { detectLink, fetchArticle, LinkError, youtubeId } from "./web.ts";

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
  assert.equal(id("https://www.youtube.com/@canal.exemplo"), null);
});

test("recusa o que não é link", () => {
  assert.equal(detectLink("nada aqui"), null);
  assert.equal(detectLink("localhost"), null);
});

test("artigo recusa destino privado com a mensagem pública", async (t) => {
  t.mock.method(publicNetwork, "request", async () => { assert.fail("não deve abrir conexão"); });
  await assert.rejects(fetchArticle(new URL("http://127.0.0.1/")), (error: unknown) => {
    assert.ok(error instanceof LinkError);
    assert.equal(error.message, "Esse link aponta para um endereço que o Arrasta não abre.");
    return true;
  });
});

test("artigo cancela a leitura acima de 5 MiB", async (t) => {
  t.mock.method(publicNetwork, "resolve", async () => [{ address: "8.8.8.8", family: 4 }]);
  let canceled = false;
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { canceled = true; },
  }, { highWaterMark: 0 });
  t.mock.method(publicNetwork, "request", async () => new Response(body, { headers: { "content-type": "text/html" } }));
  await assert.rejects(fetchArticle(new URL("https://site.example/")), /limite de leitura.*aba Texto/);
  assert.equal(canceled, true);
  assert.equal(pulls, 6);
});

test("artigo mantém o corte de texto e resolve a imagem a partir da página final", async (t) => {
  t.mock.method(publicNetwork, "resolve", async () => [{ address: "8.8.8.8", family: 4 }]);
  const paragraph = "Este é um exemplo fictício de artigo com conteúdo suficiente para a leitura. ".repeat(220);
  t.mock.method(publicNetwork, "request", async (...[url, _addresses, options]: Parameters<typeof publicNetwork.request>) => {
    assert.equal(options.headers?.["User-Agent"], "OpenAI File Downloader, XaiImageApiFetch/1.0");
    return url.pathname === "/start"
      ? new Response(null, { status: 302, headers: { Location: "/artigos/final" } })
      : new Response(`<html><head><title>Exemplo</title><meta property="og:image" content="card.png"></head><body><article><p>${paragraph}</p></article></body></html>`, { headers: { "content-type": "text/html" } });
  });
  const article = await fetchArticle(new URL("https://site.example/start"));
  assert.match(article.text, /\[texto cortado\]$/);
  assert.equal(article.text.length, 14000 + "\n\n[texto cortado]".length);
  assert.deepEqual(article.images, ["https://site.example/artigos/card.png"]);
});

test("artigo mantém o corte de HTML de três milhões de caracteres", async (t) => {
  t.mock.method(publicNetwork, "resolve", async () => [{ address: "8.8.8.8", family: 4 }]);
  const description = "Descrição fictícia suficientemente longa para manter uma leitura válida. ".repeat(4);
  const prefix = `<html><head><meta name="description" content="${description}"></head><body>`;
  const html = prefix + " ".repeat(3_000_000 - prefix.length) + "<p>MARCADOR DEPOIS DO CORTE</p></body></html>";
  t.mock.method(publicNetwork, "request", async () => new Response(html, { headers: { "content-type": "text/html" } }));
  const article = await fetchArticle(new URL("https://site.example/"));
  assert.match(article.text, /Descrição fictícia/);
  assert.doesNotMatch(article.text, /MARCADOR/);
});

test("erros de artigo orientam a usar a aba Texto", async (t) => {
  t.mock.method(publicNetwork, "resolve", async () => [{ address: "8.8.8.8", family: 4 }]);
  const mock = t.mock.method(publicNetwork, "request", async () => new Response("bloqueado", { status: 403 }));
  await assert.rejects(fetchArticle(new URL("https://site.example/")), /aba Texto/);
  mock.mock.restore();
  t.mock.method(publicNetwork, "request", async () => new Response("<html><body>curto</body></html>", { headers: { "content-type": "text/html" } }));
  await assert.rejects(fetchArticle(new URL("https://site.example/")), /aba Texto/);
});
