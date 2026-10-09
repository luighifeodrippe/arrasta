import type { InstagramImportResult, Profile, StyleReference } from "../types";

export const instagramHandle = (value: string) => value.trim().replace(/^@+/, "").toLowerCase();
export const emptyStyleReference = (reference: StyleReference) => ![reference.name, reference.handle, reference.focus, reference.samples, reference.guide].some((value) => value?.trim());

/** Só aplica aos campos que a pessoa não editou enquanto a análise estava em andamento. */
export function mergeInstagramProfile(current: Profile, result: InstagramImportResult, baseline: Profile): Profile {
  if (instagramHandle(current.handle) !== instagramHandle(baseline.handle)) return current;
  const next = { ...current };
  const apply = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    if (current[key] === baseline[key]) next[key] = value;
  };
  apply("handle", result.handle);
  if (result.imported.name) apply("name", result.name);
  else if (!current.name) apply("name", result.handle);
  if (result.avatar) apply("avatar", result.avatar);
  apply("verified", result.verified);
  if (result.followers !== null) apply("followers", result.followers);
  if (result.samples) apply("samples", result.samples);
  if (result.analysis.status === "ready" && result.analysis.guide.trim()) {
    apply("voice", result.analysis.guide);
    if (result.analysis.about) apply("about", result.analysis.about);
    if (result.analysis.audience) apply("audience", result.analysis.audience);
    if (current.voice === baseline.voice && result.analysis.analyzedAt) {
      next.voiceAnalysis = {
        handle: result.handle,
        analyzedAt: result.analysis.analyzedAt,
        sampleCount: result.analysis.sampleCount,
        imageCount: result.analysis.imageCount,
        sourceUrls: result.analysis.sourceUrls,
      };
    }
  }
  return next;
}

/** Atualizar o mesmo @ mantém o peso e os ajustes que a pessoa já escolheu. */
export function mergeInstagramReference(references: StyleReference[], result: InstagramImportResult, id: string): StyleReference[] {
  const handle = instagramHandle(result.handle);
  const matched = references.findIndex((item) => instagramHandle(item.handle || item.name) === handle);
  const index = matched === -1 ? references.findIndex(emptyStyleReference) : matched;
  if (index === -1 && references.length >= 5) return references;
  const existing = index === -1 ? undefined : references[index];
  const ready = result.analysis.status === "ready" && Boolean(result.analysis.guide.trim());
  const reference: StyleReference = {
    id: existing?.id ?? id,
    name: result.imported.name ? result.name : existing?.name || `@${handle}`,
    handle,
    avatar: result.avatar ?? existing?.avatar ?? null,
    focus: existing?.focus ?? "",
    samples: result.samples ? result.samples.slice(0, 4000) : existing?.samples ?? "",
    weight: existing?.weight ?? 3,
    guide: ready ? result.analysis.guide : existing?.guide ?? "",
    analyzedAt: ready ? result.analysis.analyzedAt : existing?.analyzedAt ?? null,
    sampleCount: ready ? result.analysis.sampleCount : existing?.sampleCount ?? 0,
    imageCount: ready ? result.analysis.imageCount : existing?.imageCount ?? 0,
  };
  return index === -1 ? [...references, reference] : references.map((item, position) => position === index ? reference : item);
}
