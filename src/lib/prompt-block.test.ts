import assert from "node:assert/strict";
import { test } from "node:test";
import { joinNumberedTitle, joinPromptBody, parsePromptBody, splitNumberedTitle } from "./prompt-block.ts";

const benefit = "Comece com a lista bagunçada mesmo.";
const prompt = "Organize estas anotações: [cole tudo aqui]. Separe tarefas, compromissos e ideias. ...";

test("separa o benefício e o prompt real com aspas retas ou tipográficas", () => {
  for (const [open, close] of [['"', '"'], ["“", "”"]]) {
    const body = `${benefit}\n\n${open}${prompt}${close}`;
    assert.deepEqual(parsePromptBody(body), { lead: benefit, prompt: { open, text: prompt, close, labeled: false }, tail: "" });
    assert.equal(joinPromptBody(parsePromptBody(body)!), body);
  }
});

test("reconhece Prompt: sem exigir colchetes, com ou sem aspas", () => {
  for (const body of ["Prompt: Resuma o texto.", 'Prompt: "Resuma o texto."', "Prompt: “Resuma o texto.”"]) {
    assert.equal(parsePromptBody(body)?.prompt.labeled, true);
    assert.equal(joinPromptBody(parsePromptBody(body)!), body);
  }
  assert.equal(parsePromptBody("pRoMpT: Faça uma lista.")?.prompt.text, "Faça uma lista.");
  assert.equal(joinPromptBody(parsePromptBody("PROMPT: Faça uma lista.")!), "Prompt: Faça uma lista.");
});

test("ignora citação sem colchetes e seleciona somente o primeiro prompt", () => {
  assert.equal(parsePromptBody('"Conhece-te a ti mesmo."'), null);
  assert.equal(parsePromptBody("“Conhece-te a ti mesmo.”"), null);
  assert.equal(parsePromptBody("Texto comum com [colchetes]"), null);
  assert.equal(parsePromptBody('"Sem fechamento [aqui]'), null);
  const body = `Uma introdução.\n\n"Uma citação."\n\n“Use [isto].”\n\nPrompt: Segundo.\n\nFim.`;
  assert.deepEqual(parsePromptBody(body), {
    lead: 'Uma introdução.\n\n"Uma citação."',
    prompt: { open: "“", text: "Use [isto].", close: "”", labeled: false },
    tail: "Prompt: Segundo.\n\nFim.",
  });
  assert.equal(joinPromptBody(parsePromptBody(body)!), body);
});

test("normaliza separadores e impede que a edição parta o bloco", () => {
  const parts = parsePromptBody(`${benefit}\n \t\n"Use [isto]."\n\nFim.`)!;
  parts.prompt.text = "Use [isto].\n\n\nDepois.\n \t\nFim.";
  assert.equal(joinPromptBody(parts), `${benefit}\n\n"Use [isto].\nDepois.\nFim."\n\nFim.`);
  assert.equal(joinPromptBody({ lead: "", prompt: { open: "", text: "Faça isto.", close: "", labeled: true }, tail: "" }), "Prompt: Faça isto.");
});

test("separa e recompõe títulos numerados preservando pontuação e destaque", () => {
  for (const [title, number, punct, rest] of [
    ["1. Tire as **pendências** da cabeça", "1", ".", "Tire as **pendências** da cabeça"],
    ["10) Faça uma lista", "10", ")", "Faça uma lista"],
  ]) {
    const parts = splitNumberedTitle(title)!;
    assert.deepEqual(parts, { number, punct, rest });
    assert.equal(joinNumberedTitle(parts, rest), title);
    assert.equal(joinNumberedTitle(parts, "Novo título"), `${number}${punct} Novo título`);
  }
  for (const title of ["Sem número", "1. ", "10) ", "100. Grande", "1.Sem espaço"]) assert.equal(splitNumberedTitle(title), null);
});
