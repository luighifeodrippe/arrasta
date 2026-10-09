import { assertId, extFor, saveAsset } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const scope = String(form.get("scope") ?? "");
  const file = form.get("file");
  try {
    assertId(scope);
  } catch {
    return Response.json({ error: "Destino inválido." }, { status: 400 });
  }
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return Response.json({ error: "Envie uma imagem (JPG, PNG ou WebP)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "Imagem maior que 15 MB." }, { status: 400 });
  const name = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extFor(file.type)}`;
  const url = await saveAsset(scope, name, Buffer.from(await file.arrayBuffer()));
  return Response.json({ url });
}
