import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchProfile, InstagramError, parseHandle, parseShortcode } from "./instagram.ts";

test("aceita os formatos de link de post", () => {
  assert.equal(parseShortcode("https://www.instagram.com/p/DeKt6XFj3DM/"), "DeKt6XFj3DM");
  assert.equal(parseShortcode("https://www.instagram.com/rdstation/p/DeNRkA5j4ru/?img_index=1"), "DeNRkA5j4ru");
  assert.equal(parseShortcode("instagram.com/reel/DeJQ5rUARUN"), "DeJQ5rUARUN");
  assert.equal(parseShortcode("https://instagram.com/tv/CryPPM8NXLa?igsh=abc"), "CryPPM8NXLa");
  assert.equal(parseShortcode("DeKt6XFj3DM"), "DeKt6XFj3DM");
});

test("recusa o que não é post", () => {
  assert.equal(parseShortcode("https://www.instagram.com/pelainteligencia/"), null);
  assert.equal(parseShortcode("https://example.com/p/abc"), null);
  assert.equal(parseShortcode(""), null);
});

test("lê o @ de várias formas", () => {
  assert.equal(parseHandle("@pelainteligencia"), "pelainteligencia");
  assert.equal(parseHandle("https://www.instagram.com/PelaInteligencia/"), "pelainteligencia");
  assert.equal(parseHandle("mlabs.br"), "mlabs.br");
  assert.equal(parseHandle("nome com espaço"), null);
  assert.equal(parseHandle("https://notinstagram.com/pelainteligencia/"), null);
  assert.equal(parseHandle("https://www.instagram.com/reels/"), null);
});

function profileEmbed(context: Record<string, unknown>): string {
  return `<script>{"contextJSON":${JSON.stringify(JSON.stringify({ context }))}}</script>`;
}

test("importa somente os dados e legendas presentes no embed público", async (t) => {
  const caption = "Uma ideia curta também faz parte da voz de quem escreve.";
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    requests += 1;
    assert.equal(url, "https://www.instagram.com/criadora/embed/");
    assert.equal(new Headers(init?.headers).get("user-agent"), "OpenAI File Downloader, XaiImageApiFetch/1.0");
    return new Response(profileEmbed({
      username: "criadora",
      full_name: " Ana Silva ",
      profile_pic_url: "https://images.example/avatar.jpg",
      is_verified: true,
      followers_count: 1234,
      graphql_media: [
        { shortcode_media: { edge_media_to_caption: { edges: [{ node: { text: ` ${caption} ` } }] } } },
        { shortcode_media: { edge_media_to_caption: { edges: [{ node: { text: caption } }] } } },
        { shortcode_media: { edge_media_to_caption: { edges: [{ node: { text: "Vamos criar?" } }] } } },
        { shortcode_media: {} },
      ],
    }));
  });

  assert.deepEqual(await fetchProfile("@Criadora"), {
    username: "criadora",
    fullName: "Ana Silva",
    avatarUrl: "https://images.example/avatar.jpg",
    verified: true,
    followers: 1234,
    captions: [caption, "Vamos criar?"],
  });
  assert.equal(requests, 1, "não busca publicações adicionais nem tenta mapear todo o perfil");
});

test("mantém a importação parcial quando o Instagram não fornece foto, nome ou legendas", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(profileEmbed({
    username: "criadora",
    full_name: " ",
    profile_pic_url: "",
    verified: false,
    followers_count: 0,
    graphql_media: [{ shortcode_media: { edge_media_to_caption: { edges: null } } }, null],
  })));

  assert.deepEqual(await fetchProfile("criadora"), {
    username: "criadora", fullName: null, avatarUrl: null, verified: false, followers: 0, captions: [],
  });
});

test("resposta bloqueada oferece preenchimento manual", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Too many requests", { status: 429 }));
  await assert.rejects(fetchProfile("criadora"), (error: unknown) => {
    assert.ok(error instanceof InstagramError);
    assert.match(error.message, /429/);
    assert.match(error.message, /manualmente/);
    return true;
  });
});

test("página sem perfil não confunde indisponibilidade com inexistência", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>Faça login no Instagram</html>"));
  await assert.rejects(fetchProfile("criadora"), (error: unknown) => {
    assert.ok(error instanceof InstagramError);
    assert.match(error.message, /leitura bloqueada/);
    assert.match(error.message, /manualmente/);
    return true;
  });
});
