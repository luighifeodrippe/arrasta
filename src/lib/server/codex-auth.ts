import { promises as fs } from "node:fs";
import path from "node:path";

export class CodexError extends Error {
  needsLogin: boolean;
  constructor(message: string, needsLogin = false) {
    super(message);
    this.needsLogin = needsLogin;
  }
}

export interface Account {
  method: "chatgpt" | "apikey";
  email: string | null;
  name: string | null;
  plan: string | null;
}

/** Usa apenas o login escolhido no app, sem herdar credenciais de API do terminal. */
export function envFor(home: string, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...inherited, CODEX_HOME: home };
  for (const key of ["OPENAI_API_KEY", "CODEX_API_KEY", "CODEX_ACCESS_TOKEN", "OPENAI_BASE_URL"]) delete env[key];
  return env;
}

function jwtClaims(token: string): Record<string, unknown> | null {
  try {
    const claims: unknown = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return claims && typeof claims === "object" && !Array.isArray(claims) ? claims as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Lê só o método, e-mail, nome e plano. Não altera o login nem devolve tokens. */
export async function readAccount(home: string): Promise<Account | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(home, "auth.json"), "utf8")) as {
      auth_mode?: string | null;
      OPENAI_API_KEY?: string | null;
      tokens?: { id_token?: unknown } | null;
    };
    // Uma chave salva nunca deve passar por login do ChatGPT, mesmo com tokens antigos.
    if (raw.OPENAI_API_KEY || raw.auth_mode === "apikey") return { method: "apikey", email: null, name: null, plan: null };
    if (raw.auth_mode && raw.auth_mode !== "chatgpt") return null;
    const idToken = raw.tokens?.id_token;
    const claims = typeof idToken === "string" ? jwtClaims(idToken) : null;
    if (claims) {
      const auth = (claims["https://api.openai.com/auth"] ?? {}) as Record<string, unknown>;
      return {
        method: "chatgpt",
        email: typeof claims.email === "string" ? claims.email : null,
        name: typeof claims.name === "string" ? claims.name : null,
        plan: typeof auth.chatgpt_plan_type === "string" ? auth.chatgpt_plan_type : null,
      };
    }
  } catch {
    // Sem login salvo ou arquivo inválido.
  }
  return null;
}

/** Bloqueia antes de iniciar o CLI; não usa forced_login_method, que pode apagar o login. */
export async function requireChatGPTAccount(home: string): Promise<Account> {
  const account = await readAccount(home);
  if (account?.method !== "chatgpt") {
    throw new CodexError("Entre com sua conta do ChatGPT para continuar. O Arrasta AI não usa chaves de API.", true);
  }
  return account;
}
