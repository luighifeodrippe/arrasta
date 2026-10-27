import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "node:http";
import { Readable } from "node:stream";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { DestinationError, fetchPublicUrl, publicNetwork, readLimitedBody, validatePublicUrl } from "./public-network.ts";

const publicAddress = { address: "8.8.8.8", family: 4 };
const forbidden = [
  "0.0.0.0", "0.255.255.255", "10.0.0.1", "10.255.255.255", "127.0.0.1", "127.255.255.255",
  "172.16.0.1", "172.31.255.255", "192.168.0.1", "169.254.0.1", "169.254.255.255",
  "100.64.0.1", "100.127.255.255", "224.0.0.1", "255.255.255.255",
  "::", "::1", "0:0:0:0:0:0:0:1", "fc00::1", "fdff:ffff::1", "fe80::1", "febf::1",
  "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:c0a8:101", "::ffff:8.8.8.8", "::127.0.0.1",
];

for (const address of forbidden) {
  test(`recusa destino literal e DNS proibido: ${address}`, async () => {
    const host = address.includes(":") ? `[${address}]` : address;
    await assert.rejects(validatePublicUrl(`http://${host}/`, async () => {
      assert.fail("não consulta DNS para IP literal");
    }), DestinationError);
    await assert.rejects(validatePublicUrl("https://site.example/", async () => [{ address, family: address.includes(":") ? 6 : 4 }]), {
      message: "Esse link aponta para um endereço que o Arrasta não abre.",
    });
  });
}

test("normaliza formas alternativas de IPv4 antes de decidir", async () => {
  for (const host of ["2130706433", "0x7f000001", "127.1", "0177.0.0.1"]) {
    await assert.rejects(validatePublicUrl(`http://${host}/`), DestinationError);
  }
});

test("recusa protocolos, credenciais e DNS vazio, inválido ou misto", async () => {
  for (const input of ["file:///etc/hosts", "ftp://site.example/", "data:text/plain,abc", "https://user:pass@site.example/", "não é uma URL"]) {
    await assert.rejects(validatePublicUrl(input, async () => { assert.fail("não consulta DNS"); }), DestinationError);
  }
  for (const addresses of [[], [{ address: "inválido", family: 4 }], [publicAddress, { address: "10.0.0.1", family: 4 }]]) {
    await assert.rejects(validatePublicUrl("https://site.example/", async () => addresses), DestinationError);
  }
});

test("aceita HTTP e HTTPS públicos e as bordas externas das faixas bloqueadas", async () => {
  for (const address of ["8.8.8.8", "100.63.255.255", "100.128.0.0", "172.15.255.255", "172.32.0.0", "169.253.255.255", "192.167.255.255", "2001:4860:4860::8888", "2606:4700:4700::1111"]) {
    const host = address.includes(":") ? `[${address}]` : address;
    for (const protocol of ["http:", "https:"]) {
      const result = await validatePublicUrl(`${protocol}//${host}/`);
      assert.equal(result.addresses[0].address, new URL(`${protocol}//${host}/`).hostname.replace(/^\[|\]$/g, ""));
    }
  }
  let resolved = "";
  const result = await validatePublicUrl("https://site.example/", async (hostname: string) => {
    resolved = hostname;
    return [publicAddress];
  });
  assert.equal(resolved, "site.example");
  assert.deepEqual(result.addresses, [publicAddress]);
});

test("valida cada salto, resolve Location relativa e cancela corpos de redirecionamento", async (t) => {
  const hosts: string[] = [];
  const urls: string[] = [];
  let canceled = false;
  t.mock.method(publicNetwork, "resolve", async (hostname: string) => { hosts.push(hostname); return [publicAddress]; });
  t.mock.method(publicNetwork, "request", async (...[url, addresses]: Parameters<typeof publicNetwork.request>) => {
    urls.push(url.href);
    assert.deepEqual(addresses, [publicAddress]);
    if (urls.length === 1) return new Response(new ReadableStream({ cancel() { canceled = true; } }), { status: 302, headers: { Location: "/final" } });
    return new Response("ok");
  });
  const { response, url } = await fetchPublicUrl("https://site.example/start");
  assert.equal(await response.text(), "ok");
  assert.equal(url.href, "https://site.example/final");
  assert.deepEqual(hosts, ["site.example", "site.example"]);
  assert.deepEqual(urls, ["https://site.example/start", "https://site.example/final"]);
  assert.equal(canceled, true);
});

test("não faz a requisição de um redirecionamento para IP privado, DNS privado ou protocolo proibido", async (t) => {
  t.mock.method(publicNetwork, "resolve", async (hostname: string) => [{ address: hostname === "private.example" ? "192.168.1.1" : "8.8.8.8", family: 4 }]);
  for (const location of ["http://127.0.0.1/", "https://private.example/", "file:///etc/hosts", "http://[::ffff:7f00:1]/"]) {
    let requests = 0;
    const mock = t.mock.method(publicNetwork, "request", async () => {
      requests += 1;
      return new Response(null, { status: 307, headers: { Location: location } });
    });
    await assert.rejects(fetchPublicUrl("https://site.example/"), DestinationError);
    assert.equal(requests, 1);
    mock.mock.restore();
  }
});

test("aceita cinco redirecionamentos e recusa o sexto sem segui-lo", async (t) => {
  t.mock.method(publicNetwork, "resolve", async () => [publicAddress]);
  let requests = 0;
  const mock = t.mock.method(publicNetwork, "request", async () => {
    requests += 1;
    return requests <= 5 ? new Response(null, { status: 308, headers: { Location: "/next" } }) : new Response("fim");
  });
  assert.equal(await (await fetchPublicUrl("https://site.example/")).response.text(), "fim");
  assert.equal(requests, 6);
  mock.mock.restore();
  requests = 0;
  t.mock.method(publicNetwork, "request", async () => {
    requests += 1;
    return new Response(null, { status: 301, headers: { Location: "/loop" } });
  });
  await assert.rejects(fetchPublicUrl("https://site.example/"), /redirecionamentos/);
  assert.equal(requests, 6);
});

test("bloqueia uma mudança de DNS entre saltos", async (t) => {
  let resolutions = 0;
  let requests = 0;
  t.mock.method(publicNetwork, "resolve", async () => [{ address: ++resolutions === 1 ? "8.8.8.8" : "10.0.0.1", family: 4 }]);
  t.mock.method(publicNetwork, "request", async () => {
    requests += 1;
    return new Response(null, { status: 303, headers: { Location: "/next" } });
  });
  await assert.rejects(fetchPublicUrl("https://site.example/"), DestinationError);
  assert.equal(requests, 1);
});

test("transporte fixa o IP aprovado, mantém o domínio e descomprime sem rede", async (t) => {
  const payload = "conteúdo público";
  t.mock.method(http, "request", (url: URL, options: http.RequestOptions, callback: (incoming: Readable) => void) => {
    assert.equal(String(url), "http://site.example/");
    assert.equal(options.agent, false);
    assert.deepEqual(options.headers, { "User-Agent": "OpenAI File Downloader, XaiImageApiFetch/1.0" });
    Reflect.apply(options.lookup!, null, ["site.example", {}, (error: unknown, address: string, family: number) => {
      assert.equal(error, null);
      assert.equal(address, "8.8.8.8");
      assert.equal(family, 4);
    }]);
    Reflect.apply(options.lookup!, null, ["site.example", { all: true }, (error: unknown, addresses: unknown) => {
      assert.equal(error, null);
      assert.deepEqual(addresses, [publicAddress]);
    }]);
    const incoming = Object.assign(Readable.from([gzipSync(payload)]), { statusCode: 200, headers: { "content-encoding": "gzip" } });
    return Object.assign(new EventEmitter(), { end() { callback!(incoming); } });
  });
  const response = await publicNetwork.request(new URL("http://site.example/"), [publicAddress], {
    headers: { "User-Agent": "OpenAI File Downloader, XaiImageApiFetch/1.0" },
  });
  assert.equal(await response.text(), payload);
});

test("leitura incremental aceita o limite exato e cancela no primeiro pedaço excedente", async () => {
  assert.deepEqual(await readLimitedBody(new Response(new Uint8Array(4)), 4, new Error("grande")), Buffer.alloc(4));
  let canceled = false;
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(3)); },
    cancel() { canceled = true; },
  }, { highWaterMark: 0 });
  await assert.rejects(readLimitedBody(new Response(body), 4, new Error("grande")), /grande/);
  assert.equal(canceled, true);
  assert.equal(pulls, 2);
});

test("cancelar o corpo do transporte fecha a origem, inclusive comprimida", async (t) => {
  for (const encoding of [undefined, "gzip"]) {
    const incoming = Object.assign(new Readable({ read() {} }), {
      statusCode: 200,
      headers: encoding ? { "content-encoding": encoding } : {},
    });
    const mock = t.mock.method(http, "request", (_url: URL, _options: http.RequestOptions, callback: (body: Readable) => void) =>
      Object.assign(new EventEmitter(), { end() { callback(incoming); } }));
    const response = await publicNetwork.request(new URL("http://site.example/"), [publicAddress], {});
    const closed = new Promise<void>((resolve) => incoming.once("close", resolve));
    await response.body!.cancel();
    await closed;
    assert.equal(incoming.destroyed, true);
    mock.mock.restore();
  }
});

test("destino inicial inválido e Location inválida recebem a mensagem de bloqueio", async (t) => {
  await assert.rejects(fetchPublicUrl("inválido"), DestinationError);
  t.mock.method(publicNetwork, "resolve", async () => [publicAddress]);
  t.mock.method(publicNetwork, "request", async () => new Response(null, { status: 302, headers: { Location: "http://[inválido]/" } }));
  await assert.rejects(fetchPublicUrl("https://site.example/"), DestinationError);
});

test("timeout durante DNS não permite abrir a conexão depois", async (t) => {
  const controller = new AbortController();
  t.mock.method(publicNetwork, "resolve", async () => { controller.abort(); return [publicAddress]; });
  t.mock.method(publicNetwork, "request", async () => { assert.fail("não deve abrir conexão depois de cancelar"); });
  await assert.rejects(fetchPublicUrl("https://site.example/", { signal: controller.signal }), /abort/i);
});
