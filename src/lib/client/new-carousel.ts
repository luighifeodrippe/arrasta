"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RemixLevel } from "../types";
import { api } from "./api";
import { useApp } from "./app-store";
import { useLaunch, type Launching } from "./launch-store";

export function useNewCarousel() {
  const router = useRouter();
  const [mode, setModeState] = useState<Launching["mode"]>("link");
  const [link, setLink] = useState("");
  const [idea, setIdea] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<RemixLevel>("pouco");
  const [formatId, setFormatId] = useState<string | null>(null);
  const [formatPicked, setFormatPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = useApp((s) => s.auth?.connected ?? false);
  const setLoginOpen = useApp((s) => s.setLoginOpen);
  const pending = useRef(false);
  const submitting = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("arrasta:home-mode");
      if (saved === "link" || saved === "idea" || saved === "prints") setModeState(saved);
    } catch {
      // Sem armazenamento: começa em Link.
    }
  }, []);

  const setMode = (mode: Launching["mode"]) => {
    setModeState(mode);
    try {
      localStorage.setItem("arrasta:home-mode", mode);
    } catch {
      // Sem armazenamento: a aba vale só nesta visita.
    }
    setError(null);
  };

  const setFormat = (id: string | null) => {
    setFormatId(id);
    setFormatPicked(true);
  };

  const ready = mode === "link" ? link.trim().length > 0 : mode === "idea" ? idea.trim().length > 0 : files.length > 0;
  // Carrosséis do Instagram seguem o formato original.
  const isInstagram = /instagram\.com|instagr\.am/i.test(link);
  const showFormats = mode === "idea" || (mode === "link" && link.trim().length > 0 && !isInstagram);
  const isVideo = mode === "link" && /youtube\.com|youtu\.be/i.test(link);
  const chosenFormat = formatPicked ? formatId : isVideo ? "storytelling" : formatId;

  const submit = async () => {
    if (!ready || busy || submitting.current) return;
    if (!connected) {
      pending.current = true;
      setLoginOpen(true);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const chosen = showFormats ? chosenFormat : null;
      useLaunch.getState().start({
        mode,
        link: mode === "link" ? link.trim() : "",
        brief: mode === "idea" ? idea.trim() : "",
        previews: mode === "prints" ? files.slice(0, 12).map((file) => URL.createObjectURL(file)) : [],
        count: mode === "prints" ? files.length : 0,
        level,
        startedAt: Date.now(),
      });
      const project =
        mode === "link"
          ? await api.createProject({ kind: "link", url: link.trim(), formatId: chosen })
          : mode === "idea"
            ? await api.createProject({ kind: "idea", brief: idea.trim(), formatId: chosen })
            : await api.createFromImages(files);
      router.push(`/editor/${project.id}?auto=${mode === "idea" ? "create" : `remix&level=${level}`}`);
    } catch (e) {
      useLaunch.getState().clear();
      setError((e as Error).message);
      submitting.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (connected && pending.current) {
      pending.current = false;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return {
    mode, setMode,
    link, setLink,
    idea, setIdea,
    files, setFiles,
    level, setLevel,
    formatId, setFormat,
    busy, error, ready,
    isInstagram, showFormats, isVideo, chosenFormat,
    submit,
  };
}
