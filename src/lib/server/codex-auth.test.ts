import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { CodexError, envFor, readAccount, requireChatGPTAccount } from "./codex-auth.ts";

const idToken = `header.${Buffer.from(JSON.stringify({
  email: "criadora@example.com", name: "Criadora",
  "https://api.openai.com/auth": { chatgpt_plan_type: "plus" },
})).toString("base64url")}.signature`;

async function fixture(t: TestContext, auth?: object) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "arrasta-auth-test-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  if (auth) await fs.writeFile(path.join(home, "auth.json"), JSON.stringify(auth));
  return home;
}

test("remove credenciais e endpoint de API do processo filho sem alterar o ambiente original", () => {
  const inherited: NodeJS.ProcessEnv = {
    OPENAI_API_KEY: "fake-api-key", CODEX_API_KEY: "fake-codex-key", CODEX_ACCESS_TOKEN: "fake-access-token",
    OPENAI_BASE_URL: "https://api.example.com", CODEX_HOME: "/system", PATH: "/bin", CODEX_CA_CERTIFICATE: "/cert.pem", NODE_ENV: "test",
  };
  const before = { ...inherited };
  assert.deepEqual(envFor("/arrasta", inherited), { CODEX_HOME: "/arrasta", PATH: "/bin", CODEX_CA_CERTIFICATE: "/cert.pem", NODE_ENV: "test" });
  assert.deepEqual(inherited, before);
});

test("aceita login ChatGPT e devolve apenas metadados, preservando o arquivo", async (t) => {
  for (const auth_mode of [undefined, "chatgpt"]) {
    const home = await fixture(t, { auth_mode, OPENAI_API_KEY: null, tokens: { id_token: idToken, access_token: "private-token" } });
    const before = await fs.readFile(path.join(home, "auth.json"), "utf8");
    assert.deepEqual(await requireChatGPTAccount(home), { method: "chatgpt", email: "criadora@example.com", name: "Criadora", plan: "plus" });
    assert.equal(await fs.readFile(path.join(home, "auth.json"), "utf8"), before);
  }
});

test("bloqueia login de API inclusive com tokens antigos, sem apagar credenciais", async (t) => {
  for (const auth of [
    { OPENAI_API_KEY: "fake-api-key" },
    { auth_mode: "apikey", OPENAI_API_KEY: "fake-api-key", tokens: { id_token: idToken } },
    { auth_mode: "chatgpt", OPENAI_API_KEY: "fake-api-key", tokens: { id_token: idToken } },
    { auth_mode: "apikey", tokens: { id_token: idToken } },
  ]) {
    const home = await fixture(t, auth);
    const before = await fs.readFile(path.join(home, "auth.json"), "utf8");
    assert.equal((await readAccount(home))?.method, "apikey");
    await assert.rejects(requireChatGPTAccount(home), (error) => error instanceof CodexError && error.needsLogin);
    assert.equal(await fs.readFile(path.join(home, "auth.json"), "utf8"), before);
  }
});

test("sem conta, token inválido ou método desconhecido exige login ChatGPT", async (t) => {
  for (const auth of [undefined, { tokens: { id_token: "invalid" } }, { auth_mode: "unknown", tokens: { id_token: idToken } }]) {
    const home = await fixture(t, auth);
    assert.equal(await readAccount(home), null);
    await assert.rejects(requireChatGPTAccount(home), (error) => error instanceof CodexError && error.needsLogin);
  }
});
