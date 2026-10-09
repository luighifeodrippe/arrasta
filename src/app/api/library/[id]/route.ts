import { deleteLibraryItem, LibraryError } from "@/lib/server/library";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await deleteLibraryItem((await params).id);
    return Response.json({ ok: true });
  } catch (error) {
    if (!(error instanceof LibraryError)) console.error(error);
    return Response.json({ error: error instanceof LibraryError ? error.message : "Não consegui excluir o conteúdo." }, { status: error instanceof LibraryError ? 400 : 500 });
  }
}
