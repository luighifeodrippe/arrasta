# Arrasta

Crie carrosséis a partir de ideias, imagens e links acessíveis. Ajuste a escrita à sua voz, edite os cards e exporte para publicar. Código aberto, com licença MIT, para rodar no seu computador.

![Editor do Arrasta com o modelo Pôster](docs/editor.jpg)

## Começar com ChatGPT Work ou Codex

Envie o link deste repositório ao seu agente com este pedido:

> Instale e abra o Arrasta para mim: https://github.com/luighifeodrippe/arrasta. Leia o AGENTS.md e siga o onboarding. Entenda meu público, meu jeito de escrever e minhas referências visuais antes de personalizar. Pergunte meu @ do Instagram e tente importar os dados públicos disponíveis; se não conseguir, me ajude a preencher. Quero terminar com um primeiro carrossel revisado e exportado.

O [AGENTS.md](AGENTS.md) contém as instruções para instalação, entrevista e validação. A execução automática depende de o agente ter terminal e acesso ao computador onde o app vai rodar. No ChatGPT Work, o acesso local depende do app, da conta e das permissões disponíveis; uma tarefa na nuvem não ganha acesso ao computador só porque está aberta no desktop. Sem essas ferramentas, o agente pode conduzir a entrevista e orientar a instalação manual. [Documentação oficial do ChatGPT Work](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-local-security).

## Instalação manual

Precisa de Git, [Node.js](https://nodejs.org) 20.9 ou mais novo e acesso ao Codex pela conta do ChatGPT. Para desenvolver e rodar os testes, use Node.js 24.

```bash
git clone https://github.com/luighifeodrippe/arrasta.git
cd arrasta
npm run setup
npm start
```

Abra [localhost:3737](http://localhost:3737) e clique em **Entrar com ChatGPT**. A própria pessoa conclui o login oficial no navegador. A disponibilidade de modelos e os limites de uso dependem da conta. O Arrasta não exige uma chave de API no fluxo padrão.

Para atualizar uma instalação sem alterações no código:

```bash
git pull --ff-only
npm run setup
npm start
```

Encerre a instância anterior antes de iniciar novamente. Preserve a pasta `data/`, onde ficam seus projetos e ajustes.

## O que você pode fazer

- Criar de uma ideia, enviar prints ou usar um link de Instagram, YouTube, X ou artigo, quando a fonte permitir a leitura.
- Ensinar sua voz com exemplos, público, assuntos e palavras a evitar; combinar referências de escrita escolhendo o atributo e o peso de cada uma.
- Guardar links e textos em um banco local para transformar em carrosséis depois.
- Usar formatos como storytelling, dicas, passo a passo e mitos e verdades, ou escrever suas próprias instruções.
- Editar textos direto nos cards, formatar trechos, trocar fontes, cores, imagens e proporção; escolher modelos como Perfil, Editorial, Notas, Revista, Pôster e Caderno.
- Pedir alterações na conversa, em um slide ou no carrossel, e restaurar versões anteriores.
- Conferir prévias de Feed, Story, Explorar e Reels, com áreas aproximadas de enquadramento e dicas de composição.
- Baixar todos os cards ou uma seleção, em PNG ou ZIP, preservando a numeração original. O ZIP inclui a legenda.

## Instagram e referências

Ao informar um @ público, o Arrasta tenta ler nome, foto, selo, contagem de seguidores e legendas expostas pela página de incorporação do Instagram. A disponibilidade varia: a página pode bloquear a leitura, retornar poucos posts ou não trazer foto e legendas. O importador não usa sua senha do Instagram.

As legendas disponíveis são uma amostra para orientar a escrita. Elas não representam uma análise de todo o perfil, acesso a métricas privadas ou uma cópia perfeita do estilo. Você pode complementar com textos próprios e exemplos de vários autores, indicando o que gosta em cada um: ritmo, humor, clareza, estrutura ou profundidade.

Use materiais que você pode reutilizar. Revise fatos, citações, marcas e imagens antes de publicar. Reescrever não transfere direitos sobre o material de origem.

## Dados e privacidade

Projetos, imagens, perfil, formatos e ajustes ficam em `data/`. O login do Arrasta fica em `data/codex/`; você também pode escolher usar uma conta do Codex já conectada no computador. Para mudar a pasta de dados, configure `ARRASTA_DATA_DIR` antes de iniciar o app.

O app usa o [Codex CLI oficial](https://github.com/openai/codex). Para gerar conteúdo, envia prompts, textos e imagens necessários à OpenAI; a leitura de links consulta os respectivos serviços. Rodar localmente não significa funcionar offline. O Arrasta não opera um servidor intermediário próprio.

As tarefas do redator usam uma pasta temporária e o modo de sandbox somente leitura do Codex. Isso restringe gravações, mas não equivale a impedir toda leitura de arquivos. Mantenha o app em `127.0.0.1`: ele foi desenvolvido para uso pessoal local e não oferece isolamento entre contas de uma instalação pública.

Não publique nem anexe `data/`, arquivos `.env`, tokens ou logs de autenticação em issues. Faça backup de seus dados em um local privado.

## Limites das fontes

- **Instagram:** apenas o que estiver acessível publicamente. Se falhar, envie prints ou cole o texto.
- **YouTube:** utiliza legendas disponíveis, não faz uma transcrição própria do áudio. Se não houver legenda acessível, forneça o roteiro.
- **X:** lê um post por vez; para textos longos, pode consultar o [FxTwitter](https://github.com/FixTweet/FxTwitter).
- **Sites:** páginas com login, bloqueios ou conteúdo carregado por JavaScript podem não entregar o texto. A busca na web pode ajudar, sem garantia de recuperar o conteúdo.
- **Prévias:** são aproximações de enquadramento. O Instagram pode mudar cortes e apresentação; confira o post no app antes de publicar.

Carrosséis podem voltar a aparecer no feed começando por outro card, como explica [Adam Mosseri, do Instagram](https://www.instagram.com/reel/DBOeUmTSmIC/). Trate cada card como uma possível entrada para a história; não há garantia de reapresentação, alcance ou distribuição de todos os slides.

## Desenvolvimento

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

Veja [como contribuir](CONTRIBUTING.md). Os componentes e pacotes de terceiros mantêm seus créditos em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Licença

[MIT](LICENSE) · Luighi Feodrippe.
