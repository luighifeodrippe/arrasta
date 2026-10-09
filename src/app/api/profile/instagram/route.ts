import { downloadImage, fetchProfile, InstagramError } from "@/lib/server/instagram";
import { extFor, saveAsset } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/** Tenta ler nome, foto, selo e uma amostra das legendas disponíveis no embed público. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const handle = body && typeof body === "object" && "handle" in body && typeof body.handle === "string" ? body.handle : "";
  try {
    const profile = await fetchProfile(handle);
    let avatar: string | null = null;
    if (profile.avatarUrl) {
      try {
        const image = await downloadImage(profile.avatarUrl);
        avatar = await saveAsset("profile", `avatar-${Date.now()}.${extFor(image.type)}`, image.data);
      } catch {
        avatar = null;
      }
    }
    const name = cleanName(profile.fullName);
    const imported = { name: Boolean(name), avatar: Boolean(avatar), captions: profile.captions.length };
    const notice = [
      imported.captions
        ? `Importei ${imported.captions} ${imported.captions === 1 ? "legenda disponível" : "legendas disponíveis"}. É uma amostra, não uma leitura de todo o perfil.`
        : "O Instagram não disponibilizou legendas. Cole textos seus para definir sua voz.",
      !imported.name ? "Preencha seu nome manualmente." : "",
      !imported.avatar ? "Adicione sua foto manualmente." : "",
    ].filter(Boolean).join(" ");
    return Response.json({
      handle: profile.username,
      name: name ?? profile.username,
      avatar,
      verified: profile.verified,
      followers: profile.followers,
      samples: profile.captions.join("\n\n---\n\n"),
      imported,
      notice,
    });
  } catch (error) {
    const message = error instanceof InstagramError ? error.message : "Não consegui ler esse perfil agora.";
    return Response.json({ error: message }, { status: 400 });
  }
}

/** "Luighi Feodrippe | Inteligência Artificial" vira "Luighi Feodrippe". */
function cleanName(name: string | null): string | null {
  if (!name) return null;
  return name.split(/\s[|•·—-]\s/)[0].trim() || name;
}
