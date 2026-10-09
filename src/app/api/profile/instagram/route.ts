import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { authStatus, runCodex, type CodexUsage } from "@/lib/server/codex";
import { createInstagramMapper } from "@/lib/server/instagram-analysis";
import { downloadImage, fetchProfile, InstagramError, type InstagramProfile } from "@/lib/server/instagram";
import { voicePrompt, VOICE_SCHEMA, type VoiceResult } from "@/lib/server/prompts";
import { DATA_DIR, extFor, getSettings, saveAsset } from "@/lib/server/storage";
import type { InstagramImportResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const mapProfile = createInstagramMapper({
  cacheDir: path.join(DATA_DIR, "profile-mappings"),
  fetchProfile,
  analyze: analyzeSample,
});

/** Coleta e mapeia uma amostra; a UI decide se aplica à própria voz ou a uma referência. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const handle = body && typeof body === "object" && "handle" in body && typeof body.handle === "string" ? body.handle : "";
  const refresh = Boolean(body && typeof body === "object" && "refresh" in body && body.refresh === true);
  try {
    const [settings, auth] = await Promise.all([getSettings(), authStatus()]);
    const { profile, analysis } = await mapProfile(handle, {
      refresh,
      connected: auth.connected,
      modelKey: `${settings.codexHome}:${settings.model ?? "account-default"}`,
    });
    let avatar: string | null = null;
    if (profile.avatarUrl) {
      try {
        const image = await downloadImage(profile.avatarUrl, undefined, 4 * 1024 * 1024);
        const fingerprint = createHash("sha256").update(image.data).digest("hex").slice(0, 12);
        avatar = await saveAsset("profile", `avatar-${profile.username}-${fingerprint}.${extFor(image.type)}`, image.data);
      } catch {
        // Nome e análise continuam utilizáveis se o CDN da foto estiver indisponível.
      }
    }
    const name = cleanName(profile.fullName);
    const result: InstagramImportResult = {
      handle: profile.username,
      name: name ?? profile.username,
      avatar,
      verified: profile.verified,
      followers: profile.followers,
      samples: profile.captions.join("\n\n---\n\n"),
      imported: { name: Boolean(name), avatar: Boolean(avatar), captions: profile.captions.length },
      analysis,
      notice: analysis.message,
    };
    return Response.json(result);
  } catch (error) {
    const message = error instanceof InstagramError || error instanceof Error ? error.message : "Não consegui ler esse perfil agora.";
    return Response.json({ error: message }, { status: 400 });
  }
}

/** No máximo quatro arquivos temporários, uma análise e nenhuma busca adicional pela IA. */
async function analyzeSample(profile: InstagramProfile) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "arrasta-profile-"));
  try {
    const downloaded = await Promise.allSettled(profile.images.slice(0, 4).map(async (url, index) => {
      const image = await downloadImage(url, undefined, 4 * 1024 * 1024);
      const file = path.join(/*turbopackIgnore: true*/ directory, `${index}.${extFor(image.type)}`);
      await fs.writeFile(file, image.data);
      return file;
    }));
    const images = downloaded.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    if (!images.length && profile.captions.join("").trim().length < 80) {
      throw new Error("Os cards não puderam ser lidos e as legendas disponíveis não bastam para reconhecer a escrita.");
    }
    let usage: CodexUsage | undefined;
    const signal = AbortSignal.timeout(90_000);
    const result = await runCodex<VoiceResult>({
      prompt: voicePrompt({ name: profile.fullName ?? profile.username, handle: profile.username, samples: profile.captions.join("\n\n---\n\n"), imageCount: images.length }),
      schema: VOICE_SCHEMA,
      images,
      effort: "low",
      webSearch: false,
      disableShell: true,
      signal,
      onUsage: (value) => { usage = value; },
    }).catch((error: unknown) => {
      if (signal.aborted && signal.reason?.name === "TimeoutError") {
        throw new Error("A análise atingiu o limite de 90 segundos. Tente novamente.");
      }
      throw error;
    });
    return { ...result, imageCount: images.length, usage };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function cleanName(name: string | null): string | null {
  if (!name) return null;
  return name.split(/\s[|•·—-]\s/)[0].trim() || name;
}
