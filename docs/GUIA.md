# Instalação e uso do Arrasta AI

[Voltar para a apresentação](../README.md) · [Tutorial ilustrado](https://luighi.com/noface/#tutorial)

## Começar pelo celular

O Arrasta AI precisa de um computador (Mac, Windows ou Linux). Uma tarefa comum do celular roda na nuvem e não alcança o seu computador. Para mandar o link pelo celular, conecte antes o celular ao app do ChatGPT no computador ([Codex no celular](https://learn.chatgpt.com/docs/mobile)), deixe o computador ligado e online e escolha o computador ao criar a tarefa. Para usar o app, abra [localhost:3737](http://localhost:3737) no navegador do próprio computador; é nele também que você conclui o login com o ChatGPT.

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

## Instagram e referências

Informe seu @ ou o @ de uma referência de escrita. O Arrasta AI tenta buscar nome, foto, selo, contagem de seguidores e uma amostra pública: até seis legendas, limitadas a 6.000 caracteres no total, e até quatro imagens dos primeiros cards de carrosséis disponíveis. Com o ChatGPT conectado, faz uma análise breve e monta o guia de voz automaticamente. Depois você ajusta o que quer aproveitar, a influência de cada referência, seus gostos e seu objetivo.

Os resultados ficam em cache local por sete dias. Ao atualizar uma fonte, uma amostra idêntica reutiliza o guia para o mesmo modelo, evitando repetir a análise. Esses limites reduzem a entrada enviada ao modelo; não são uma promessa de quantidade fixa de tokens ou tempo de resposta.

O Instagram pode bloquear a leitura ou entregar uma amostra incompleta. O app informa o que conseguiu importar; sem acesso suficiente, você pode fornecer nome, foto, textos ou prints. Sem login do ChatGPT, os dados públicos disponíveis ainda podem ser importados, mas a análise fica pendente. O importador não usa sua senha do Instagram.

A amostra não representa todo o histórico, métricas privadas ou uma cópia perfeita do estilo. As referências ajudam a compor uma voz própria, aproveitando ritmo, humor, clareza, estrutura ou profundidade.

Use materiais que você pode reutilizar. Revise fatos, citações, marcas e imagens antes de publicar. Reescrever não transfere direitos sobre o material de origem.

## Banco de conteúdos

Guarde links e textos no banco local para transformar em carrosséis depois. Os itens ficam no seu computador, junto aos demais dados do app.

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

Veja [como contribuir](../CONTRIBUTING.md). Os componentes e pacotes de terceiros mantêm seus créditos em [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Se algo der errado

- **Porta 3737 ocupada:** provavelmente o Arrasta já está aberto em outra janela. Tente abrir [localhost:3737](http://localhost:3737). Se precisar de outra porta, execute `npx next start -H 127.0.0.1 -p 3738` na pasta do app e abra [localhost:3738](http://localhost:3738).
- **A preparação parou ao baixar fontes:** confira a internet e execute `npm run setup` de novo.
- **O login não volta para o app:** feche outra janela de login do Codex que esteja aberta e tente novamente.
- **“Limite de uso”:** é o limite da sua conta do ChatGPT. Aguarde a renovação indicada no serviço.
- **O Instagram bloqueou a leitura:** cole legendas na tela **Sua voz** ou envie prints.
