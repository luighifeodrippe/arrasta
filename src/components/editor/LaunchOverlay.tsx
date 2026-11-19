"use client";

import { BulbIcon, Image02Icon, Link01Icon, QuillWrite01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { useLaunch } from "@/lib/client/launch-store";
import { cardsOf, MissionBoard, Shots, type Station } from "./Mission";

/**
 * Do clique em "Recriar" até o carrossel abrir no editor: a mesma missão, na janela inteira, já com a primeira
 * estação trabalhando (abrir o link, guardar os prints ou a ideia). Some quando o editor assume.
 */
export function LaunchOverlay() {
  const launching = useLaunch((s) => s.launching);
  if (!launching) return null;
  const { mode, link, brief, previews, count, startedAt } = launching;
  let host = "";
  try {
    host = new URL(/^https?:/i.test(link) ? link : `https://${link}`).hostname.replace(/^www\./, "");
  } catch {
    // Link que não é um endereço: o título fica genérico.
  }
  const write: Station = { id: "escrever", icon: QuillWrite01Icon, title: "Escrever na sua voz", state: "todo", body: <p className="station-note">Os cards novos, com o seu jeito de falar.</p> };
  const stations: Station[] =
    mode === "prints"
      ? [
          { id: "abrir", icon: Image02Icon, title: count === 1 ? "Guardando o print" : `Guardando os ${count} prints`, state: "active", piece: cardsOf(count), body: <Shots shots={previews} reading={false} /> },
          { id: "ler", icon: ViewIcon, title: "Ler cada card", state: "todo", piece: "o texto de cada card", body: <p className="station-note">O que está escrito em cada um, na ordem.</p> },
          { id: "entender", icon: BulbIcon, title: "Por que funciona", state: "todo", piece: "gancho, estrutura e motivo", body: <p className="station-note">O gancho, a estrutura e o motivo de ter funcionado.</p> },
          write,
        ]
      : mode === "link"
        ? [
            { id: "abrir", icon: Link01Icon, title: host ? `Abrindo ${host}` : "Abrindo o link", state: "active", piece: "o conteúdo do link", body: <p className="station-note station-note--said break-all">{link}</p> },
            { id: "ler", icon: ViewIcon, title: "Ler o conteúdo", state: "todo", piece: "o que ele diz", body: <p className="station-note">Os cards, o texto ou a transcrição do que está no link.</p> },
            write,
          ]
        : [{ id: "ideia", icon: BulbIcon, title: "Guardando a sua ideia", state: "active", piece: "o pedido", body: <p className="station-note station-note--said">“{brief}”</p> }, write];

  return (
    <div className="launch" role="dialog" aria-modal="true" aria-label="Começando um carrossel novo">
      <MissionBoard title={mode === "idea" ? "Criando o carrossel da sua ideia" : "Recriando na sua voz"} startedAt={startedAt} stations={stations} />
    </div>
  );
}
