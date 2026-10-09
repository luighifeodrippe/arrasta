"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/app-store";
import { instagramHandle } from "@/lib/client/instagram-mapping";
import type { InstagramImportResult } from "@/lib/types";
import { Button } from "../ui/button";
import { Label } from "../ui/field";

type Evidence = { analyzedAt?: string | null; sampleCount?: number; imageCount?: number };

export function MappingEvidence({ sampleCount = 0, imageCount = 0, reused = false }: Evidence & { reused?: boolean }) {
  return <span>{reused ? "Análise salva reutilizada" : "Guia pronto"} · {sampleCount} {sampleCount === 1 ? "legenda" : "legendas"}{imageCount ? ` e ${imageCount} ${imageCount === 1 ? "imagem" : "imagens"}` : ""}</span>;
}

/** Uma submissão lê o perfil e analisa a escrita. Digitar nunca dispara a IA. */
export function InstagramMapper({
  handle, onHandleChange, onMapped, onStart, label = "@ no Instagram", buttonLabel = "Mapear", evidence, disabled = false, canSubmit = true,
}: {
  handle: string;
  onHandleChange: (handle: string) => void;
  onMapped: (result: InstagramImportResult) => void | Promise<void>;
  onStart?: () => void;
  label?: string;
  buttonLabel?: string;
  evidence?: Evidence;
  disabled?: boolean;
  canSubmit?: boolean;
}) {
  const id = useId();
  const auth = useApp((state) => state.auth);
  const loginOpen = useApp((state) => state.loginOpen);
  const setLoginOpen = useApp((state) => state.setLoginOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InstagramImportResult | null>(null);
  const pending = useRef<{ handle: string; auth: typeof auth; loginStarted: boolean } | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const latest = useRef({ handle, onMapped, onStart });
  latest.current = { handle, onMapped, onStart };

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const map = async (refresh = false, resumeHandle?: string) => {
    const requested = instagramHandle(resumeHandle ?? latest.current.handle);
    if (running.current || disabled || !canSubmit) return;
    if (!/^[a-z0-9._]{1,30}$/.test(requested)) {
      setError("Informe o @ do perfil, sem o link.");
      return;
    }
    running.current = true;
    pending.current = null;
    setBusy(true);
    setError("");
    latest.current.onStart?.();
    try {
      const data = await api.profileFromInstagram(requested, refresh);
      await latest.current.onMapped(data);
      if (!mounted.current) return;
      setResult(data);
      if (data.analysis.status === "needs_login") pending.current = { handle: requested, auth: useApp.getState().auth, loginStarted: false };
    } catch (error) {
      if (mounted.current) setError((error as Error).message);
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const latestMap = useRef(map);
  latestMap.current = map;

  useEffect(() => {
    const waiting = pending.current;
    if (!waiting?.loginStarted || loginOpen || !auth?.connected || auth === waiting.auth || running.current) return;
    pending.current = null;
    void latestMap.current(false, waiting.handle);
  }, [auth, loginOpen]);

  const visibleResult = result && instagramHandle(result.handle) === instagramHandle(handle) ? result : null;
  const mapped = Boolean(evidence?.analyzedAt || (visibleResult?.analysis.status === "ready" && visibleResult.analysis.guide));
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <form onSubmit={(event) => { event.preventDefault(); void map(mapped); }} className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="field flex h-10 min-w-[150px] flex-1 items-center px-3">
          <span className="text-[14px] text-ink-3" aria-hidden>@</span>
          <input id={id} value={handle} onChange={(event) => { onHandleChange(event.target.value.replace(/^@+/, "").replace(/\s/g, "")); setError(""); setResult(null); pending.current = null; }} disabled={busy || disabled} autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={30} placeholder="seuperfil" aria-invalid={Boolean(error)} aria-describedby={`${id}-status`} className="h-full min-w-0 flex-1 bg-transparent px-1 text-[14px] outline-none placeholder:text-ink-3 disabled:opacity-50" />
        </div>
        <Button type="submit" size="sm" disabled={busy || disabled || !canSubmit} className="h-10">{busy ? "Mapeando…" : mapped ? "Atualizar" : buttonLabel}</Button>
      </form>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-3">Até 6 legendas e 4 imagens · uma análise por mapeamento. Guias salvos são reutilizados.</p>
      <div id={`${id}-status`} role={error ? "alert" : "status"} aria-live="polite" className={`mt-2 text-[12px] leading-relaxed ${error ? "text-red-300" : "text-ink-3"}`}>
        {busy ? <span className="flex items-center gap-2"><ThinkingOrb state="composing" size={20} theme="dark" aria-hidden />{auth?.connected ? "Lendo perfil e analisando a escrita…" : "Lendo perfil público…"}</span> : error || (visibleResult?.analysis.status === "ready" ? <MappingEvidence {...visibleResult.analysis} /> : visibleResult ? visibleResult.analysis.message || visibleResult.notice : evidence?.analyzedAt ? <MappingEvidence {...evidence} /> : null)}
      </div>
      {!busy && visibleResult?.analysis.status === "needs_login" && <Button size="sm" className="mt-2" onClick={() => { if (pending.current) pending.current.loginStarted = true; setLoginOpen(true); }}>Entrar com ChatGPT e continuar</Button>}
      {!busy && visibleResult?.analysis.status === "ready" && visibleResult.analysis.sourceUrls.length > 0 && <details className="mt-2 text-[12px] text-ink-3"><summary className="cursor-pointer">Conteúdos analisados</summary><ul className="mt-2 space-y-1">{visibleResult.analysis.sourceUrls.map((url, index) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">Abrir publicação {index + 1}</a></li>)}</ul></details>}
    </div>
  );
}
