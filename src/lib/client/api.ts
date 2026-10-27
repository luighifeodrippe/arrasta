import type { AgentEvent, AuthStatus, CarouselFormat, InstagramImportResult, ModelOption, Profile, Project, Settings } from "../types";

async function json<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok || (data && typeof data === "object" && "error" in data && data.error)) {
    throw new Error(data.error || `Erro ${response.status}`);
  }
  return data;
}

const put = (body: unknown): RequestInit => ({
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  auth: () => fetch("/api/auth", { cache: "no-store" }).then(json<AuthStatus & { models: ModelOption[] }>),
  authAction: (action: "login" | "cancel" | "logout" | "use-system") =>
    fetch("/api/auth", post({ action })).then(json<AuthStatus>),
  settings: () => fetch("/api/settings", { cache: "no-store" }).then(json<{ settings: Settings; models: ModelOption[] }>),
  saveSettings: (patch: Partial<Settings>) => fetch("/api/settings", put(patch)).then(json<{ settings: Settings }>),
  profile: () => fetch("/api/profile", { cache: "no-store" }).then(json<Profile>),
  saveProfile: (profile: Profile) => fetch("/api/profile", put(profile)).then(json<Profile>),
  profileFromInstagram: (handle: string, refresh = false) =>
    fetch("/api/profile/instagram", post({ handle, refresh })).then(json<InstagramImportResult>),
  projects: () => fetch("/api/projects", { cache: "no-store" }).then(json<Project[]>),
  project: (id: string) => fetch(`/api/projects/${id}`, { cache: "no-store" }).then(json<Project>),
  createProject: (body: { kind: "blank" } | { kind: "idea"; brief: string; formatId?: string | null } | { kind: "link"; url: string; formatId?: string | null }) =>
    fetch("/api/projects", post(body)).then(json<Project>),
  createFromImages: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return fetch("/api/projects", { method: "POST", body: form }).then(json<Project>);
  },
  saveProject: (project: Project, keepalive = false) => fetch(`/api/projects/${project.id}`, { ...put(project), keepalive }).then(json<Project>),
  deleteProject: (id: string) => fetch(`/api/projects/${id}`, { method: "DELETE" }).then(json<{ ok: boolean }>),
  formats: () => fetch("/api/formats", { cache: "no-store" }).then(json<CarouselFormat[]>),
  importFormat: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch("/api/formats", { method: "POST", body: form }).then(json<CarouselFormat>);
  },
  createFormat: (body: { name: string; prompt: string }) => fetch("/api/formats", post(body)).then(json<CarouselFormat>),
  deleteFormat: (id: string) => fetch(`/api/formats/${id}`, { method: "DELETE" }).then(json<{ ok: boolean }>),
  upload: (scope: string, file: File) => {
    const form = new FormData();
    form.append("scope", scope);
    form.append("file", file);
    return fetch("/api/upload", { method: "POST", body: form }).then(json<{ url: string }>);
  },
};

/** Chama uma tarefa do ChatGPT e entrega cada evento assim que chega. */
export async function runAgent(
  body: Record<string, unknown>,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<AgentEvent | null> {
  const response = await fetch("/api/ai", { ...post(body), signal });
  if (!response.ok || !response.body) {
    const event: AgentEvent = { type: "error", message: `Erro ${response.status}` };
    onEvent(event);
    return event;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: AgentEvent | null = null;
  const emit = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AgentEvent;
    if (event.type === "done" || event.type === "error") last = event;
    onEvent(event);
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf("\n");
      while (index >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        emit(line);
        index = buffer.indexOf("\n");
      }
    }
    emit(buffer + decoder.decode());
  } catch (error) {
    if (signal?.aborted) throw error;
    // Uma linha cortada ou falha de leitura também pode interromper a resposta.
  } finally {
    reader.releaseLock();
  }
  if (!last) {
    last = { type: "error", message: "A conexão com o ChatGPT caiu antes do fim. Tente de novo." };
    onEvent(last);
  }
  return last;
}
