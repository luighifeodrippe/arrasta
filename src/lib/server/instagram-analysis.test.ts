import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { createInstagramMapper, PROFILE_ANALYSIS_TTL_MS } from "./instagram-analysis.ts";
import type { InstagramProfile } from "./instagram.ts";

const sample: InstagramProfile = {
  username: "criadora", fullName: "Criadora", avatarUrl: null, verified: false, followers: null,
  captions: ["Um conteúdo claro começa com uma ideia concreta. Use um exemplo que a pessoa reconheça e deixe espaço para a próxima pergunta."],
  images: ["https://cdn.example/card.jpg?token=one"],
  sourceUrls: ["https://www.instagram.com/p/ABCDE12345/"],
};
const options = { modelKey: "app:chosen-model", connected: true };
const mapped = { voice: "- Tom direto\n- Frases curtas", about: "Clareza", audience: "Criadores", imageCount: 1 };

async function cacheDirectory(t: TestContext) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "arrasta-mapping-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("reutiliza análise persistida, inclusive após reiniciar o serviço", async (t) => {
  const cacheDir = await cacheDirectory(t);
  let collected = 0;
  let analyzed = 0;
  const dependencies = { cacheDir, fetchProfile: async () => { collected++; return sample; }, analyze: async () => { analyzed++; return mapped; } };
  const map = createInstagramMapper(dependencies);
  const first = await map("@criadora", options);
  const second = await createInstagramMapper(dependencies)("criadora", options);
  assert.equal(first.analysis.status, "ready");
  assert.equal(first.analysis.reused, false);
  assert.equal(first.analysis.imageCount, 1);
  assert.deepEqual(first.analysis.sourceUrls, sample.sourceUrls);
  assert.equal(second.analysis.reused, true);
  assert.equal(second.analysis.guide, first.analysis.guide);
  assert.equal(collected, 1);
  assert.equal(analyzed, 1);
});

test("refresh ou TTL relê a fonte sem repetir IA para conteúdo igual", async (t) => {
  const cacheDir = await cacheDirectory(t);
  let time = 100_000;
  let collected = 0;
  let analyzed = 0;
  const map = createInstagramMapper({
    cacheDir, now: () => time,
    fetchProfile: async () => { collected++; return { ...sample, images: [`https://cdn.example/card.jpg?token=${collected}`] }; },
    analyze: async () => { analyzed++; return mapped; },
  });
  await map("criadora", options);
  assert.equal((await map("criadora", { ...options, refresh: true })).analysis.reused, true);
  time += PROFILE_ANALYSIS_TTL_MS + 1;
  assert.equal((await map("criadora", options)).analysis.reused, true);
  assert.equal(collected, 3);
  assert.equal(analyzed, 1, "assinatura nova do CDN não provoca análise duplicada");
});

test("conteúdo ou modelo diferente exige uma nova análise", async (t) => {
  const cacheDir = await cacheDirectory(t);
  let analyzed = 0;
  let current = sample;
  const map = createInstagramMapper({ cacheDir, fetchProfile: async () => current, analyze: async () => { analyzed++; return mapped; } });
  await map("criadora", options);
  current = { ...sample, captions: [...sample.captions, "Outra ideia pública disponível na amostra."] };
  await map("criadora", { ...options, refresh: true });
  await map("criadora", { ...options, modelKey: "app:other-model" });
  assert.equal(analyzed, 3);
});

test("pedidos concorrentes do mesmo @ compartilham coleta e análise", async (t) => {
  const cacheDir = await cacheDirectory(t);
  let analyzed = 0;
  let collected = 0;
  const map = createInstagramMapper({
    cacheDir,
    fetchProfile: async () => { collected++; return sample; },
    analyze: async () => { analyzed++; return mapped; },
  });
  const [first, second] = await Promise.all([map("criadora", options), map("@criadora", options)]);
  assert.equal(analyzed, 1);
  assert.equal(collected, 1);
  assert.deepEqual(first, second);
});

test("sem login entrega dados públicos e analisa ao conectar sem recoletar", async (t) => {
  const cacheDir = await cacheDirectory(t);
  let collected = 0;
  let analyzed = 0;
  const map = createInstagramMapper({ cacheDir, fetchProfile: async () => { collected++; return sample; }, analyze: async () => { analyzed++; return mapped; } });
  const pending = await map("criadora", { ...options, connected: false });
  assert.equal(pending.analysis.status, "needs_login");
  assert.equal(pending.profile.fullName, "Criadora");
  assert.equal(analyzed, 0);
  assert.equal((await map("criadora", options)).analysis.status, "ready");
  assert.equal(analyzed, 1);
  assert.equal(collected, 1);
});

test("amostra insuficiente não usa IA; falha da IA não descarta o perfil", async (t) => {
  const cacheDir = await cacheDirectory(t);
  let analyzed = 0;
  let current: InstagramProfile = { ...sample, captions: [], images: [] };
  const map = createInstagramMapper({ cacheDir, now: () => 100_000, fetchProfile: async () => current, analyze: async () => { analyzed++; throw new Error("Limite de uso atingido."); } });
  assert.equal((await map("criadora", options)).analysis.status, "unavailable");
  assert.equal(analyzed, 0);
  current = sample;
  const failed = await map("criadora", { ...options, refresh: true });
  assert.equal(failed.profile.username, "criadora");
  assert.equal(failed.analysis.status, "unavailable");
  assert.match(failed.analysis.message, /Limite de uso atingido/);
  await map("criadora", options);
  assert.equal(analyzed, 1, "um clique repetido após falha não gasta outra análise imediatamente");
});

test("card legível basta para analisar perfil sem legendas e saída é limitada", async (t) => {
  const map = createInstagramMapper({
    cacheDir: await cacheDirectory(t), fetchProfile: async () => ({ ...sample, captions: [] }),
    analyze: async () => ({ ...mapped, voice: "g".repeat(3000), about: "a".repeat(600), audience: "p".repeat(600) }),
  });
  const result = await map("criadora", options);
  assert.equal(result.analysis.status, "ready");
  assert.equal(result.analysis.guide.length, 1800);
  assert.equal(result.analysis.about.length, 300);
  assert.equal(result.analysis.audience.length, 300);
  assert.equal(result.analysis.sampleCount, 0);
  assert.equal(result.analysis.imageCount, 1);
});
