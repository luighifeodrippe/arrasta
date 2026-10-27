import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("um JSON corrompido não esconde projetos válidos nem impede criar outro", async (t) => {
  // Mantém a amostra isolada e preservada, sem tocar nos dados de quem usa o app.
  const directory = await fs.mkdtemp(path.join(process.cwd(), "node_modules", ".arrasta-storage-test-"));
  const previousDirectory = process.env.ARRASTA_DATA_DIR;
  process.env.ARRASTA_DATA_DIR = directory;
  t.after(() => {
    if (previousDirectory === undefined) delete process.env.ARRASTA_DATA_DIR;
    else process.env.ARRASTA_DATA_DIR = previousDirectory;
  });
  const { listProjects, newProject, saveProject } = await import("./storage.ts");
  const messages: string[] = [];
  t.mock.method(console, "error", (message: string) => messages.push(message));
  const first = await saveProject(await newProject({ title: "Primeiro" }));
  const second = await saveProject(await newProject({ title: "Segundo" }));
  const invalidFile = path.join(directory, "projects", "corrompido.json");
  const invalidContents = '{ "title": "Não apagar",';
  await fs.writeFile(invalidFile, invalidContents);
  const before = await fs.stat(invalidFile);

  const projects = await listProjects();
  assert.deepEqual(new Set(projects.map((project) => project.id)), new Set([first.id, second.id]));
  const third = await saveProject(await newProject({ title: "Novo depois do erro" }));
  assert.equal((await listProjects()).length, 3);
  assert.ok((await listProjects()).some((project) => project.id === third.id));
  assert.ok(messages.length > 0);
  assert.ok(messages.every((message) => message.includes(invalidFile)));
  assert.equal(await fs.readFile(invalidFile, "utf8"), invalidContents);
  assert.equal((await fs.stat(invalidFile)).mtimeMs, before.mtimeMs);
});
