import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const directory = await fs.mkdtemp(path.join(os.tmpdir(), "arrasta-library-"));
process.env.ARRASTA_DATA_DIR = directory;
const { deleteLibraryItem, listLibrary, parseLibraryInput, saveLibraryItem } = await import("./library.ts");
after(async () => { await fs.rm(directory, { recursive: true, force: true }); });

test("salva conteúdos concorrentes sem perder itens e exclui somente o escolhido", async () => {
  assert.deepEqual(await listLibrary(), []);
  const items = await Promise.all([
    saveLibraryItem({ kind: "text", title: "Ideia para amanhã", content: "Uma anotação\ncom mais de uma linha." }),
    saveLibraryItem({ kind: "link", title: "Referência", content: "example.com/artigo" }),
  ]);
  const saved = await listLibrary();
  assert.equal(saved.length, 2);
  assert.equal(saved.find((item) => item.id === items[0].id)?.content, "Uma anotação\ncom mais de uma linha.");
  assert.equal(saved.find((item) => item.id === items[1].id)?.content, "https://example.com/artigo");
  await assert.rejects(deleteLibraryItem("../profile"));
  assert.equal((await listLibrary()).length, 2);
  await deleteLibraryItem(items[0].id);
  assert.deepEqual(await listLibrary(), [items[1]]);
});

test("recusa links executáveis, credenciais, conteúdos vazios e excesso de texto", () => {
  for (const content of ["javascript:alert(1)", "file:///etc/passwd", "https://login:secret@example.com", "não é link"]) {
    assert.throws(() => parseLibraryInput({ kind: "link", content }));
  }
  assert.throws(() => parseLibraryInput({ kind: "text", content: "  " }));
  assert.throws(() => parseLibraryInput({ kind: "text", content: "x".repeat(20_001) }));
  assert.throws(() => parseLibraryInput({ kind: "text", title: "x".repeat(121), content: "Ideia" }));
  assert.equal(parseLibraryInput({ kind: "text", content: "Meu título\nO resto da ideia" }).title, "Meu título");
});
