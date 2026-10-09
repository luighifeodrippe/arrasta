# Contribuir

Use Node.js 24 e instale com `npm ci`. `npm run dev` abre o servidor local em [localhost:3737](http://localhost:3737).

Antes de enviar uma mudança, rode `npm test`, `npm run typecheck` e `npm run build`. Para interface e exportação, confira também o resultado renderizado e os PNGs afetados. Explique no pull request o problema, o comportamento final e a validação realizada.

Ao relatar um erro, inclua os passos para reproduzir, o resultado esperado, o observado, o sistema e a versão do Node. Use conteúdo de exemplo em capturas e anexos; remova dados pessoais. Nunca envie `data/`, `.env`, tokens ou logs de login.

Mudanças na importação de perfis devem preservar o tratamento de fontes bloqueadas, os limites de amostra e a reutilização do guia em cache. Testes automáticos usam dados de exemplo, sem consumir a conta do ChatGPT.

Mudanças em dados salvos devem preservar projetos existentes. Mantenha o uso local por padrão e os créditos das dependências. Contribuições seguem a [licença MIT](LICENSE) do projeto.
