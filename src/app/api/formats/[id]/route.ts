import { deleteFormat } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await deleteFormat((await params).id);
  return Response.json({ ok: true });
}
