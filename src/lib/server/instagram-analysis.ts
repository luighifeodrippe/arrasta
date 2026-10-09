import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { InstagramAnalysis } from "../types.ts";
import { parseHandle, type InstagramProfile } from "./instagram.ts";

export const PROFILE_ANALYSIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;
const CACHE_VERSION = 1;

interface AnalysisOutput {
  voice: string;
  about: string;
  audience: string;
  imageCount: number;
  usage?: { inputTokens: number; cachedInputTokens: number | null; outputTokens: number };
}

interface CachedProfile {
  version: number;
  fetchedAt: number;
  modelKey: string;
  fingerprint: string;
  profile: InstagramProfile;
  analysis: InstagramAnalysis;
  attemptedAt: number;
  usage?: AnalysisOutput["usage"];
}

interface MapperOptions {
  cacheDir: string;
  fetchProfile: (handle: string) => Promise<InstagramProfile>;
  analyze: (profile: InstagramProfile) => Promise<AnalysisOutput>;
  now?: () => number;
}

/** Uma amostra por @; só analisa de novo se o conteúdo ou o modelo mudou. */
export function createInstagramMapper({ cacheDir, fetchProfile, analyze, now = Date.now }: MapperOptions) {
  const pending = new Map<string, Promise<{ profile: InstagramProfile; analysis: InstagramAnalysis }>>();

  async function map(handleInput: string, options: { modelKey: string; connected: boolean; refresh?: boolean }) {
    const handle = parseHandle(handleInput);
    if (!handle) throw new Error("Digite um @ válido do Instagram.");
    // O mesmo @ em duas abas compartilha a coleta e a análise em andamento.
    const pendingKey = `${handle}:${options.modelKey}`;
    const existing = pending.get(pendingKey);
    if (existing) return existing;
    const task = run(handle, options);
    pending.set(pendingKey, task);
    try {
      return await task;
    } finally {
      pending.delete(pendingKey);
    }
  }

  async function run(handle: string, options: { modelKey: string; connected: boolean; refresh?: boolean }) {
    const file = path.join(cacheDir, `${handle}.json`);
    const cached = await readCache(file);
    const timestamp = now();
    const fresh = cached && timestamp - cached.fetchedAt < PROFILE_ANALYSIS_TTL_MS;
    const profile = !options.refresh && fresh ? cached.profile : await fetchProfile(handle);
    const fetchedAt = !options.refresh && fresh ? cached.fetchedAt : timestamp;
    const fingerprint = sampleFingerprint(profile);
    const unchanged = cached?.fingerprint === fingerprint && cached.modelKey === options.modelKey;
    if (unchanged && cached.analysis.status === "ready") {
      const analysis = { ...cached.analysis, reused: true, message: "Mapeamento salvo reutilizado, sem nova análise com IA." };
      await writeCache(file, { ...cached, fetchedAt, profile, analysis });
      return { profile, analysis };
    }
    if (unchanged && cached.analysis.status === "unavailable" && timestamp - cached.attemptedAt < RETRY_DELAY_MS) {
      return { profile, analysis: { ...cached.analysis, message: `${cached.analysis.message} Aguarde um minuto antes de tentar novamente.` } };
    }

    let analysis: InstagramAnalysis = {
      status: "unavailable", guide: "", about: "", audience: "", analyzedAt: null, reused: false,
      sampleCount: profile.captions.length, imageCount: 0, sourceUrls: profile.sourceUrls,
      message: "O Instagram não disponibilizou texto ou cards suficientes para mapear a escrita. Tente outro perfil público ou atualize mais tarde.",
    };
    let attemptedAt = 0;
    let usage: AnalysisOutput["usage"];
    if (profile.captions.join("").trim().length >= 80 || profile.images.length > 0) {
      if (!options.connected) {
        analysis = { ...analysis, status: "needs_login", message: "Perfil coletado. Entre com ChatGPT para mapear a escrita." };
      } else {
        attemptedAt = timestamp;
        try {
          const result = await analyze(profile);
          usage = result.usage;
          const guide = typeof result.voice === "string" ? result.voice.trim().slice(0, 1800) : "";
          if (guide) {
            analysis = {
              ...analysis, status: "ready", guide,
              about: typeof result.about === "string" ? result.about.trim().slice(0, 300) : "",
              audience: typeof result.audience === "string" ? result.audience.trim().slice(0, 300) : "",
              imageCount: result.imageCount,
              analyzedAt: new Date(now()).toISOString(),
              message: `Escrita mapeada a partir de ${profile.captions.length} legendas e ${result.imageCount} cards disponíveis. O guia será reutilizado.`,
            };
          } else {
            analysis = { ...analysis, imageCount: result.imageCount, message: "A amostra não permitiu reconhecer um estilo de escrita. Tente outro perfil público ou atualize mais tarde." };
          }
        } catch (error) {
          const needsLogin = Boolean(error && typeof error === "object" && "needsLogin" in error && error.needsLogin);
          const detail = error instanceof Error ? error.message.slice(0, 280) : "Não foi possível concluir a análise.";
          analysis = { ...analysis, status: needsLogin ? "needs_login" : "unavailable", message: `Perfil coletado; o mapeamento não foi concluído. ${detail}` };
        }
      }
    }
    await writeCache(file, { version: CACHE_VERSION, fetchedAt, modelKey: options.modelKey, fingerprint, profile, analysis, attemptedAt, usage });
    return { profile, analysis };
  }

  return map;
}

function sampleFingerprint(profile: InstagramProfile): string {
  // Assinaturas temporárias do CDN não tornam o mesmo card um conteúdo novo.
  const images = profile.images.map((url) => {
    try { return new URL(url).pathname; } catch { return url; }
  });
  return createHash("sha256").update(JSON.stringify({ captions: profile.captions, images, sources: profile.sourceUrls })).digest("hex");
}

async function readCache(file: string): Promise<CachedProfile | null> {
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8")) as CachedProfile;
    return value.version === CACHE_VERSION && Array.isArray(value.profile?.captions) && Array.isArray(value.profile?.images) && value.analysis ? value : null;
  } catch {
    return null;
  }
}

async function writeCache(file: string, value: CachedProfile) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value));
  await fs.rename(temporary, file);
}
