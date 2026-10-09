import { listModels } from "@/lib/server/codex";
import { defaultWriting } from "@/lib/defaults";
import { getSettings, saveSettings } from "@/lib/server/storage";
import type { Settings, WritingSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [settings, models] = await Promise.all([getSettings(), listModels()]);
  return Response.json({ settings, models });
}

export async function PUT(request: Request) {
  const patch = (await request.json()) as Partial<Settings>;
  const clean: Partial<Settings> = {};
  if (patch.model === null || typeof patch.model === "string") clean.model = patch.model || null;
  if (patch.effort && ["low", "medium", "high"].includes(patch.effort)) clean.effort = patch.effort;
  if (patch.writing && typeof patch.writing === "object") {
    const w: Partial<WritingSettings> = patch.writing;
    const next: Partial<WritingSettings> = { ...(await getSettings()).writing };
    if (typeof w.instructions === "string") next.instructions = w.instructions.slice(0, 8000);
    if (w.language && ["pt-BR", "en", "es"].includes(w.language)) next.language = w.language;
    if (w.length && ["curto", "medio", "longo"].includes(w.length)) next.length = w.length;
    if (w.emojis && ["nunca", "poucos", "livre"].includes(w.emojis)) next.emojis = w.emojis;
    if (w.slides && ["poucos", "medio", "muitos"].includes(w.slides)) next.slides = w.slides;
    if (typeof w.avoid === "string") next.avoid = w.avoid.slice(0, 1000);
    clean.writing = defaultWriting(next);
  }
  return Response.json({ settings: await saveSettings(clean) });
}
