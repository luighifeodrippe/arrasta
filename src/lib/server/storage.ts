import { promises as fs } from "node:fs";
import path from "node:path";
import { BUILTIN_FORMATS, defaultDesign, defaultWriting, normalizeProfile, normalizeProject, uid } from "../defaults";
import type { CarouselFormat, Project, Profile, Settings } from "../types";

/** Tudo do usuário fica numa pasta local: projetos, imagens e o login do ChatGPT. */
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.ARRASTA_DATA_DIR ?? path.join(process.cwd(), "data"));
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const ASSETS_DIR = path.join(DATA_DIR, "assets");
const FORMATS_DIR = path.join(DATA_DIR, "formats");

const SAFE_ID = /^[a-z0-9-]{3,64}$/;
const SAFE_FILE = /^[a-z0-9][a-z0-9._-]{0,120}$/i;

export function assertId(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error("Identificador inválido");
  return id;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2));
  await fs.rename(tmp, file);
}

export async function listProjects(): Promise<Project[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(PROJECTS_DIR);
  } catch {
    return [];
  }
  const projects = await Promise.all(
    names.filter((n) => n.endsWith(".json")).map((n) => readJson<Project>(path.join(PROJECTS_DIR, n))),
  );
  return projects
    .filter((p): p is Project => Boolean(p))
    .map(normalizeProject)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<Project | null> {
  const project = await readJson<Project>(path.join(PROJECTS_DIR, `${assertId(id)}.json`));
  return project ? normalizeProject(project) : null;
}

export async function saveProject(project: Project): Promise<Project> {
  const saved = { ...project, updatedAt: new Date().toISOString() };
  await writeJson(path.join(PROJECTS_DIR, `${assertId(project.id)}.json`), saved);
  return saved;
}

export async function deleteProject(id: string): Promise<void> {
  await fs.rm(path.join(PROJECTS_DIR, `${assertId(id)}.json`), { force: true });
  await fs.rm(path.join(ASSETS_DIR, assertId(id)), { recursive: true, force: true });
}

export function newProject(partial: Partial<Project>): Project {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title: "Novo carrossel",
    createdAt: now,
    updatedAt: now,
    source: null,
    slides: [],
    design: defaultDesign(),
    caption: "",
    hashtags: [],
    chat: [],
    images: [],
    ...partial,
  };
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export function extFor(contentType: string | null, fallback = "jpg"): string {
  return (contentType && EXT_BY_TYPE[contentType.split(";")[0].trim()]) || fallback;
}

/** Guarda uma imagem e devolve a URL que a interface usa para mostrá-la. */
export async function saveAsset(scope: string, name: string, data: Buffer | Uint8Array): Promise<string> {
  assertId(scope);
  if (!SAFE_FILE.test(name)) throw new Error("Nome de arquivo inválido");
  const dir = path.join(ASSETS_DIR, scope);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), data);
  return `/api/assets/${scope}/${name}`;
}

/** Converte a URL de um asset no caminho do arquivo, para o ChatGPT ler a imagem. */
export function assetPath(url: string): string | null {
  const match = /^\/api\/assets\/([a-z0-9-]{3,64})\/([^/?#]+)$/i.exec(url);
  if (!match || !SAFE_ID.test(match[1]) || !SAFE_FILE.test(match[2])) return null;
  return path.join(ASSETS_DIR, match[1], match[2]);
}

export async function readAsset(scope: string, name: string): Promise<{ data: Buffer; type: string } | null> {
  if (!SAFE_ID.test(scope) || !SAFE_FILE.test(name)) return null;
  try {
    const data = await fs.readFile(path.join(ASSETS_DIR, scope, name));
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return { data, type: TYPE_BY_EXT[ext] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function getProfile(): Promise<Profile> {
  return normalizeProfile((await readJson<Profile>(path.join(DATA_DIR, "profile.json"))) ?? {});
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const clean = normalizeProfile(profile);
  await writeJson(path.join(DATA_DIR, "profile.json"), clean);
  return clean;
}

const DEFAULT_SETTINGS: Settings = { codexHome: "app", model: null, effort: "low", writing: defaultWriting() };

export async function getSettings(): Promise<Settings> {
  const saved = (await readJson<Partial<Settings>>(path.join(DATA_DIR, "settings.json"))) ?? {};
  return { ...DEFAULT_SETTINGS, ...saved, writing: defaultWriting(saved.writing) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await writeJson(path.join(DATA_DIR, "settings.json"), next);
  return next;
}

/** Formatos de carrossel: os que vêm no Arrasta e os da pessoa (clones importados do Dify ou escritos à mão). */
export async function listFormats(): Promise<CarouselFormat[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(FORMATS_DIR);
  } catch {
    return BUILTIN_FORMATS;
  }
  const formats = await Promise.all(names.filter((n) => n.endsWith(".json")).map((n) => readJson<CarouselFormat>(path.join(FORMATS_DIR, n))));
  const own = formats.filter((f): f is CarouselFormat => Boolean(f)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return [...BUILTIN_FORMATS, ...own];
}

export async function getFormat(id: string | null | undefined): Promise<CarouselFormat | null> {
  if (!id || !SAFE_ID.test(id)) return null;
  return BUILTIN_FORMATS.find((f) => f.id === id) ?? readJson<CarouselFormat>(path.join(FORMATS_DIR, `${id}.json`));
}

export async function saveFormat(format: CarouselFormat): Promise<CarouselFormat> {
  await writeJson(path.join(FORMATS_DIR, `${assertId(format.id)}.json`), format);
  return format;
}

export async function deleteFormat(id: string): Promise<void> {
  if (BUILTIN_FORMATS.some((f) => f.id === id)) return;
  await fs.rm(path.join(FORMATS_DIR, `${assertId(id)}.json`), { force: true });
}
