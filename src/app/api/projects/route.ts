import { emptySource, makeSlide, MAX_SLIDES } from "@/lib/defaults";
import { downloadImage, fetchPost, InstagramError } from "@/lib/server/instagram";
import { extFor, listProjects, newProject, saveAsset, saveProject } from "@/lib/server/storage";
import { detectLink, fetchArticle, fetchTweet, fetchYouTube, LinkError } from "@/lib/server/web";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

const BROWSER_UA =
  "OpenAI File Downloader, XaiImageApiFetch/1.0";

export async function GET() {
  return Response.json(await listProjects());
}

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) return Response.json(await fromUpload(await request.formData()));
    const body = (await request.json()) as { kind?: string; url?: string; brief?: string; formatId?: string | null };
    const formatId = typeof body.formatId === "string" && body.formatId ? body.formatId : null;
    if (body.kind === "link" || body.kind === "instagram") return Response.json(await fromLink(body.url ?? "", formatId));
    if (body.kind === "idea") {
      const brief = (body.brief ?? "").trim();
      if (!brief) return Response.json({ error: "Escreva sobre o que é o carrossel." }, { status: 400 });
      const project = newProject({ title: brief.slice(0, 60), source: { ...emptySource("idea"), brief, formatId } });
      return Response.json(await saveProject(project));
    }
    const project = newProject({
      slides: [makeSlide({ kind: "cover", title: "Escreva aqui o **gancho** do seu carrossel", body: "Arraste para o lado →" })],
    });
    return Response.json(await saveProject(project));
  } catch (error) {
    const known = error instanceof InstagramError || error instanceof LinkError || error instanceof UploadError;
    if (!known) console.error(error);
    return Response.json({ error: known ? (error as Error).message : "Não consegui criar o projeto." }, { status: 400 });
  }
}

class UploadError extends Error {}

/** Baixa uma imagem para o projeto; se falhar, segue sem ela. */
async function keepImage(scope: string, name: string, url: string | null, userAgent?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const image = await downloadImage(url, userAgent);
    return await saveAsset(scope, `${name}.${extFor(image.type)}`, image.data);
  } catch {
    return null;
  }
}

async function fromLink(input: string, formatId: string | null): Promise<Project> {
  const link = detectLink(input);
  if (!link) throw new LinkError("Cole um link válido: post do Instagram, vídeo do YouTube, post do X ou uma página da web.");
  if (link.kind === "instagram") return fromInstagram(link.url.toString());

  const content =
    link.kind === "x" ? await fetchTweet(link.url) : link.kind === "youtube" ? await fetchYouTube(link.url) : await fetchArticle(link.url);
  const project = newProject({
    title:
      link.kind === "youtube"
        ? (content.title ?? "Vídeo do YouTube").slice(0, 80)
        : content.author
          ? `Recriação de @${content.author.username}`
          : (content.title ?? "Recriação").slice(0, 80),
  });
  const ua = link.kind === "web" ? BROWSER_UA : undefined;
  const [avatar, ...media] = await Promise.all([
    keepImage(project.id, "author", content.author?.avatarUrl ?? null),
    ...content.images.map((src, i) => keepImage(project.id, `media-${i + 1}`, src, ua)),
  ]);
  project.source = {
    ...emptySource(link.kind),
    url: content.url,
    title: content.title,
    text: content.text,
    site: content.site,
    media: media.filter((m): m is string => Boolean(m)),
    likes: content.likes,
    comments: content.comments,
    duration: content.duration ?? null,
    formatId,
    author: content.author
      ? { username: content.author.username, fullName: content.author.fullName, avatar, verified: content.author.verified }
      : null,
  };
  return saveProject(project);
}

async function fromInstagram(url: string): Promise<Project> {
  const post = await fetchPost(url);
  if (!post.media.length) throw new InstagramError("Esse post não tem imagens que eu consiga ler.");
  const project = newProject({ title: post.author ? `Recriação de @${post.author.username}` : "Recriação" });

  const slides = await Promise.all(
    post.media.slice(0, MAX_SLIDES).map(async (media, index) => {
      const image = await downloadImage(media.url);
      const src = await saveAsset(project.id, `src-${index + 1}.${extFor(image.type)}`, image.data);
      return { src, text: "", isVideo: media.isVideo };
    }),
  );
  const avatar = await keepImage(project.id, "author", post.author?.avatarUrl ?? null);

  project.source = {
    ...emptySource("instagram"),
    url: post.url,
    author: post.author
      ? { username: post.author.username, fullName: post.author.fullName, avatar, verified: post.author.verified }
      : null,
    caption: post.caption,
    slides,
    likes: post.likes,
    comments: post.comments,
  };
  return saveProject(project);
}

async function fromUpload(form: FormData): Promise<Project> {
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.type.startsWith("image/"));
  if (!files.length) throw new UploadError("Envie as imagens dos slides (JPG, PNG ou WebP).");
  const project = newProject({ title: "Recriação de prints" });
  const slides = [];
  for (const [index, file] of files.slice(0, MAX_SLIDES).entries()) {
    const src = await saveAsset(project.id, `src-${index + 1}.${extFor(file.type)}`, Buffer.from(await file.arrayBuffer()));
    slides.push({ src, text: "", isVideo: false });
  }
  project.source = { ...emptySource("upload"), caption: String(form.get("caption") ?? ""), slides };
  return saveProject(project);
}
