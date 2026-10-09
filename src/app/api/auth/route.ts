import { authStatus, cancelLogin, listModels, logout, startLogin } from "@/lib/server/codex";
import { saveSettings } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const [status, models] = await Promise.all([authStatus(), listModels()]);
  return Response.json({ ...status, models });
}

export async function POST(request: Request) {
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  if (action === "login") {
    await saveSettings({ codexHome: "app" });
    const result = await startLogin();
    return Response.json({ ...(await authStatus()), loginUrl: result.url, loginError: result.error });
  }
  if (action === "cancel") await cancelLogin();
  if (action === "logout") {
    const status = await authStatus();
    // No login do Codex do computador, "sair" só desliga o uso aqui; a conta continua conectada lá.
    if (status.mode === "system") await saveSettings({ codexHome: "app" });
    else await logout();
  }
  if (action === "use-system") await saveSettings({ codexHome: "system" });
  return Response.json(await authStatus());
}
