export type SlideKind = "cover" | "content" | "list" | "quote" | "cta";
export type TemplateId = "perfil" | "editorial" | "foto" | "minimal" | "neon" | "notas" | "revista" | "poster" | "caderno";
export type FontId = "inter" | "montserrat" | "poppins" | "bricolage" | "space" | "instrument" | "playfair" | "dmserif" | "anton" | "caveat";
export type TextAlign = "left" | "center" | "right" | "justify";
/** Proporção do slide: 3:4 (1080×1440) aparece inteiro na grade do perfil; 4:5 (1080×1350) é o retrato clássico. */
export type SlideSize = "3:4" | "4:5";

export interface SlideImage {
  src: string;
  fit: "cover" | "contain";
  /** Ponto da imagem que fica visível, de 0 a 100 em cada eixo. */
  focusX: number;
  focusY: number;
  zoom: number;
  /** "inline" fica junto do texto; "background" cobre o slide inteiro. */
  mode: "inline" | "background";
}

/** Ajustes de um campo de texto (título ou texto). null segue o padrão do carrossel ou do modelo. */
export interface TextStyle {
  color: string | null;
  align: TextAlign | null;
  /** Tamanho relativo ao do modelo (1 = padrão). */
  size: number | null;
  /** Altura da linha relativa à do modelo (1 = padrão). */
  leading: number | null;
  /** Espaço entre letras somado ao do modelo, em em. */
  tracking: number | null;
}

export type BlockId = "identity" | "title" | "body" | "image";

export interface Slide {
  id: string;
  kind: SlideKind;
  title: string;
  body: string;
  image: SlideImage | null;
  /** Cor de fundo só deste slide. */
  background: string | null;
  /** Posição vertical do texto; null segue o modelo. */
  valign: "top" | "center" | "bottom" | null;
  /** Ajustes só deste slide, por campo; o que ficar null segue o design. */
  titleStyle: TextStyle;
  bodyStyle: TextStyle;
  /** Espaço entre os blocos (foto e @, título, texto, imagem), relativo ao do modelo; null segue o design. */
  gap: number | null;
  /** Deslocamento em pixels a partir do layout automático. */
  offsets: Partial<Record<BlockId, { x: number; y: number }>>;
}

export interface Design {
  template: TemplateId;
  theme: "light" | "dark";
  font: FontId;
  accent: string;
  /** Cor de fundo de todos os slides; null usa a do tema. */
  background: string | null;
  textScale: number;
  align: TextAlign;
  size: SlideSize;
  /** Fonte só do título ou só do texto; null usa a fonte do carrossel. */
  titleFont: FontId | null;
  bodyFont: FontId | null;
  /** Ajustes de texto que valem para todos os slides. */
  titleStyle: TextStyle;
  bodyStyle: TextStyle;
  gap: number;
  showProfile: boolean;
  showCounter: boolean;
  showSwipe: boolean;
}

export interface SourceSlide {
  src: string;
  text: string;
  isVideo: boolean;
}

export interface SourceAuthor {
  username: string;
  fullName: string | null;
  avatar: string | null;
  verified: boolean;
}

export type SourceKind = "instagram" | "upload" | "idea" | "web" | "x" | "youtube";

export interface DetectedStyle {
  template: TemplateId;
  theme: "light" | "dark";
  accent: string;
  font: FontId;
}

export interface CarouselSource {
  kind: SourceKind;
  url: string | null;
  author: SourceAuthor | null;
  caption: string;
  slides: SourceSlide[];
  likes: number | null;
  comments: number | null;
  brief: string | null;
  analysis: { hook: string; structure: string; why: string } | null;
  /** Título da página ou do post (links de site e do X). */
  title: string | null;
  /** Texto extraído de um site ou post do X. */
  text: string | null;
  site: string | null;
  /** Imagens do link (capa do artigo, fotos do post) que podem entrar nos slides. */
  media: string[];
  /** Estilo visual que o ChatGPT reconheceu no original. */
  style: DetectedStyle | null;
  /** Duração do vídeo do YouTube, em segundos. */
  duration: number | null;
  /** Formato (clone) escolhido para escrever, se houver. */
  formatId: string | null;
}

/** Um formato de carrossel que já funcionou: estrutura, exemplos e tom (ex.: um clone importado do Dify). */
export interface CarouselFormat {
  id: string;
  name: string;
  description: string;
  prompt: string;
  origin: "dify" | "manual" | "builtin";
  createdAt: string;
}

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  task: "remix" | "create" | "edit";
  /** Slide em foco no pedido (índice), ou null para o carrossel todo. */
  scope: number | null;
  /** Slides que a resposta alterou. */
  changed: string[];
  /** Como o carrossel estava antes da resposta, para restaurar. */
  before: { slides: Slide[]; caption: string; hashtags: string[] } | null;
  seconds: number | null;
  failed: boolean;
}

export interface Project {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  source: CarouselSource | null;
  slides: Slide[];
  design: Design;
  caption: string;
  hashtags: string[];
  chat: ChatEntry[];
  /** Imagens enviadas para este carrossel, para reusar em qualquer slide. */
  images: string[];
}

export interface StyleReference {
  id: string;
  name: string;
  /** Características para aproveitar, como ritmo, humor ou tipo de gancho. */
  focus: string;
  samples: string;
  /** Influência relativa de 1 a 5; só vale quando há textos de exemplo. */
  weight: number;
  /** Perfil público que forneceu a amostra; vazio em referências manuais antigas. */
  handle?: string;
  avatar?: string | null;
  guide?: string;
  analyzedAt?: string | null;
  sampleCount?: number;
  imageCount?: number;
}

export interface InstagramAnalysis {
  status: "ready" | "needs_login" | "unavailable";
  guide: string;
  about: string;
  audience: string;
  analyzedAt: string | null;
  reused: boolean;
  sampleCount: number;
  imageCount: number;
  sourceUrls: string[];
  message: string;
}

export interface InstagramImportResult {
  handle: string;
  name: string;
  avatar: string | null;
  verified: boolean;
  followers: number | null;
  samples: string;
  imported: { name: boolean; avatar: boolean; captions: number };
  analysis: InstagramAnalysis;
  notice: string;
}

export interface Profile {
  name: string;
  handle: string;
  avatar: string | null;
  verified: boolean;
  about: string;
  audience: string;
  voice: string;
  samples: string;
  cta: string;
  followers: number | null;
  goal?: string;
  preferences?: string;
  styleReferences?: StyleReference[];
  voiceAnalysis?: {
    handle: string;
    analyzedAt: string;
    sampleCount: number;
    imageCount: number;
    sourceUrls: string[];
  };
}

/** Quanto a recriação muda o original. */
export type RemixLevel = "manter" | "pouco" | "medio" | "muito";
export type Effort = "low" | "medium" | "high";

/** Como o ChatGPT escreve: as instruções (o "system prompt" do redator) e ajustes de formato. */
export interface WritingSettings {
  /** Instruções do redator. Vazio usa as instruções padrão do Arrasta. */
  instructions: string;
  language: "pt-BR" | "en" | "es";
  /** Quanto texto cabe em cada slide. */
  length: "curto" | "medio" | "longo";
  emojis: "nunca" | "poucos" | "livre";
  /** Quantos slides, quando o formato não define. */
  slides: "poucos" | "medio" | "muitos";
  /** Palavras e expressões que nunca devem aparecer. */
  avoid: string;
}

export interface Settings {
  /** "app" usa um login só do Arrasta; "system" reaproveita o login do Codex deste computador. */
  codexHome: "app" | "system";
  model: string | null;
  effort: Effort;
  writing: WritingSettings;
}

export interface AuthStatus {
  connected: boolean;
  mode: Settings["codexHome"];
  email: string | null;
  name: string | null;
  plan: string | null;
  method: "chatgpt" | "apikey" | null;
  loginPending: boolean;
  loginUrl: string | null;
  loginError: string | null;
  system: { email: string | null; plan: string | null } | null;
}

export interface ModelOption {
  slug: string;
  name: string;
}

/** Eventos que o servidor manda enquanto o ChatGPT trabalha. */
export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "thought"; text: string }
  | { type: "project"; project: Project }
  | { type: "done"; project?: Project; data?: unknown; summary?: string }
  | { type: "error"; message: string; needsLogin?: boolean };
