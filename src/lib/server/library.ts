import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type LibraryItem = {
  id: string;
  kind: "link" | "text";
  title: string;
  content: string;
  createdAt: string;
};

const LIBRARY_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.ARRASTA_DATA_DIR ?? path.join(process.cwd(), "data"), "library");
const SAFE_ID = /^[a-f0-9-]{36}$/;

export class LibraryError extends Error {}

export function parseLibraryInput(input: unknown): Pick<LibraryItem, "kind" | "title" | "content"> {
  if (!input || typeof input !== "object") throw new LibraryError("Informe o conteúdo que quer salvar.");
  const body = input as Record<string, unknown>;
  if (body.kind !== "link" && body.kind !== "text") throw new LibraryError("Escolha link ou texto.");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  let content = typeof body.content === "string" ? body.content.trim() : "";
  if (title.length > 120) throw new LibraryError("O título pode ter até 120 caracteres.");
  if (!content) throw new LibraryError(body.kind === "link" ? "Cole um link para salvar." : "Escreva o texto que quer salvar.");
  if (content.length > (body.kind === "link" ? 4096 : 20_000)) throw new LibraryError("O conteúdo é muito longo. Salve um trecho menor.");
  if (body.kind === "link") {
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(content) ? content : `https://${content}`);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || !url.hostname.includes(".") || /\s/.test(content)) throw new Error();
      content = url.toString();
    } catch {
      throw new LibraryError("Cole um link válido, começando com https://.");
    }
  }
  return {
    kind: body.kind,
    title: title || (body.kind === "link" ? new URL(content).hostname.replace(/^www\./, "") : content.split("\n")[0].slice(0, 120)),
    content,
  };
}

export async function listLibrary(): Promise<LibraryItem[]> {
  let names: string[];
  try {
    names = await fs.readdir(LIBRARY_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const items = await Promise.all(names.filter((name) => SAFE_ID.test(name.replace(/\.json$/, "")) && name.endsWith(".json")).map(async (name) => {
    try {
      return JSON.parse(await fs.readFile(path.join(LIBRARY_DIR, name), "utf8")) as LibraryItem;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }));
  return items.filter((item): item is LibraryItem => item !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveLibraryItem(input: unknown): Promise<LibraryItem> {
  const item: LibraryItem = { ...parseLibraryInput(input), id: randomUUID(), createdAt: new Date().toISOString() };
  await fs.mkdir(LIBRARY_DIR, { recursive: true });
  const file = path.join(LIBRARY_DIR, `${item.id}.json`);
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(item, null, 2));
  await fs.rename(temporary, file);
  return item;
}

export async function deleteLibraryItem(id: string): Promise<void> {
  if (!SAFE_ID.test(id)) throw new LibraryError("Conteúdo inválido.");
  await fs.rm(path.join(LIBRARY_DIR, `${id}.json`), { force: true });
}
