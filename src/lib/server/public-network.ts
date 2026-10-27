import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { pipeline, Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

export class DestinationError extends Error {
  constructor() {
    super("Esse link aponta para um endereço que o Arrasta não abre.");
  }
}

type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;
type GetOptions = { headers?: Record<string, string>; signal?: AbortSignal };

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127));
  }
  if (family !== 6) return false;
  // URL normaliza IPv6, inclusive as formas com IPv4 decimal no final.
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const halves = normalized.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const words = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right].map((word) => parseInt(word, 16));
  return !(words.slice(0, 6).every((word) => word === 0) ||
    (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) ||
    (words[0] & 0xfe00) === 0xfc00 || (words[0] & 0xffc0) === 0xfe80 ||
    (words[0] & 0xffc0) === 0xfec0 || (words[0] & 0xff00) === 0xff00);
}

/** Rejeita também respostas DNS que misturam IP público e privado. */
export async function validatePublicUrl(input: string | URL, resolve: Resolver = publicNetwork.resolve): Promise<{ url: URL; addresses: Address[] }> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new DestinationError();
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new DestinationError();
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await resolve(hostname);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new DestinationError();
  return { url, addresses };
}

/** A conexão usa o IP validado, preservando Host e a verificação TLS do domínio. */
function requestPinned(url: URL, addresses: Address[], options: GetOptions): Promise<Response> {
  return new Promise((resolve, reject) => {
    const { address, family } = addresses[0];
    const request = (url.protocol === "https:" ? https : http).request(url, {
      method: "GET",
      headers: options.headers,
      signal: options.signal,
      agent: false,
      lookup: (_hostname, lookupOptions, callback) => {
        if (lookupOptions.all) callback(null, addresses);
        else callback(null, address, family);
      },
    }, (incoming) => {
      const status = incoming.statusCode ?? 502;
      if (status < 200 || status > 599) {
        incoming.destroy();
        reject(new Error("Resposta HTTP inválida."));
        return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
        else if (value !== undefined) headers.set(key, value);
      }
      const empty = [204, 205, 304].includes(status);
      if (empty) incoming.destroy();
      const encoding = headers.get("content-encoding")?.toLowerCase();
      const decoder = encoding === "gzip" ? createGunzip() : encoding === "deflate" ? createInflate() : encoding === "br" ? createBrotliDecompress() : null;
      // O orçamento de leitura vale também para o conteúdo descomprimido.
      const body = !empty && decoder ? pipeline(incoming, decoder, () => {}) : incoming;
      const stream = empty ? null : Readable.toWeb(body, {
        strategy: { highWaterMark: 64 * 1024, size: (chunk: Uint8Array) => chunk.byteLength },
      }) as ReadableStream<Uint8Array>;
      resolve(new Response(stream, { status, headers }));
    });
    request.on("error", reject);
    request.end();
  });
}

// Dependências substituíveis nos testes; nenhum teste precisa consultar DNS ou rede.
export const publicNetwork = {
  resolve: (hostname: string): Promise<Address[]> => lookup(hostname, { all: true, verbatim: true }),
  request: requestPinned,
};

export async function fetchPublicUrl(input: string | URL, options: GetOptions = {}): Promise<{ response: Response; url: URL }> {
  let current = input;
  for (let redirects = 0; ; redirects += 1) {
    options.signal?.throwIfAborted();
    const { url, addresses } = await validatePublicUrl(current);
    options.signal?.throwIfAborted();
    const response = await publicNetwork.request(url, addresses, options);
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url };
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location || redirects === 5) throw new Error("Não consegui abrir esse link: redirecionamentos demais ou sem destino.");
    try {
      current = new URL(location, url);
    } catch {
      throw new DestinationError();
    }
  }
}

/** Interrompe o download assim que o corpo ultrapassa o orçamento de bytes. */
export async function readLimitedBody(response: Response, maxBytes: number, error: Error): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, bytes);
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw error;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}
