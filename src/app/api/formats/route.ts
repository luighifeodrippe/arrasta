import { uid } from "@/lib/defaults";
import { FormatError, parseDify } from "@/lib/server/formats";
import { listFormats, saveFormat } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listFormats());
}

/** Cria um formato: envie o .yml exportado do Dify (campo "file") ou { name, prompt } em JSON. */
export async function POST(request: Request) {
  try {
    let draft: { name: string; description: string; prompt: string; origin: "dify" | "manual" };
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const file = (await request.formData()).get("file");
      if (!(file instanceof File)) throw new FormatError("Envie o arquivo .yml exportado do Dify.");
      if (file.size > 2_000_000) throw new FormatError("Arquivo grande demais para um app do Dify.");
      draft = { ...parseDify(await file.text()), origin: "dify" };
    } else {
      const body = (await request.json()) as { name?: string; prompt?: string; description?: string };
      if (!body.name?.trim() || !body.prompt?.trim()) throw new FormatError("Dê um nome e escreva o prompt do formato.");
      draft = { name: body.name.trim().slice(0, 60), description: (body.description ?? "").slice(0, 200), prompt: body.prompt.trim().slice(0, 20000), origin: "manual" };
    }
    return Response.json(await saveFormat({ id: uid(), createdAt: new Date().toISOString(), ...draft }));
  } catch (error) {
    if (!(error instanceof FormatError)) console.error(error);
    return Response.json({ error: error instanceof FormatError ? error.message : "Não consegui salvar o formato." }, { status: 400 });
  }
}
