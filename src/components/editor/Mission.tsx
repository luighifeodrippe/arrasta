"use client";

import { BulbIcon, ChatGptIcon, Image02Icon, Link01Icon, QuillWrite01Icon, StopIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconData } from "@/components/ui/icon";
import { identityOf, useApp } from "@/lib/client/app-store";
import { FONTS, TEMPLATES } from "@/lib/defaults";
import { words } from "@/lib/review";
import type { CarouselSource, DetectedStyle, Project } from "@/lib/types";
import { useAgent } from "./agent-store";

export type StationState = "done" | "active" | "todo";

/** Uma estação do trabalho: quem faz, em que pé está, o que ela mostra e a peça que entrega à seguinte. */
export interface Station {
  id: string;
  icon: IconData;
  title: string;
  state: StationState;
  /** A peça que sai desta estação para a próxima (o rótulo do fio). */
  piece?: string;
  body?: ReactNode;
}

const STATE_LABEL: Record<StationState, string> = { done: "feito", active: "trabalhando", todo: "na fila" };
const EASE = [0.23, 1, 0.32, 1] as const;

/** O anel do ofício: trilho tracejado e, enquanto a estação trabalha, um arco aceso girando nele. */
function Ring({ icon, state }: { icon: IconData; state: StationState }) {
  return (
    <span className="orbit" data-state={state}>
      <svg className="orbit-hud" viewBox="0 0 52 52" aria-hidden>
        <circle className="orbit-track" cx="26" cy="26" r="25" />
        <g className="orbit-spin">
          <circle className="orbit-trail" cx="26" cy="26" r="25" pathLength={100} />
          <circle className="orbit-arc" cx="26" cy="26" r="25" pathLength={100} />
        </g>
      </svg>
      <Icon icon={icon} className="size-5" />
    </span>
  );
}

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** Segundos desde o começo, contados enquanto a tela está aberta. */
function useSince(startedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.round((now - startedAt) / 1000));
}

/**
 * O trabalho do ChatGPT Work à vista: uma linha de estações ligadas por fios. A que trabalha tem o anel girando e
 * mostra o que está fazendo; a peça que ela entrega corre pelo fio até a seguinte; o que já foi feito fica aceso.
 */
export function MissionBoard({ title, startedAt, stations, onStop }: { title: string; startedAt: number; stations: Station[]; onStop?: () => void }) {
  const seconds = useSince(startedAt);
  // A estação que trabalha fica sempre à vista: quando a vez passa, a tela acompanha.
  const line = useRef<HTMLOListElement>(null);
  const activeId = stations.find((station) => station.state === "active")?.id;
  useEffect(() => {
    const timer = setTimeout(() => line.current?.querySelector('[data-state="active"]')?.scrollIntoView({ block: "center", behavior: "smooth" }), 260);
    return () => clearTimeout(timer);
  }, [activeId]);
  return (
    <section className="mission" aria-label={title}>
      <header className="mission-head">
        <Ring icon={ChatGptIcon} state="active" />
        <div className="min-w-0 flex-1">
          <p className="mission-kicker">ChatGPT Work trabalhando</p>
          <h2 className="mission-title">{title}</h2>
        </div>
        <div className="mission-clock" role="timer" aria-label={`${seconds} segundos`}>
          <b>{clock(seconds)}</b>
          <div className="mission-lights" aria-hidden>
            {stations.map((station) => (
              <i key={station.id} data-state={station.state} />
            ))}
          </div>
        </div>
        {onStop && (
          <button type="button" className="chip-key" onClick={onStop}>
            <Icon icon={StopIcon} className="size-3 fill-current" />
            Parar
          </button>
        )}
      </header>
      <ol ref={line} className="mission-line" role="status" aria-live="polite">
        {stations.map((station, position) => {
          const next = stations[position + 1];
          const flow = !next ? null : next.state === "todo" ? "off" : next.state === "active" ? "running" : "lit";
          return (
            <motion.li
              key={station.id}
              className="station"
              data-state={station.state}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: position * 0.07 }}
            >
              <div className="station-rail">
                <Ring icon={station.icon} state={station.state} />
                {flow && (
                  <span className="station-wire" data-flow={flow} aria-hidden>
                    <i />
                  </span>
                )}
              </div>
              <div className="station-main">
                <div className="station-card">
                  <div className="station-head">
                    <span className="station-n">{position + 1}</span>
                    <h3>{station.title}</h3>
                    <span className="station-state">
                      <i aria-hidden />
                      {STATE_LABEL[station.state]}
                    </span>
                  </div>
                  {station.body}
                </div>
                {flow && (
                  <p className="station-piece" data-flow={flow}>
                    {station.piece}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}

/** Os cards do original lado a lado: a luz de leitura passa em cada um e, lido, o texto aparece por cima. */
export function Shots({ shots, reading, texts }: { shots: string[]; reading: boolean; texts?: string[] }) {
  const shown = shots.slice(0, 7);
  return (
    <div className="exhibit-strip">
      {shown.map((src, position) => {
        const text = texts?.[position]?.trim();
        return (
          <motion.div
            key={src}
            className="exhibit-shot"
            data-read={text ? "" : undefined}
            initial={{ opacity: 0, y: 10, rotate: position % 2 ? 1.5 : -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.12 + position * 0.06 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Card original ${position + 1}`} />
            {reading && !text && <span className="exhibit-beam arrasta-scan" style={{ animationDelay: `${position * 0.28}s` }} aria-hidden />}
            {text && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 + position * 0.08 }}>
                {text.replace(/\*\*/g, "")}
              </motion.p>
            )}
            <span className="exhibit-shot__n">{position + 1}</span>
          </motion.div>
        );
      })}
      {shots.length > shown.length && <span className="exhibit-more">+{shots.length - shown.length}</span>}
    </div>
  );
}

/** Gancho, estrutura e motivo: cada linha entra depois da outra, no ritmo de quem lê. */
function Why({ analysis }: { analysis: NonNullable<CarouselSource["analysis"]> }) {
  const rows: [string, string][] = [
    ["Gancho", analysis.hook],
    ["Estrutura", analysis.structure],
    ["Motivo", analysis.why],
  ];
  return (
    <dl className="exhibit-rows">
      {rows.map(([term, text], position) => (
        <motion.div key={term} className="exhibit-row" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, ease: EASE, delay: 0.2 + position * 0.45 }}>
          <dt className="seal">{term}</dt>
          <dd>{text}</dd>
        </motion.div>
      ))}
    </dl>
  );
}

/** A escrita: de quem é a voz, o que o pedido usa, o que o modelo está pensando agora e os cards saindo. */
function Writing({ uses, style, count, thought, status }: { uses: string[]; style: DetectedStyle | null; count: number; thought: string | null; status: string }) {
  const profile = useApp((s) => s.profile);
  const identity = identityOf(profile);
  const light = style?.theme === "light";
  const said = thought?.replace(/\*\*/g, "").trim();
  return (
    <>
      <div className="exhibit-voice">
        {identity.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identity.avatar} alt="" />
        ) : (
          <span className="rail-face">{(identity.name || "?").charAt(0).toUpperCase()}</span>
        )}
        <b>{identity.handle ? `@${identity.handle}` : identity.name || "Sua voz"}</b>
        {uses
          .filter((use) => !/^Voz de/i.test(use))
          .map((use) => (
            <span key={use} className="seal">
              {use}
            </span>
          ))}
        {style && (
          <span className="seal">
            <i style={{ background: style.accent, boxShadow: "none" }} />
            {TEMPLATES.find((template) => template.id === style.template)?.name} · {FONTS.find((font) => font.id === style.font)?.name}
          </span>
        )}
      </div>
      <p className="exhibit-thought" key={said ?? status}>
        {said ? said.slice(-220) : <span className="arrasta-shimmer-text">{status}…</span>}
        <i aria-hidden />
      </p>
      <div className="exhibit-cards" aria-hidden>
        {Array.from({ length: Math.min(count, 10) }, (_, position) => (
          <span key={position} className="exhibit-card" data-light={light || undefined} style={{ animationDelay: `${position * 0.32}s`, ["--accent" as string]: style?.accent ?? "#ff3500" }}>
            <i />
            <i />
            <i />
          </span>
        ))}
      </div>
    </>
  );
}

export const cardsOf = (count: number) => (count === 1 ? "1 card" : `${count} cards`);
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** O trabalho de criar ou recriar um carrossel, com o que o servidor informa de verdade em cada etapa. */
export function Mission({ project }: { project: Project }) {
  const phase = useAgent((s) => s.phase);
  const kind = useAgent((s) => s.kind);
  const status = useAgent((s) => s.status);
  const thought = useAgent((s) => s.thought);
  const startedAt = useAgent((s) => s.startedAt);
  const stop = useAgent((s) => s.stop);
  const source = project.source;
  const shots = source?.slides ?? [];
  const uses = [...project.chat].reverse().find((entry) => entry.role === "user")?.uses ?? [];
  const writing = phase === "write";
  const write: Station = {
    id: "escrever",
    icon: QuillWrite01Icon,
    title: writing ? status || "Escrevendo na sua voz" : "Escrever na sua voz",
    state: writing ? "active" : "todo",
    body: writing ? <Writing uses={uses} style={source?.style ?? null} count={shots.length || 7} thought={thought} status={status || "Escrevendo na sua voz"} /> : <p className="station-note">Os cards novos, com o seu jeito de falar.</p>,
  };

  let title = "Criando o seu carrossel";
  let stations: Station[];
  if (source && shots.length) {
    const who = source.author ? `@${source.author.username}` : null;
    const read = shots.every((shot) => shot.text.trim());
    const total = shots.reduce((sum, shot) => sum + words(shot.text), 0);
    title = who ? `Recriando o carrossel de ${who} na sua voz` : "Recriando o carrossel na sua voz";
    const numbers = [source.likes !== null ? `${compact.format(source.likes)} curtidas` : "", source.comments !== null ? `${compact.format(source.comments)} comentários` : ""].filter(Boolean);
    stations = [
      {
        id: "abrir",
        icon: Image02Icon,
        title: who ? `Carrossel de ${who}` : "O original",
        state: "done",
        piece: cardsOf(shots.length),
        body: <p className="station-note">{[cardsOf(shots.length), ...numbers].join(" · ")}</p>,
      },
      {
        id: "ler",
        icon: ViewIcon,
        title: read ? `Li ${shots.length === 1 ? "o card" : `os ${shots.length} cards`}` : `Lendo ${shots.length === 1 ? "o card" : `os ${shots.length} cards`}`,
        state: writing ? "done" : "active",
        piece: read ? `${total} palavras lidas` : "o texto de cada card",
        body: <Shots shots={shots.map((shot) => shot.src)} reading={!writing} texts={shots.map((shot) => shot.text)} />,
      },
      {
        id: "entender",
        icon: BulbIcon,
        title: "Por que funciona",
        state: source.analysis && writing ? "done" : "todo",
        piece: "gancho, estrutura e motivo",
        body: source.analysis && writing ? <Why analysis={source.analysis} /> : <p className="station-note">O gancho, a estrutura e o motivo de ter funcionado.</p>,
      },
      write,
    ];
  } else if (source && source.kind !== "idea") {
    const video = source.kind === "youtube";
    const who = source.author ? `@${source.author.username}` : null;
    title = video ? "Transformando o vídeo em carrossel" : "Transformando o conteúdo em carrossel";
    stations = [
      {
        id: "abrir",
        icon: Link01Icon,
        title: video ? "Vídeo do YouTube" : source.kind === "x" ? `Post de ${who ?? "X"}` : (source.site ?? "A página"),
        state: "done",
        piece: video ? "a transcrição" : "o texto",
        body: (
          <div className="exhibit-source">
            {source.media[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={source.media[0]} alt="" />
            )}
            <div className="min-w-0">
              {source.title && <b>{source.title}</b>}
              {source.text && <p>{(video ? (source.text.split("Transcrição do vídeo:\n")[1] ?? source.text) : source.text).slice(0, 260)}</p>}
            </div>
          </div>
        ),
      },
      { ...write, state: "active", title: status || "Escrevendo na sua voz", body: <Writing uses={uses} style={null} count={7} thought={thought} status={status || "Escrevendo na sua voz"} /> },
    ];
  } else {
    title = kind === "create" ? "Escrevendo o carrossel da sua ideia" : title;
    stations = [
      {
        id: "ideia",
        icon: BulbIcon,
        title: "A sua ideia",
        state: "done",
        piece: "o pedido",
        body: source?.brief ? <p className="station-note station-note--said">“{source.brief}”</p> : undefined,
      },
      { ...write, state: "active", title: status || "Escrevendo na sua voz", body: <Writing uses={uses} style={null} count={7} thought={thought} status={status || "Escrevendo na sua voz"} /> },
    ];
  }

  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <MissionBoard title={title} startedAt={startedAt} stations={stations} onStop={stop} />
    </div>
  );
}
