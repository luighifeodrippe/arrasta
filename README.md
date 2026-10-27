# Arrasta AI

Carrosséis na sua voz, com sua própria conta do ChatGPT.

O Arrasta AI abre uma parte da operação NØFACE: a produção de carrosséis. Sua estrutura foi construída com Codex; com o ChatGPT Work, você vai da instalação e da configuração da sua voz ao primeiro carrossel.

**Sem chave de API e sem cobrança de API separada.** Ao entrar com ChatGPT, o Arrasta AI usa o acesso ao Codex da sua conta. Modelos, disponibilidade e limites dependem do seu plano; não é uso ilimitado. [Como funciona o login com ChatGPT](https://learn.chatgpt.com/docs/auth).

Crie a partir de ideias, imagens e links acessíveis. Ajuste a escrita à sua voz, edite os cards e exporte para publicar. Código aberto, com licença MIT, para rodar no seu computador.

[Ver a página com o tutorial completo](https://luighi.com/noface/) · Cada função, passo a passo, com as telas do app. Para conectar sua conta e usar a IA, instale e rode o app localmente.

![Editor do Arrasta AI com o modelo Pôster](docs/editor.jpg)

## Começar com ChatGPT Work ou Codex

Copie este prompt e cole no ChatGPT Work ou no Codex do seu computador:

```text
Quero instalar o Arrasta AI no meu computador e terminar com o meu primeiro carrossel pronto. É um app gratuito e de código aberto: https://github.com/luighifeodrippe/arrasta

O guia de instalação está no próprio repositório, no arquivo AGENTS.md. Leia antes de começar e siga nesta ordem:

1. Confira se você consegue rodar comandos no meu computador. Se estiver numa tarefa na nuvem, me avise e me passe os comandos para eu rodar.
2. Baixe o repositório numa pasta de projetos. Se ele já estiver aqui, use o que existe, sem apagar nada. Confira se o Node.js é 20.9 ou mais novo; se faltar, me diga como instalar no meu sistema.
3. Na pasta do Arrasta, rode npm run setup e espere terminar. Depois rode npm start e abra http://localhost:3737 no meu navegador.
4. No app, eu clico em "Entrar com ChatGPT" e entro com a minha conta. Não me peça senha nem token aqui no chat.
5. Me pergunte o meu @ do Instagram e os @s que eu quero usar como referência de escrita. Use a importação do próprio app para analisar o que for público e configurar a minha voz. Se o Instagram não deixar ler, me peça textos meus ou prints.
6. Depois me pergunte só o que faltar: o objetivo do meu conteúdo, o meu público e o que eu gosto no visual.
7. Faça comigo o primeiro carrossel, revise os cards e exporte os PNGs.

No fim, me diga o endereço do app, o que ficou configurado e onde está o arquivo exportado.
```

O [AGENTS.md](AGENTS.md) contém as instruções para instalação, entrevista e validação. A execução automática depende de o agente ter terminal e acesso ao computador onde o app vai rodar. No ChatGPT Work, o acesso local depende do app, da conta e das permissões disponíveis; uma tarefa na nuvem não ganha acesso ao computador só porque está aberta no desktop. Sem essas ferramentas, o agente pode conduzir a entrevista e orientar a instalação manual. [Documentação oficial do ChatGPT Work](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-local-security).

**Pelo celular:** o Arrasta AI precisa de um computador (Mac, Windows ou Linux). Uma tarefa comum do celular roda na nuvem e não alcança o seu computador. Para mandar o link pelo celular, conecte antes o celular ao app do ChatGPT no computador ([Codex no celular](https://learn.chatgpt.com/docs/mobile)), deixe o computador ligado e online e escolha o computador ao criar a tarefa. Para usar o app, abra [localhost:3737](http://localhost:3737) no navegador do próprio computador; é nele também que você conclui o login com o ChatGPT.

## Instalação manual

Você precisa de cerca de **1 GB livre**, internet e acesso ao Codex pela conta do ChatGPT. Git é opcional.

### macOS

1. Abra o Spotlight com **Command + Espaço**, digite **Terminal** e pressione Enter.
2. Baixe o **Node.js LTS** em [nodejs.org](https://nodejs.org) e instale. Feche e abra o Terminal; digite `node -v` e pressione Enter. Deve aparecer uma versão 20.9 ou mais nova. Para desenvolver e rodar os testes, use Node.js 24.
3. Na [página do repositório](https://github.com/luighifeodrippe/arrasta), clique em **Code > Download ZIP**. Abra o ZIP para descompactar.
4. No Terminal, digite `cd ` (com um espaço), arraste a pasta descompactada para a janela e pressione Enter.

### Windows

1. Abra o menu **Iniciar**, digite **Prompt de Comando** e abra o programa.
2. Baixe o **Node.js LTS** em [nodejs.org](https://nodejs.org) e instale. Feche e abra o Prompt; digite `node -v` e pressione Enter. Deve aparecer uma versão 20.9 ou mais nova. Para desenvolver e rodar os testes, use Node.js 24.
3. Na [página do repositório](https://github.com/luighifeodrippe/arrasta), clique em **Code > Download ZIP**. Clique com o botão direito no ZIP e escolha **Extrair tudo**.
4. Abra a pasta extraída que contém `package.json`. Copie o caminho da barra de endereço do Explorador. No Prompt, digite `cd /d "CAMINHO"`, trocando `CAMINHO` pelo caminho copiado, e pressione Enter.

Já usa Git? Em vez do ZIP, `git clone https://github.com/luighifeodrippe/arrasta.git` e `cd arrasta`.

### Preparar e abrir (nos dois sistemas)

Na pasta que contém `package.json`, execute uma linha por vez:

```bash
npm run setup
npm start
```

O `npm run setup` prepara o app uma vez; espere terminar antes de executar `npm start`. Mantenha o terminal aberto enquanto usa o Arrasta. Para parar, pressione **Ctrl+C**. Para abrir outro dia, entre na mesma pasta com `cd` e execute `npm start` de novo.

Abra [localhost:3737](http://localhost:3737) e clique em **Entrar com ChatGPT**. A própria pessoa conclui o login oficial no navegador. Esse login usa o acesso ao Codex e os limites da sua conta do ChatGPT, sem cobrança de API separada. O login e a geração funcionam na instalação local; a demonstração pública não conecta sua conta.

Para atualizar uma instalação feita com Git, sem alterações no código:

```bash
git pull --ff-only
npm run setup
npm start
```

Se você baixou o ZIP, baixe o ZIP novo, descompacte e mova para a pasta nova a pasta `data/` da versão antiga; depois execute `npm run setup` e `npm start` na pasta nova e não use mais a antiga.

Encerre a instância anterior antes de iniciar novamente. Preserve a pasta `data/`, onde ficam seus projetos, ajustes e o login do ChatGPT.

## O que você pode fazer

- Criar de uma ideia, enviar prints ou usar um link de Instagram, YouTube, X ou artigo, quando a fonte permitir a leitura.
- Analisar seu perfil e referências de escrita pelo @, gerar guias de voz e combinar influências escolhendo o atributo e o peso de cada uma.
- Guardar links e textos em um banco local para transformar em carrosséis depois.
- Usar formatos como storytelling, dicas, passo a passo e mitos e verdades, ou escrever suas próprias instruções.
- Editar textos direto nos cards, formatar trechos, trocar fontes, cores, imagens e proporção; escolher modelos como Perfil, Editorial, Notas, Revista, Pôster e Caderno.
- Pedir alterações na conversa, em um slide ou no carrossel, e restaurar versões anteriores.
- Conferir prévias de Feed, Story, Explorar e Reels, com áreas aproximadas de enquadramento e dicas de composição.
- Baixar todos os cards ou uma seleção, em PNG ou ZIP, preservando a numeração original. O ZIP inclui a legenda.

## Instagram e referências

Informe seu @ ou o @ de uma referência de escrita. O Arrasta AI tenta buscar nome, foto, selo, contagem de seguidores e uma amostra pública: até seis legendas, limitadas a 6.000 caracteres no total, e até quatro imagens dos primeiros cards de carrosséis disponíveis. Com o ChatGPT conectado, faz uma análise breve e monta o guia de voz automaticamente. Depois você ajusta o que quer aproveitar, a influência de cada referência, seus gostos e seu objetivo.

Os resultados ficam em cache local por sete dias. Ao atualizar uma fonte, uma amostra idêntica reutiliza o guia para o mesmo modelo, evitando repetir a análise. Esses limites reduzem a entrada enviada ao modelo; não são uma promessa de quantidade fixa de tokens ou tempo de resposta.

O Instagram pode bloquear a leitura ou entregar uma amostra incompleta. O app informa o que conseguiu importar; sem acesso suficiente, você pode fornecer nome, foto, textos ou prints. Sem login do ChatGPT, os dados públicos disponíveis ainda podem ser importados, mas a análise fica pendente. O importador não usa sua senha do Instagram.

A amostra não representa todo o histórico, métricas privadas ou uma cópia perfeita do estilo. As referências ajudam a compor uma voz própria, aproveitando ritmo, humor, clareza, estrutura ou profundidade.

Use materiais que você pode reutilizar. Revise fatos, citações, marcas e imagens antes de publicar. Reescrever não transfere direitos sobre o material de origem.

## Dados e privacidade

Projetos, imagens, perfil, formatos e ajustes ficam em `data/`. O login do Arrasta AI fica em `data/codex/`; você também pode escolher usar uma conta do Codex já conectada no computador. Para mudar a pasta de dados, configure `ARRASTA_DATA_DIR` antes de iniciar o app.

O app usa o [Codex CLI oficial](https://github.com/openai/codex). Para gerar conteúdo, envia prompts, textos e imagens necessários à OpenAI; a leitura de links consulta os respectivos serviços. Rodar localmente não significa funcionar offline. O Arrasta AI não opera um servidor intermediário próprio.

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

## Se algo der errado

- **Porta 3737 ocupada:** provavelmente o Arrasta já está aberto em outra janela. Tente abrir [localhost:3737](http://localhost:3737). Se precisar de outra porta, execute `npx next start -H 127.0.0.1 -p 3738` na pasta do app e abra [localhost:3738](http://localhost:3738).
- **A preparação parou ao baixar fontes:** confira a internet e execute `npm run setup` de novo.
- **O login não volta para o app:** feche outra janela de login do Codex que esteja aberta e tente novamente.
- **“Limite de uso”:** é o limite da sua conta do ChatGPT. Aguarde a renovação indicada no serviço.
- **O Instagram bloqueou a leitura:** cole legendas na tela **Sua voz** ou envie prints.
