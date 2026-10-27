import assert from "node:assert/strict";
import { test } from "node:test";
import { publicNetwork } from "./public-network.ts";
import { downloadImage, fetchProfile, InstagramError, parseHandle, parseShortcode, selectProfileCaptions } from "./instagram.ts";

test("aceita os formatos de link de post", () => {
  assert.equal(parseShortcode("https://www.instagram.com/p/DeKt6XFj3DM/"), "DeKt6XFj3DM");
  assert.equal(parseShortcode("https://www.instagram.com/rdstation/p/DeNRkA5j4ru/?img_index=1"), "DeNRkA5j4ru");
  assert.equal(parseShortcode("instagram.com/reel/DeJQ5rUARUN"), "DeJQ5rUARUN");
  assert.equal(parseShortcode("https://instagram.com/tv/CryPPM8NXLa?igsh=abc"), "CryPPM8NXLa");
  assert.equal(parseShortcode("DeKt6XFj3DM"), "DeKt6XFj3DM");
});

test("recusa o que não é post", () => {
  assert.equal(parseShortcode("https://www.instagram.com/perfil.exemplo/"), null);
  assert.equal(parseShortcode("https://example.com/p/abc"), null);
  assert.equal(parseShortcode(""), null);
});

test("lê o @ de várias formas", () => {
  assert.equal(parseHandle("@perfil.exemplo"), "perfil.exemplo");
  assert.equal(parseHandle("https://www.instagram.com/Perfil.Exemplo/"), "perfil.exemplo");
  assert.equal(parseHandle("mlabs.br"), "mlabs.br");
  assert.equal(parseHandle("nome com espaço"), null);
  assert.equal(parseHandle("https://notinstagram.com/perfil.exemplo/"), null);
  assert.equal(parseHandle("https://www.instagram.com/reels/"), null);
});

function profileEmbed(context: Record<string, unknown>): string {
  return `<script>{"contextJSON":${JSON.stringify(JSON.stringify({ context }))}}</script>`;
}

test("seleciona até seis legendas distintas, na ordem do perfil", () => {
  assert.deepEqual(
    selectProfileCaptions([" ", " primeira ", "primeira", "segunda", "terceira", "quarta", "quinta", "sexta", "sétima"]),
    ["primeira", "segunda", "terceira", "quarta", "quinta", "sexta"],
  );
});

test("limita cada legenda a 1.200 caracteres e deduplica o trecho enviado", () => {
  const prefix = "a".repeat(1200);
  assert.deepEqual(selectProfileCaptions([`${prefix}fim`, `${prefix}outro fim`, "segunda"]), [prefix, "segunda"]);
});

test("limita a amostra a 6.000 caracteres, aproveitando o espaço restante", () => {
  const captions = ["a", "b", "c", "d", "e", "f", "g"].map((letter) => letter.repeat(1100));
  const selected = selectProfileCaptions(captions);
  assert.deepEqual(selected, [...captions.slice(0, 5), "f".repeat(500)]);
  assert.equal(selected.join("").length, 6000);
});

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
    images: [],
    sourceUrls: [],
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
    username: "criadora", fullName: null, avatarUrl: null, verified: false, followers: 0, captions: [], images: [], sourceUrls: [],
  });
});

test("a consulta de perfil aplica o orçamento sem buscar posts adicionais", async (t) => {
  const captions = ["a", "b", "c", "d", "e", "f", "g"].map((letter) => letter.repeat(1500));
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests += 1;
    return new Response(profileEmbed({
      username: "criadora",
      graphql_media: captions.map((text) => ({ shortcode_media: { edge_media_to_caption: { edges: [{ node: { text } }] } } })),
    }));
  });
  const profile = await fetchProfile("criadora");
  assert.deepEqual(profile.captions, captions.slice(0, 5).map((caption) => caption.slice(0, 1200)));
  assert.equal(profile.captions.join("").length, 6000);
  assert.equal(requests, 1);
});

test("prioriza dois cards sem vídeo de até dois carrosséis e preserva as fontes", async (t) => {
  let requests = 0;
  const card = (id: number) => ({ display_url: `https://images.example/${id}.jpg`, is_video: false });
  const carousel = (shortcode: string, nodes: object[]) => ({
    shortcode_media: { shortcode, edge_sidecar_to_children: { edges: nodes.map((node) => ({ node })) } },
  });
  t.mock.method(globalThis, "fetch", async () => {
    requests += 1;
    return new Response(profileEmbed({
      username: "criadora",
      graphql_media: [
        { shortcode_media: { shortcode: "SINGLE1", ...card(0) } },
        carousel("CAROUSEL1", [{ ...card(10), is_video: true }, card(1), card(2), card(3)]),
        carousel("CAROUSEL2", [card(1), card(4), card(5)]),
        carousel("CAROUSEL3", [card(6), card(7)]),
      ],
    }));
  });
  const profile = await fetchProfile("criadora");
  assert.deepEqual(profile.images, [1, 2, 4, 5].map((id) => `https://images.example/${id}.jpg`));
  assert.deepEqual(profile.sourceUrls, ["https://www.instagram.com/p/CAROUSEL1/", "https://www.instagram.com/p/CAROUSEL2/"]);
  assert.equal(requests, 1, "não baixa as imagens nem abre os posts");
});

test("usa capas disponíveis como fallback, sem repetir imagens nem incluir vídeos", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(profileEmbed({
    username: "criadora",
    graphql_media: [
      { shortcode_media: { shortcode: "TEXT001", edge_media_to_caption: { edges: [{ node: { text: "Legenda sem imagem." } }] } } },
      { shortcode_media: { shortcode: "SINGLE1", display_url: "https://images.example/cover.jpg" } },
      { shortcode_media: { shortcode: "SINGLE2", display_url: "https://images.example/cover.jpg" } },
      { shortcode_media: { shortcode: "REELS01", display_url: "https://images.example/video.jpg", is_video: true } },
    ],
  })));
  const profile = await fetchProfile("criadora");
  assert.deepEqual(profile.images, ["https://images.example/cover.jpg"]);
  assert.deepEqual(profile.sourceUrls, ["https://www.instagram.com/p/TEXT001/", "https://www.instagram.com/p/SINGLE1/"]);
});

test("as fontes apontam para as legendas selecionadas, limitadas a seis posts", async (t) => {
  const captions = ["Texto maior", "Texto", "C", "D", "E", "F", "G"];
  t.mock.method(globalThis, "fetch", async () => new Response(profileEmbed({
    username: "criadora",
    graphql_media: captions.map((text, index) => ({
      shortcode_media: { shortcode: `POST000${index}`, edge_media_to_caption: { edges: [{ node: { text } }] } },
    })),
  })));
  const profile = await fetchProfile("criadora");
  assert.deepEqual(profile.sourceUrls, captions.slice(0, 6).map((_, index) => `https://www.instagram.com/p/POST000${index}/`));
});

test("interrompe HTML de perfil acima de 2 MiB e mantém a opção manual", async (t) => {
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); },
    cancel() { canceled = true; },
  });
  t.mock.method(globalThis, "fetch", async () => new Response(body));
  await assert.rejects(fetchProfile("criadora"), (error: unknown) => {
    assert.ok(error instanceof InstagramError);
    assert.match(error.message, /limite de leitura/);
    assert.match(error.message, /manualmente/);
    return true;
  });
  assert.equal(canceled, true);
});

test("download de imagem respeita o limite de bytes informado", async (t) => {
  t.mock.method(publicNetwork, "resolve", async () => [{ address: "8.8.8.8", family: 4 }]);
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(5)); },
    cancel() { canceled = true; },
  });
  t.mock.method(publicNetwork, "request", async () => new Response(body, { headers: { "Content-Type": "image/png" } }));
  await assert.rejects(downloadImage("https://images.example/card.png", undefined, 4), /limite de download/);
  assert.equal(canceled, true);
});

test("download permite imagem dentro do limite e usa o User-Agent exigido", async (t) => {
  t.mock.method(publicNetwork, "resolve", async () => [{ address: "8.8.8.8", family: 4 }]);
  t.mock.method(publicNetwork, "request", async (...[_url, _addresses, init]: Parameters<typeof publicNetwork.request>) => {
    assert.equal(new Headers(init?.headers).get("user-agent"), "OpenAI File Downloader, XaiImageApiFetch/1.0");
    return new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "Content-Type": "image/png" } });
  });
  const image = await downloadImage("https://images.example/card.png", undefined, 4);
  assert.deepEqual([...image.data], [1, 2, 3, 4]);
  assert.equal(image.type, "image/png");
});

test("download de imagem recusa destino privado antes da conexão", async (t) => {
  t.mock.method(publicNetwork, "request", async () => { assert.fail("não deve abrir conexão"); });
  await assert.rejects(downloadImage("http://[::ffff:127.0.0.1]/card.png"), (error: unknown) => {
    assert.ok(error instanceof InstagramError);
    assert.equal(error.message, "Esse link aponta para um endereço que o Arrasta não abre.");
    return true;
  });
});

test("download aceita exatamente 15 MiB e impõe o teto mesmo com limite maior", async (t) => {
  t.mock.method(publicNetwork, "resolve", async () => [{ address: "8.8.8.8", family: 4 }]);
  const maxBytes = 15 * 1024 * 1024;
  const mock = t.mock.method(publicNetwork, "request", async () => new Response(new Uint8Array(maxBytes), { headers: { "content-type": "image/png" } }));
  assert.equal((await downloadImage("https://images.example/card.png")).data.byteLength, maxBytes);
  mock.mock.restore();
  let canceled = false;
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { canceled = true; },
  }, { highWaterMark: 0 });
  t.mock.method(publicNetwork, "request", async () => new Response(body, { headers: { "content-type": "image/png" } }));
  await assert.rejects(downloadImage("https://images.example/card.png", undefined, maxBytes * 2), /limite de download/);
  assert.equal(canceled, true);
  assert.equal(pulls, 16);
});

test("imagem redirecionada não pode acessar DNS privado", async (t) => {
  let requests = 0;
  t.mock.method(publicNetwork, "resolve", async (hostname: string) => [{ address: hostname === "images.example" ? "8.8.8.8" : "10.0.0.1", family: 4 }]);
  t.mock.method(publicNetwork, "request", async () => {
    requests += 1;
    return new Response(null, { status: 302, headers: { Location: "https://private.example/card.png" } });
  });
  await assert.rejects(downloadImage("https://images.example/card.png"), /Esse link aponta/);
  assert.equal(requests, 1);
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
