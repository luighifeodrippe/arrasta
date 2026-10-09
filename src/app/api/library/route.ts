import { LibraryError, listLibrary, saveLibraryItem } from "@/lib/server/library";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listLibrary());
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não consegui abrir o banco de conteúdos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new LibraryError("Informe o conteúdo que quer salvar.");
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 128 * 1024) {
        await reader.cancel();
        throw new LibraryError("O conteúdo é muito longo. Salve um trecho menor.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return Response.json(await saveLibraryItem(JSON.parse(text)), { status: 201 });
  } catch (error) {
    const known = error instanceof LibraryError || error instanceof SyntaxError;
    if (!known) console.error(error);
    return Response.json({ error: error instanceof LibraryError ? error.message : known ? "Conteúdo inválido." : "Não consegui salvar o conteúdo." }, { status: known ? 400 : 500 });
  }
}
