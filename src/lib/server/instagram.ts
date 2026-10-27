import { DestinationError, fetchPublicUrl, readLimitedBody } from "./public-network.ts";

/**
 * Leitura de posts e perfis públicos do Instagram pela página de incorporação (embed),
 * a mesma que sites usam para mostrar um post. A disponibilidade depende do Instagram;
 * os dados visíveis no embed são uma amostra, não um mapeamento completo do perfil.
 */
const HEADERS = {
  "User-Agent": "OpenAI File Downloader, XaiImageApiFetch/1.0",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

export const PROFILE_SAMPLE_LIMITS = { captions: 6, captionChars: 1200, totalChars: 6000 } as const;
const MAX_PROFILE_HTML_BYTES = 2 * 1024 * 1024;

export interface InstagramMedia {
  url: string;
  isVideo: boolean;
}

export interface InstagramPost {
  shortcode: string;
  url: string;
  author: { username: string; fullName: string | null; avatarUrl: string | null; verified: boolean } | null;
  caption: string;
  media: InstagramMedia[];
  likes: number | null;
  comments: number | null;
}

export interface InstagramProfile {
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  verified: boolean;
  followers: number | null;
  captions: string[];
  images: string[];
  sourceUrls: string[];
}

export class InstagramError extends Error {}

/** Preserva a ordem do embed sem enviar legendas repetidas ou texto além do orçamento. */
export function selectProfileCaptions(captions: string[]): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  let totalChars = 0;
  for (const caption of captions) {
    const sample = caption.trim().slice(0, PROFILE_SAMPLE_LIMITS.captionChars).trimEnd();
    if (!sample || seen.has(sample)) continue;
    const bounded = sample.slice(0, PROFILE_SAMPLE_LIMITS.totalChars - totalChars).trimEnd();
    if (!bounded) break;
    selected.push(bounded);
    seen.add(sample);
    totalChars += bounded.length;
    if (selected.length === PROFILE_SAMPLE_LIMITS.captions || totalChars === PROFILE_SAMPLE_LIMITS.totalChars) break;
  }
  return selected;
}

export function parseShortcode(input: string): string | null {
  const text = input.trim();
  const match = /instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/i.exec(text);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{9,14}$/.test(text) ? text : null;
}

export function parseHandle(input: string): string | null {
  const text = input.trim();
  const fromUrl = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i.exec(text);
  const handle = (fromUrl ? fromUrl[1] : text).replace(/^@+/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  const normalized = handle.toLowerCase();
  return ["accounts", "direct", "explore", "p", "reel", "reels", "stories", "tv"].includes(normalized) ? null : normalized;
}

async function fetchText(url: string, maxBytes?: number): Promise<string> {
  try {
    const response = await fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new InstagramError(`O Instagram respondeu ${response.status}. Tente de novo em instantes.`);
    if (!maxBytes) return await response.text();
    const data = await readLimitedBody(response, maxBytes, new InstagramError("A resposta do Instagram excedeu o limite de leitura do perfil."));
    return data.toString("utf8");
  } catch (error) {
    if (error instanceof InstagramError) throw error;
    throw new InstagramError("Não consegui falar com o Instagram. Confira sua internet e tente de novo.");
  }
}

/** A página de embed guarda os dados do post num JSON dentro de uma string ("contextJSON"). */
function readContextJson(html: string): Record<string, unknown> | null {
  const key = '"contextJSON":';
  const start = html.indexOf(key);
  if (start < 0) return null;
  try {
    let i = start + key.length;
    while (/\s/.test(html[i] ?? "")) i += 1;
    if (html[i] !== '"') return null;
    let end = i + 1;
    while (end < html.length) {
      if (html[end] === "\\") end += 2;
      else if (html[end] === '"') break;
      else end += 1;
    }
    const literal = JSON.parse(html.slice(i, end + 1)) as string;
    return JSON.parse(literal) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type Node = Record<string, unknown>;

function edges(value: unknown): Node[] {
  const list = (value as { edges?: unknown } | undefined)?.edges;
  if (!Array.isArray(list)) return [];
  return list.map((e) => e?.node).filter((n): n is Node => Boolean(n) && typeof n === "object");
}

function captionOf(media: Node): string {
  const first = edges(media.edge_media_to_caption)[0];
  return typeof first?.text === "string" ? first.text : "";
}

function profileImages(media: Node[]): { images: string[]; posts: Set<Node> } {
  const images: string[] = [];
  const posts = new Set<Node>();
  const addImage = (node: Node, post: Node): boolean => {
    if (node.is_video || typeof node.display_url !== "string" || !/^https:\/\//i.test(node.display_url) || images.includes(node.display_url)) return false;
    images.push(node.display_url);
    posts.add(post);
    return true;
  };
  let carousels = 0;
  for (const post of media) {
    let cards = 0;
    for (const child of edges(post.edge_sidecar_to_children)) {
      if (addImage(child, post)) cards += 1;
      if (cards === 2 || images.length === 4) break;
    }
    if (cards) carousels += 1;
    if (carousels === 2 || images.length === 4) break;
  }
  // Alguns embeds só expõem a capa, mesmo quando o post original é um carrossel.
  for (const post of media) {
    if (images.length === 4) break;
    if (!edges(post.edge_sidecar_to_children).length) addImage(post, post);
  }
  return { images, posts };
}

function count(value: unknown): number | null {
  const n = (value as { count?: unknown } | undefined)?.count;
  return typeof n === "number" ? n : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export async function fetchPost(input: string): Promise<InstagramPost> {
  const shortcode = parseShortcode(input);
  if (!shortcode) throw new InstagramError("Esse link não parece ser de um post do Instagram.");
  const url = `https://www.instagram.com/p/${shortcode}/`;
  const html = await fetchText(`${url}embed/captioned/`);
  const context = readContextJson(html);
  const media = (context?.gql_data as { shortcode_media?: Node } | null | undefined)?.shortcode_media;

  if (media) {
    const owner = (media.owner ?? {}) as Node;
    const children = edges(media.edge_sidecar_to_children);
    const items = (children.length ? children : [media]).map((node) => ({
      url: String(node.display_url ?? ""),
      isVideo: Boolean(node.is_video),
    }));
    return {
      shortcode,
      url,
      author: owner.username
        ? {
            username: String(owner.username),
            fullName: typeof owner.full_name === "string" ? owner.full_name : null,
            avatarUrl: typeof owner.profile_pic_url === "string" ? owner.profile_pic_url : null,
            verified: Boolean(owner.is_verified),
          }
        : null,
      caption: captionOf(media),
      media: items.filter((m) => m.url),
      likes: count(media.edge_liked_by) ?? count(media.edge_media_preview_like),
      comments: count(media.edge_media_to_comment),
    };
  }

  // Plano B: o embed simples mostra só a primeira imagem e a legenda.
  const image = /class="EmbeddedMediaImage"[^>]*src="([^"]+)"/.exec(html)?.[1];
  if (!image) {
    throw new InstagramError("Não consegui abrir esse post. Ele precisa ser público. Se for privado, envie os prints dos slides.");
  }
  const captionHtml = /<div class="Caption">([\s\S]*?)<div class="CaptionComments">/.exec(html)?.[1] ?? "";
  const username = /class="UsernameText">([^<]+)</.exec(html)?.[1] ?? null;
  const caption = decodeEntities(captionHtml)
    .replace(username ? new RegExp(`^\\s*${username}\\s*`) : /^/, "")
    .trim();
  return {
    shortcode,
    url,
    author: username ? { username, fullName: null, avatarUrl: null, verified: false } : null,
    caption,
    media: [{ url: decodeEntities(image), isVideo: false }],
    likes: null,
    comments: null,
  };
}

export async function fetchProfile(input: string): Promise<InstagramProfile> {
  const handle = parseHandle(input);
  if (!handle) throw new InstagramError("Digite um @ válido.");
  let html: string;
  try {
    html = await fetchText(`https://www.instagram.com/${handle}/embed/`, MAX_PROFILE_HTML_BYTES);
  } catch (error) {
    if (!(error instanceof InstagramError)) throw error;
    throw new InstagramError(`${error.message} Você pode preencher nome, foto e textos manualmente.`);
  }
  const context = (readContextJson(html)?.context ?? null) as Node | null;
  if (typeof context?.username !== "string" || !parseHandle(context.username)) {
    throw new InstagramError("O Instagram não disponibilizou os dados desse perfil. Ele pode ser privado, estar indisponível ou ter a leitura bloqueada. Confira o @ ou preencha nome, foto e textos manualmente.");
  }
  const posts = Array.isArray(context.graphql_media) ? (context.graphql_media as { shortcode_media?: Node }[]) : [];
  const media = posts.map((post) => post?.shortcode_media).filter((post): post is Node => Boolean(post) && typeof post === "object");
  const captions = selectProfileCaptions(media.map(captionOf));
  const visual = profileImages(media);
  const sampledPosts = new Set(visual.posts);
  const captionPosts = new Map<string, Node>();
  for (const post of media) {
    const sample = captionOf(post).trim().slice(0, PROFILE_SAMPLE_LIMITS.captionChars).trimEnd();
    if (sample && !captionPosts.has(sample)) captionPosts.set(sample, post);
  }
  for (const post of [...captionPosts.values()].slice(0, captions.length)) sampledPosts.add(post);
  const sourceUrls = [...new Set(media
    .filter((post) => sampledPosts.has(post) && typeof post.shortcode === "string" && /^[A-Za-z0-9_-]{5,}$/.test(post.shortcode))
    .map((post) => `https://www.instagram.com/p/${post.shortcode}/`))].slice(0, 6);
  return {
    username: String(context.username),
    fullName: typeof context.full_name === "string" ? context.full_name.trim() || null : null,
    avatarUrl: typeof context.profile_pic_url === "string" ? context.profile_pic_url.trim() || null : null,
    verified: Boolean(context.is_verified ?? context.verified),
    followers: typeof context.followers_count === "number" ? context.followers_count : null,
    captions,
    images: visual.images,
    sourceUrls,
  };
}

export async function downloadImage(url: string, userAgent = HEADERS["User-Agent"], maxBytes = 15 * 1024 * 1024): Promise<{ data: Buffer; type: string | null }> {
  let response: Response;
  try {
    ({ response } = await fetchPublicUrl(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(30000) }));
  } catch (error) {
    if (error instanceof DestinationError) throw new InstagramError(error.message);
    throw error;
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new InstagramError(`Não consegui baixar uma imagem (${response.status}).`);
  }
  const type = response.headers.get("content-type");
  if (type && !type.startsWith("image/")) {
    await response.body?.cancel();
    throw new InstagramError("O link da imagem não devolveu uma imagem.");
  }
  return { data: await readLimitedBody(response, Math.min(maxBytes, 15 * 1024 * 1024), new InstagramError("A imagem excedeu o limite de download.")), type };
}
