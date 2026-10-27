"use client";

import { ArrowRight02Icon, Bookmark02Icon, Delete02Icon, FileTextIcon, Link04Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import type { LibraryItem } from "@/lib/server/library";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { Input, Label, Textarea } from "../ui/field";
import { Icon } from "../ui/icon";

async function libraryRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não consegui acessar o banco de conteúdos.");
  return data as T;
}

export function ContentBank() {
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<LibraryItem["kind"]>("link");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [removing, setRemoving] = useState<LibraryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewing, setViewing] = useState<LibraryItem | null>(null);

  const load = () => {
    setError(null);
    void libraryRequest<LibraryItem[]>("/api/library").then(setItems).catch((error: Error) => setError(error.message));
  };

  useEffect(load, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const item = await libraryRequest<LibraryItem>("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, content }),
      });
      setItems((current) => [item, ...(current ?? [])]);
      setError(null);
      setTitle("");
      setContent("");
      setOpen(false);
      toast.success("Conteúdo salvo");
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const create = async (item: LibraryItem) => {
    if (creating) return;
    setCreating(item.id);
    try {
      const project = await api.createProject(item.kind === "link" ? { kind: "link", url: item.content } : { kind: "idea", brief: item.content });
      router.push(`/editor/${project.id}`);
    } catch (error) {
      toast.error((error as Error).message);
      setCreating(null);
    }
  };

  const remove = async () => {
    if (!removing || deleting) return;
    setDeleting(true);
    try {
      await libraryRequest(`/api/library/${removing.id}`, { method: "DELETE" });
      setItems((current) => current?.filter((item) => item.id !== removing.id) ?? []);
      setRemoving(null);
      toast("Conteúdo excluído");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="home-section" aria-labelledby="content-bank-heading">
      <div className="home-section-heading home-bank-heading">
        <div>
          <h2 id="content-bank-heading" className="titulo">Banco de conteúdos</h2>
          <p className="text-ink-3">Guarde links e ideias para seus próximos carrosséis.</p>
        </div>
        <Dialog open={open} onOpenChange={(next) => { if (!saving) { setOpen(next); setSaveError(null); } }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="glass" className="home-bank-save home-pill h-9 rounded-full px-4 text-[14px]"><Icon icon={PlusSignIcon} />Salvar conteúdo</Button>
          </DialogTrigger>
          <DialogContent title="Salvar conteúdo" description="Seu banco fica guardado neste computador.">
            <form onSubmit={save} className="space-y-4">
              <div className="flex gap-2" role="group" aria-label="Tipo de conteúdo">
                <Button size="sm" variant="glass" className={kind === "link" ? "bg-white/[0.12] text-white" : undefined} aria-pressed={kind === "link"} onClick={() => { setKind("link"); setSaveError(null); }}>Link</Button>
                <Button size="sm" variant="glass" className={kind === "text" ? "bg-white/[0.12] text-white" : undefined} aria-pressed={kind === "text"} onClick={() => { setKind("text"); setSaveError(null); }}>Texto ou ideia</Button>
              </div>
              <div>
                <Label htmlFor="library-title" hint="Opcional">Título</Label>
                <Input id="library-title" name="title" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Como quero lembrar deste conteúdo" />
              </div>
              <div>
                <Label htmlFor="library-content">{kind === "link" ? "Link do conteúdo" : "Texto ou ideia"}</Label>
                {kind === "link" ? (
                  <Input id="library-content" name="url" inputMode="url" autoComplete="url" maxLength={4096} value={content} required onChange={(event) => setContent(event.target.value)} placeholder="https://" aria-describedby={saveError ? "library-save-error" : undefined} aria-invalid={Boolean(saveError)} />
                ) : (
                  <Textarea id="library-content" name="text" rows={6} maxLength={20_000} value={content} required onChange={(event) => setContent(event.target.value)} placeholder="Cole uma anotação, um trecho ou uma ideia para desenvolver depois." aria-describedby={saveError ? "library-save-error" : undefined} aria-invalid={Boolean(saveError)} />
                )}
              </div>
              {saveError && <p id="library-save-error" role="alert" className="text-[13px] text-red-300">{saveError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
                <Button type="submit" variant="lit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error ? (
        <div className="home-bank-panel flex flex-wrap items-center gap-3">
          <p role="alert" className="text-[13px] text-red-300">{error}</p>
          <Button size="sm" onClick={load}>Tentar novamente</Button>
        </div>
      ) : items === null ? (
        <p role="status" className="text-[13px] text-ink-3">Carregando conteúdos…</p>
      ) : items.length === 0 ? (
        <div className="home-bank-panel flex items-center gap-3">
          <Icon icon={Bookmark02Icon} className="size-5 shrink-0 text-ink-3" />
          <p className="text-[15px] text-ink-2">Salve algo que vale um carrossel. Quando quiser, crie a partir daqui.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="home-bank-panel flex min-w-0 flex-col">
              <div className="flex items-start gap-2.5">
                <Icon icon={item.kind === "link" ? Link04Icon : FileTextIcon} className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <button onClick={() => setViewing(item)} className="block w-full text-left text-[15px] font-semibold leading-snug hover:underline">
                    <span className="line-clamp-2 break-words">{item.title}</span>
                  </button>
                  <p className="mt-1.5 line-clamp-2 break-words text-[14px] leading-relaxed text-ink-3">{item.content}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <Button size="sm" variant="glass" className="rounded-full text-[14px]" onClick={() => void create(item)} disabled={creating !== null}>
                  {creating === item.id ? "Preparando…" : "Criar carrossel"}<Icon icon={ArrowRight02Icon} />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Excluir ${item.title}`} title="Excluir conteúdo" onClick={() => setRemoving(item)} disabled={creating === item.id}><Icon icon={Delete02Icon} /></Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={Boolean(viewing)} onOpenChange={(next) => { if (!next) setViewing(null); }}>
        <DialogContent title={viewing?.title ?? "Conteúdo salvo"} footer={<Button variant="lit" onClick={() => viewing && void create(viewing)} disabled={creating !== null}>{creating ? "Preparando…" : "Criar carrossel"}<Icon icon={ArrowRight02Icon} /></Button>}>
          {viewing?.kind === "link" ? <a href={viewing.content} target="_blank" rel="noreferrer" className="break-all text-[14px] text-ink-2 underline underline-offset-4">{viewing.content}</a> : <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink-2">{viewing?.content}</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removing)} onOpenChange={(next) => { if (!next && !deleting) setRemoving(null); }}>
        <DialogContent title="Excluir conteúdo?" description="Os carrosséis criados a partir dele continuam salvos." footer={<><Button disabled={deleting} onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="danger" disabled={deleting} onClick={() => void remove()}>{deleting ? "Excluindo…" : "Excluir"}</Button></>}>
          <p className="break-words text-[14px] text-ink-2">{removing?.title}</p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
