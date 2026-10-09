import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AgentEvent, AuthStatus, Effort, ModelOption } from "../types";
import { DATA_DIR, getSettings } from "./storage";

/**
 * O Arrasta conversa com o ChatGPT através do Codex CLI oficial (pacote @openai/codex).
 * O login com a conta do ChatGPT fica numa pasta própria (data/codex), separada de qualquer
 * Codex que a pessoa já use, e cada pedido roda em modo somente leitura numa pasta temporária.
 */
const APP_HOME = path.join(DATA_DIR, "codex");
const SYSTEM_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const RUN_TIMEOUT_MS = 6 * 60 * 1000;

function codexCommand(): { cmd: string; prefix: string[] } {
  const bundled = path.join(/*turbopackIgnore: true*/ process.cwd(), "node_modules", "@openai", "codex", "bin", "codex.js");
  if (existsSync(bundled)) return { cmd: process.execPath, prefix: [bundled] };
  return { cmd: "codex", prefix: [] };
}

async function homeArgs(): Promise<{ home: string; args: string[]; isApp: boolean }> {
  const { codexHome } = await getSettings();
  if (codexHome === "system") return { home: SYSTEM_HOME, args: [], isApp: false };
  await fs.mkdir(APP_HOME, { recursive: true });
  return { home: APP_HOME, args: ["-c", 'cli_auth_credentials_store="file"'], isApp: true };
}

function envFor(home: string): NodeJS.ProcessEnv {
  return { ...process.env, CODEX_HOME: home };
}

interface Account {
  method: "chatgpt" | "apikey";
  email: string | null;
  name: string | null;
  plan: string | null;
}

function jwtClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Lê só e-mail, nome e plano do login salvo. Os tokens nunca saem daqui. */
async function readAccount(home: string): Promise<Account | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(home, "auth.json"), "utf8")) as {
      OPENAI_API_KEY?: string | null;
      tokens?: { id_token?: unknown } | null;
    };
    const idToken = raw.tokens?.id_token;
    if (typeof idToken === "string") {
      const claims = jwtClaims(idToken) ?? {};
      const auth = (claims["https://api.openai.com/auth"] ?? {}) as Record<string, unknown>;
      return {
        method: "chatgpt",
        email: typeof claims.email === "string" ? claims.email : null,
        name: typeof claims.name === "string" ? claims.name : null,
        plan: typeof auth.chatgpt_plan_type === "string" ? auth.chatgpt_plan_type : null,
      };
    }
    if (raw.OPENAI_API_KEY) return { method: "apikey", email: null, name: null, plan: null };
  } catch {
    // Sem login salvo.
  }
  return null;
}

interface LoginState {
  child: ChildProcess | null;
  url: string | null;
  error: string | null;
}

const globalLogin = globalThis as typeof globalThis & { __arrastaLogin?: LoginState };

export async function authStatus(): Promise<AuthStatus> {
  const { codexHome } = await getSettings();
  const [appAccount, systemAccount] = await Promise.all([readAccount(APP_HOME), readAccount(SYSTEM_HOME)]);
  const account = codexHome === "app" ? appAccount : systemAccount;
  const login = globalLogin.__arrastaLogin;
  return {
    connected: Boolean(account),
    mode: codexHome,
    email: account?.email ?? null,
    name: account?.name ?? null,
    plan: account?.plan ?? null,
    method: account?.method ?? null,
    loginPending: Boolean(login?.child),
    loginUrl: login?.child ? login.url : null,
    loginError: login?.child ? null : (login?.error ?? null),
    system: systemAccount?.method === "chatgpt" ? { email: systemAccount.email, plan: systemAccount.plan } : null,
  };
}

/** Abre o login do ChatGPT no navegador (o próprio Codex cuida do OAuth) e devolve o link. */
export async function startLogin(): Promise<{ url: string | null; error: string | null }> {
  globalLogin.__arrastaLogin?.child?.kill();
  await fs.mkdir(APP_HOME, { recursive: true });
  const { cmd, prefix } = codexCommand();
  const child = spawn(/*turbopackIgnore: true*/ cmd, [...prefix, "login", "-c", 'cli_auth_credentials_store="file"'], {
    env: envFor(APP_HOME),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const state: LoginState = { child, url: null, error: null };
  globalLogin.__arrastaLogin = state;

  let output = "";
  const collect = (chunk: Buffer) => {
    output += chunk.toString();
    const match = /https:\/\/auth\.openai\.com\/[^\s"'<>]+/.exec(output);
    if (match && !state.url) state.url = match[0];
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  child.on("error", (error) => {
    state.error = `Não consegui abrir o Codex: ${error.message}`;
    state.child = null;
  });
  child.on("exit", (code) => {
    if (code !== 0 && !state.error) state.error = lastLine(output) || "O login não foi concluído.";
    state.child = null;
  });
  setTimeout(() => {
    if (state.child) {
      state.error = "O login expirou. Tente de novo.";
      state.child.kill();
    }
  }, LOGIN_TIMEOUT_MS).unref();

  for (let i = 0; i < 60 && !state.url && state.child; i += 1) await sleep(100);
  return { url: state.url, error: state.child ? null : state.error };
}

export async function cancelLogin(): Promise<void> {
  const state = globalLogin.__arrastaLogin;
  if (state?.child) {
    state.error = null;
    state.child.kill();
  }
}

export async function logout(): Promise<void> {
  const { cmd, prefix } = codexCommand();
  await new Promise<void>((resolve) => {
    const child = spawn(/*turbopackIgnore: true*/ cmd, [...prefix, "logout", "-c", 'cli_auth_credentials_store="file"'], {
      env: envFor(APP_HOME),
      stdio: "ignore",
    });
    child.on("exit", () => resolve());
    child.on("error", () => resolve());
  });
  await fs.rm(path.join(APP_HOME, "auth.json"), { force: true });
}

/** Modelos que a conta enxerga, na ordem que o próprio ChatGPT recomenda. */
export async function listModels(): Promise<ModelOption[]> {
  const { home } = await homeArgs();
  try {
    const cache = JSON.parse(await fs.readFile(path.join(home, "models_cache.json"), "utf8")) as {
      models?: { slug: string; display_name?: string; visibility?: string; priority?: number; input_modalities?: string[] }[];
    };
    return (cache.models ?? [])
      .filter((m) => m.visibility === "list" && (m.input_modalities ?? ["image"]).includes("image"))
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .map((m) => ({ slug: m.slug, name: m.display_name ?? m.slug }));
  } catch {
    return [];
  }
}

export class CodexError extends Error {
  needsLogin: boolean;
  constructor(message: string, needsLogin = false) {
    super(message);
    this.needsLogin = needsLogin;
  }
}

interface RunOptions {
  prompt: string;
  schema: object;
  images?: string[];
  effort?: Effort;
  /** Deixa o ChatGPT abrir páginas da web (quando o site não entregou o texto). */
  webSearch?: boolean;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
}

interface ExecItem {
  type: string;
  text?: string;
  message?: string;
  command?: string;
}

/** Roda uma tarefa no ChatGPT e devolve o JSON no formato do schema pedido. */
export async function runCodex<T>({ prompt, schema, images = [], effort, webSearch, signal, onEvent }: RunOptions): Promise<T> {
  const settings = await getSettings();
  const { home, args: homeOverrides } = await homeArgs();
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "arrasta-"));
  const schemaFile = path.join(work, "schema.json");
  await fs.writeFile(schemaFile, JSON.stringify(schema));

  const { cmd, prefix } = codexCommand();
  const args = [
    ...prefix,
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ignore-rules",
    "--sandbox",
    "read-only",
    ...homeOverrides,
    "-c",
    `model_reasoning_effort="${effort ?? settings.effort}"`,
    "-c",
    'model_reasoning_summary="auto"',
    "-c",
    `web_search="${webSearch ? "live" : "disabled"}"`,
    "-c",
    'approval_policy="never"',
    "-c",
    "project_doc_max_bytes=0",
    "--output-schema",
    schemaFile,
  ];
  if (settings.model) args.push("--model", settings.model);
  for (const image of images) args.push("--image", image);
  args.push("--cd", work, "-");

  const child = spawn(/*turbopackIgnore: true*/ cmd, args, { env: envFor(home), stdio: ["pipe", "pipe", "pipe"] });
  child.stdin?.end(prompt);

  const abort = () => child.kill("SIGTERM");
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, RUN_TIMEOUT_MS);

  let finalText = "";
  let failure: string | null = null;
  let stderr = "";
  let buffer = "";

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let event: { type: string; item?: ExecItem; error?: { message?: string }; message?: string };
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    if (event.type === "item.completed" && event.item) {
      const item = event.item;
      if (item.type === "agent_message" && item.text) finalText = item.text;
      if (item.type === "reasoning" && item.text) onEvent?.({ type: "thought", text: cleanThought(item.text) });
      if (item.type === "error" && item.message) onEvent?.({ type: "status", text: item.message });
    } else if (event.type === "turn.failed") {
      failure = event.error?.message ?? "O ChatGPT não conseguiu terminar.";
    } else if (event.type === "error") {
      failure = event.message ?? "O ChatGPT não conseguiu terminar.";
    }
  };

  child.stdout?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    let index = buffer.indexOf("\n");
    while (index >= 0) {
      handleLine(buffer.slice(0, index));
      buffer = buffer.slice(index + 1);
      index = buffer.indexOf("\n");
    }
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });

  const code = await new Promise<number | null>((resolve) => {
    child.on("exit", (exitCode) => resolve(exitCode));
    child.on("error", (error) => {
      failure = `Não consegui abrir o Codex: ${error.message}`;
      resolve(-1);
    });
  });
  handleLine(buffer);
  clearTimeout(timer);
  signal?.removeEventListener("abort", abort);
  void fs.rm(work, { recursive: true, force: true });

  if (signal?.aborted) throw new CodexError("Cancelado.");
  if (failure || code !== 0 || !finalText) {
    const detail = failure ?? lastLine(stderr) ?? `O Codex saiu com código ${code}.`;
    const needsLogin = /401|unauthori[sz]ed|not logged in|log ?in|refresh token|sign in/i.test(detail);
    throw new CodexError(
      needsLogin ? "Sua sessão do ChatGPT expirou ou não existe. Entre com o ChatGPT de novo." : friendly(detail),
      needsLogin,
    );
  }
  try {
    return JSON.parse(finalText) as T;
  } catch {
    throw new CodexError("O ChatGPT respondeu fora do formato esperado. Tente de novo.");
  }
}

function friendly(detail: string): string {
  if (/usage limit|rate limit|429|quota/i.test(detail)) {
    return "Você atingiu o limite de uso do ChatGPT por agora. Tente mais tarde ou mude o modelo nas configurações.";
  }
  if (/model.*(not|isn't).*(supported|available|found)/i.test(detail)) {
    return "Esse modelo não está disponível na sua conta. Escolha outro nas configurações.";
  }
  return detail.length > 280 ? `${detail.slice(0, 277)}…` : detail;
}

function cleanThought(text: string): string {
  return text.replace(/\*\*/g, "").trim();
}

function lastLine(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("Reading additional input"));
  return lines.at(-1) ?? null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
