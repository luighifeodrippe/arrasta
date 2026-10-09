import { readAsset } from "@/lib/server/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.length !== 2) return new Response("Não encontrado", { status: 404 });
  const asset = await readAsset(path[0], path[1]);
  if (!asset) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: { "Content-Type": asset.type, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
