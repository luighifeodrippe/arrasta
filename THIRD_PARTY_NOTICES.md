# Avisos de terceiros

O Arrasta usa código e ideias destes projetos. Os pacotes do npm trazem a própria licença em `node_modules`; abaixo estão os trechos copiados ou adaptados para dentro de `src/`.

## Letras da página pública (`preview/`)

Inter (Rasmus Andersson) e Kalam (Indian Type Foundry), em `preview/assets/fontes/`, sob a SIL Open Font License 1.1. Os avisos de copyright e o texto da licença estão em `preview/assets/fontes/OFL.txt`.

## Código copiado ou adaptado

### Magic UI — Marquee
`src/components/ui/marquee.tsx` · https://magicui.design/docs/components/marquee

MIT License · Copyright (c) Magic UI

### uselayouts — Polaroid Stack
O leque dos cards em `src/components/home/Home.tsx` (ideia do Polaroid Stack) · https://uselayouts.com

MIT License · Copyright (c) 2025 Urvish Mali

### Beautiful UI — Thinking (Steps) e texto com brilho
`src/components/editor/AgentSteps.tsx` e `.arrasta-shimmer-text` em `src/app/globals.css` · https://www.beautifului.dev

MIT License · Copyright (c) 2026 Shane Levine

Texto da licença MIT, válido para os três:

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Pacotes usados como dependência

| Pacote | Licença | Para quê |
| --- | --- | --- |
| `@openai/codex` | Apache-2.0 | Login com o ChatGPT e execução das tarefas |
| `@hugeicons/react`, `@hugeicons/core-free-icons` | MIT | Ícones do app (os mesmos dos componentes da uselayouts) |
| `border-beam`, `thinking-orbs` (libraries.dev, Jakub Antalik) | MIT | Brilho na borda e orbes de "pensando" |
| `ascii.rest` (bas3line) | MIT | Arte em ascii do estado vazio |
| `@mozilla/readability` | Apache-2.0 | Texto de artigos e páginas |
| `linkedom` | ISC | HTML no servidor para a leitura de páginas |
| `modern-screenshot` | MIT | PNG dos slides |
| `jszip` | MIT ou GPL-3.0 (usado sob MIT) | Arquivo .zip da exportação |
| `canvas-confetti` | ISC | Confete do primeiro carrossel |
| `yaml` | ISC | Leitura de formatos legados em YAML |

## Fontes

Inter, Montserrat, Poppins, Bricolage Grotesque, Space Grotesk, Instrument Serif, Playfair Display, DM Serif Display, Anton e Caveat, do Google Fonts, sob a SIL Open Font License 1.1. O `next/font` baixa e serve as fontes junto do app.

## Serviços

- Posts do X: o widget oficial de incorporação (`cdn.syndication.twimg.com`) e, para o texto completo de posts longos, o [FxTwitter](https://github.com/FixTweet/FxTwitter).
- Posts do Instagram: a página pública de incorporação (`/embed`).
- Vídeos do YouTube: a página pública do vídeo e a interface do player usada pelo app (`youtubei/v1/player`), para as legendas.
