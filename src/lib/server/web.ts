import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { DestinationError, fetchPublicUrl, readLimitedBody } from "./public-network.ts";

/** Leitura de posts do X e de páginas da web, para virar carrossel. */
const BROWSER_UA =
  "OpenAI File Downloader, XaiImageApiFetch/1.0";
const MAX_TEXT = 14000;

export class LinkError extends Error {}

export type LinkKind = "instagram" | "x" | "youtube" | "web";

export function detectLink(input: string): { kind: LinkKind; url: URL } | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  if (!/\./.test(url.hostname)) return null;
  const host = url.hostname.replace(/^www\.|^m\.|^mobile\.|^music\./, "");
  if (host === "instagram.com" || host === "instagr.am") return { kind: "instagram", url };
  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") return { kind: "youtube", url };
  // Links do X que não são de um post (perfil, busca) recebem uma explicação clara em fetchTweet.
  if (host === "x.com" || host === "twitter.com") return { kind: "x", url };
  return { kind: "web", url };
}

export interface LinkContent {
  url: string;
  /** Duração em segundos (vídeos). */
  duration?: number | null;
  title: string | null;
  text: string;
  site: string | null;
  author: { username: string; fullName: string | null; avatarUrl: string | null; verified: boolean } | null;
  images: string[];
  likes: number | null;
  comments: number | null;
}

/** Mesma conta que o widget oficial de incorporação do X usa para assinar o pedido. */
function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(6 ** 2).replace(/(0+|\.)/g, "");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

export async function fetchTweet(url: URL): Promise<LinkContent> {
  const id = /\/status(?:es)?\/(\d+)/.exec(url.pathname)?.[1];
  if (!id) throw new LinkError("Cole o link de um post do X (o endereço tem /status/ no meio).");
  let data: Record<string, unknown>;
  try {
    const response = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=pt&token=${syndicationToken(id)}`, {
      headers: { "User-Agent": "OpenAI File Downloader, XaiImageApiFetch/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 404) throw new LinkError("Não encontrei esse post do X. Ele pode ter sido apagado ou ser de uma conta protegida.");
    if (!response.ok) throw new LinkError(`O X respondeu ${response.status}. Tente de novo em instantes.`);
    data = (await response.json()) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof LinkError) throw error;
    throw new LinkError("Não consegui falar com o X. Confira sua internet e tente de novo.");
  }

  const user = (data.user ?? {}) as Record<string, unknown>;
  let text = typeof data.text === "string" ? data.text : "";
  // Posts longos chegam cortados; o FxTwitter (open source) devolve o texto inteiro.
  if (data.note_tweet) {
    try {
      const response = await fetch(`https://api.fxtwitter.com/status/${id}`, {
        headers: { "User-Agent": "OpenAI File Downloader, XaiImageApiFetch/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      const full = (await response.json()) as { tweet?: { text?: string } };
      if (full.tweet?.text && full.tweet.text.length > text.length) text = full.tweet.text;
    } catch {
      // Fica com o texto curto.
    }
  }
  text = decodeEntities(text.replace(/\s*https:\/\/t\.co\/\w+\s*$/g, "")).trim();

  const media = Array.isArray(data.mediaDetails) ? (data.mediaDetails as { media_url_https?: string }[]) : [];
  const quoted = data.quoted_tweet as { text?: string; user?: { screen_name?: string } } | undefined;
  if (quoted?.text) text += `\n\n[Post citado de @${quoted.user?.screen_name ?? "alguém"}]: ${decodeEntities(quoted.text)}`;
  const avatar = typeof user.profile_image_url_https === "string" ? user.profile_image_url_https.replace("_normal.", "_400x400.") : null;
  return {
    url: url.toString(),
    title: null,
    text,
    site: "X",
    author: user.screen_name
      ? {
          username: String(user.screen_name),
          fullName: typeof user.name === "string" ? user.name : null,
          avatarUrl: avatar,
          verified: Boolean(user.is_blue_verified || user.verified),
        }
      : null,
    images: media.map((m) => m.media_url_https).filter((u): u is string => Boolean(u)).slice(0, 4),
    likes: typeof data.favorite_count === "number" ? data.favorite_count : null,
    comments: typeof data.conversation_count === "number" ? data.conversation_count : null,
  };
}

/** Converte o HTML do artigo em texto com parágrafos. */
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|figure|figcaption|table)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/(p|h[1-6]|li|blockquote|div|section|ul|ol)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchArticle(url: URL): Promise<LinkContent> {
  let html: string;
  let pageUrl = url;
  try {
    const result = await fetchPublicUrl(url, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8", Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(20000),
    });
    const { response } = result;
    pageUrl = result.url;
    if (!response.ok) {
      await response.body?.cancel();
      throw new LinkError(`O site respondeu ${response.status}. Ele pode bloquear leitura automática; cole o texto na aba Texto.`);
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) {
      await response.body?.cancel();
      throw new LinkError("Esse link não é uma página de texto. Cole o link de um artigo, post ou página.");
    }
    const data = await readLimitedBody(response, 5 * 1024 * 1024, new LinkError("A página excedeu o limite de leitura. Cole o texto na aba Texto."));
    html = data.toString("utf8").slice(0, 3_000_000);
  } catch (error) {
    if (error instanceof DestinationError) throw new LinkError(error.message);
    if (error instanceof LinkError) throw error;
    throw new LinkError("Não consegui abrir esse site. Confira o link e a sua internet.");
  }

  const { document } = parseHTML(html);
  const meta = (name: string) =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content")?.trim() || null;
  const absolute = (value: string | null) => {
    if (!value) return null;
    try {
      return new URL(value, pageUrl).toString();
    } catch {
      return null;
    }
  };

  const ogImage = absolute(meta("og:image") ?? meta("twitter:image"));
  const site = meta("og:site_name") ?? url.hostname.replace(/^www\./, "");
  let article: ReturnType<Readability["parse"]> = null;
  try {
    article = new Readability(document as unknown as Document).parse();
  } catch {
    article = null;
  }
  const title = article?.title?.trim() || meta("og:title") || document.querySelector("title")?.textContent?.trim() || null;
  let text = article?.content ? htmlToText(article.content) : "";
  const description = meta("og:description") ?? meta("description");
  if (text.length < 200 && description) text = [text, description].filter(Boolean).join("\n\n");
  if (text.length < 80) throw new LinkError("Não encontrei texto suficiente nessa página. Cole o conteúdo na aba Texto.");

  return {
    url: url.toString(),
    title,
    text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n\n[texto cortado]` : text,
    site,
    author: null,
    images: ogImage ? [ogImage] : [],
    likes: null,
    comments: null,
  };
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
/** Chave pública do cliente web do YouTube, caso a página não traga a dela. */
const YT_FALLBACK_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

export function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  if (host === "youtu.be") return url.pathname.slice(1, 12) || null;
  const v = url.searchParams.get("v");
  if (v) return v.slice(0, 11);
  return /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/.exec(url.pathname)?.[1] ?? null;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

/** Legenda preferida: manual em português, manual em inglês, automática em português, automática em inglês. */
function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const pt = (t: CaptionTrack) => t.languageCode.toLowerCase().startsWith("pt");
  const en = (t: CaptionTrack) => t.languageCode.toLowerCase().startsWith("en");
  const manual = (t: CaptionTrack) => t.kind !== "asr";
  return (
    tracks.find((t) => manual(t) && pt(t)) ??
    tracks.find((t) => manual(t) && en(t)) ??
    tracks.find((t) => pt(t)) ??
    tracks.find((t) => en(t)) ??
    tracks.find(manual) ??
    tracks[0] ??
    null
  );
}

/** Transforma a legenda (json3) em texto corrido, com parágrafo onde a fala pausa. */
function captionText(json: { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[] }): string {
  let out = "";
  let lastEnd = 0;
  for (const event of json.events ?? []) {
    const text = (event.segs ?? []).map((s) => s.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const start = event.tStartMs ?? 0;
    out += start - lastEnd > 2500 && out ? "\n\n" : out ? " " : "";
    out += text;
    lastEnd = start + (event.dDurationMs ?? 0);
  }
  return out.replace(/\[(?:Música|Music|Aplausos|Applause|Risos|Laughter)\]/gi, "").replace(/ {2,}/g, " ").trim();
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export async function fetchYouTube(url: URL): Promise<LinkContent> {
  const id = youtubeId(url);
  if (!id || !YT_ID.test(id)) throw new LinkError("Cole o link de um vídeo do YouTube (watch, shorts ou youtu.be).");

  let html: string;
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${id}&hl=pt`, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8", Cookie: "CONSENT=YES+1; SOCS=CAI" },
      signal: AbortSignal.timeout(20000),
    });
    html = await response.text();
  } catch {
    throw new LinkError("Não consegui falar com o YouTube. Confira sua internet e tente de novo.");
  }
  const playerJson = /ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|<\/script>)/s.exec(html)?.[1];
  let player: { videoDetails?: Record<string, unknown>; playabilityStatus?: { status?: string } } = {};
  try {
    player = playerJson ? JSON.parse(playerJson) : {};
  } catch {
    player = {};
  }
  const details = player.videoDetails;
  if (!details || (player.playabilityStatus?.status && player.playabilityStatus.status !== "OK")) {
    throw new LinkError("Não consegui abrir esse vídeo. Ele precisa ser público e estar disponível no Brasil.");
  }
  const title = String(details.title ?? "Vídeo do YouTube");
  const channel = String(details.author ?? "");
  const description = String(details.shortDescription ?? "");
  const duration = Number(details.lengthSeconds) || null;
  const thumbs = ((details.thumbnail as { thumbnails?: { url: string; width?: number }[] } | undefined)?.thumbnails ?? []).sort(
    (a, b) => (b.width ?? 0) - (a.width ?? 0),
  );

  // A legenda da página web exige um token que só o navegador tem; o cliente Android do YouTube entrega direto.
  let transcript = "";
  try {
    const key = /"INNERTUBE_API_KEY":"([^"]+)"/.exec(html)?.[1] ?? YT_FALLBACK_KEY;
    const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${key}&prettyPrint=false`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "OpenAI File Downloader, XaiImageApiFetch/1.0" },
      body: JSON.stringify({ context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 34, hl: "pt", gl: "BR" } }, videoId: id }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await response.json()) as { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } } };
    const track = pickTrack(data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []);
    if (track) {
      const caption = await fetch(`${track.baseUrl.replace(/&fmt=[^&]*/, "")}&fmt=json3`, { signal: AbortSignal.timeout(20000) });
      transcript = captionText(await caption.json());
    }
  } catch {
    transcript = "";
  }

  if (!transcript && description.length < 300) {
    throw new LinkError("Esse vídeo não tem legenda, e é por ela que o Arrasta entende o vídeo. Tente outro vídeo ou cole o roteiro na aba Texto.");
  }
  const parts = [
    `Título: ${title}`,
    channel && `Canal: ${channel}`,
    duration && `Duração: ${clock(duration)}`,
    description && `Descrição:\n${description.slice(0, 1500)}`,
    transcript ? `Transcrição do vídeo:\n${transcript}` : "Este vídeo não tem legenda: use o título e a descrição.",
  ].filter(Boolean);
  const text = parts.join("\n\n");
  return {
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
    text: text.length > MAX_TEXT + 2000 ? `${text.slice(0, MAX_TEXT + 2000)}\n\n[transcrição cortada]` : text,
    site: "YouTube",
    author: channel ? { username: channel, fullName: channel, avatarUrl: null, verified: false } : null,
    images: thumbs[0]?.url ? [thumbs[0].url] : [],
    likes: null,
    comments: null,
    duration,
  };
}
