// Prepara o Arrasta para uso: confere o Node, instala as dependências e gera a versão de uso.
import { execSync } from "node:child_process";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  console.error(`O Arrasta precisa do Node.js 20.9 ou mais novo (este computador tem ${process.versions.node}). Instale a versão LTS em https://nodejs.org e rode de novo.`);
  process.exit(1);
}

const run = (command) => execSync(command, { stdio: "inherit" });
console.log("\n1/2 Instalando as dependências…");
run("npm install --no-audit --no-fund");
console.log("\n2/2 Preparando a versão de uso…");
run("npm run build");
console.log("\nPronto. Rode `npm start` e abra http://localhost:3737 no navegador.");
