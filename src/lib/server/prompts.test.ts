import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILTIN_FORMATS, defaultProfile, defaultWriting, emptySource, makeSlide } from "../defaults.ts";
import { COVERS_SCHEMA, EDIT_SCHEMA, METHOD_SCHEMA, READ_SCHEMA, WRITE_SCHEMA, coversPrompt, createPrompt, editPrompt, linkPrompt, readPrompt, reviewPrompt, type WriteResult } from "./prompts.ts";

const base = { profile: defaultProfile(), writing: defaultWriting({ method: false }), instructions: "" };

const editBase = {
  ...base,
  request: "Encurte o texto",
  focusIndexes: [],
  imageCount: 0,
  slides: Array.from({ length: 5 }, (_, index) => makeSlide({ id: `slide-${index}`, title: `Título ${index + 1}` })),
  caption: "Legenda atual",
  hashtags: ["atual"],
};

test("a edição expressa o foco no carrossel, em um slide ou em vários, com a lista em português", () => {
  for (const [focusIndexes, expected] of [
    [[], "O pedido vale para o carrossel todo."],
    [[1], "Mude só o slide 2; os outros ficam exatamente iguais."],
    [[1, 3], "Mude só os slides 2 e 4; os outros ficam exatamente iguais."],
    [[1, 3, 4], "Mude só os slides 2, 4 e 5; os outros ficam exatamente iguais."],
  ] as const) {
    const prompt = editPrompt({ ...editBase, focusIndexes: [...focusIndexes] });
    assert.ok(prompt.includes(expected), expected);
    assert.ok(prompt.includes('Pedido: """Encurte o texto"""'));
    const current = JSON.parse(prompt.split("Carrossel atual (JSON):\n")[1].split("\n")[0]);
    assert.deepEqual(current.slides.map((slide: { id: string }) => slide.id), editBase.slides.map((slide) => slide.id));
    assert.equal(current.caption, editBase.caption);
    assert.deepEqual(current.hashtags, editBase.hashtags);
  }
});

test("as imagens da edição são numeradas pela ordem de envio, sem inventar texto sobre elas", () => {
  for (const imageCount of [1, 3, 8]) {
    const prompt = editPrompt({ ...editBase, focusIndexes: [1, 3], imageCount });
    assert.ok(prompt.includes(`A pessoa anexou ${imageCount} ${imageCount === 1 ? "imagem," : "imagens,"}`));
    assert.ok(prompt.includes(`que chegam na ordem ${Array.from({ length: imageCount }, (_, index) => `"imagem ${index + 1}"`).join(", ")}`));
    for (const text of [
      "Coloque cada uma no slide em que faz mais sentido, dentro dos slides em foco",
      `usando o campo image com o número da imagem (de 1 a ${imageCount}) ou null para manter a imagem atual`,
      "Uma imagem não usada simplesmente não aparece.",
      "Não descreva nem invente o que há nas imagens no texto dos slides, a menos que o pedido peça.",
    ]) assert.ok(prompt.includes(text), text);
  }
  const allSlides = editPrompt({ ...editBase, imageCount: 2 });
  assert.ok(allSlides.includes("Coloque cada uma no slide em que faz mais sentido, usando o campo image"));
  assert.ok(!allSlides.includes("dentro dos slides em foco"));
});

test("pedido vazio com imagens só distribui as imagens e preserva o texto", () => {
  for (const request of ["", " \n\t"]) {
    const prompt = editPrompt({ ...editBase, request, imageCount: 2 });
    assert.ok(prompt.includes('Pedido: """Coloque as imagens anexadas nos slides em que fazem mais sentido, sem mudar o texto."""'));
  }
  assert.ok(editPrompt({ ...editBase, imageCount: 2 }).includes('Pedido: """Encurte o texto"""'));
});

test("edição sem anexos exige image null e mantém o limite de texto do pedido", () => {
  const prompt = editPrompt({ ...editBase, request: "a".repeat(2000) + "NÃO INCLUIR" });
  assert.ok(prompt.includes("Sem imagens anexadas, devolva sempre null no campo image de todos os slides."));
  assert.ok(!prompt.includes("A pessoa anexou"));
  assert.ok(prompt.includes(`Pedido: """${"a".repeat(2000)}"""`));
  assert.ok(!prompt.includes("NÃO INCLUIR"));
});

test("o schema estrito da edição exige image inteiro ou null em cada slide", () => {
  const slide = EDIT_SCHEMA.properties.slides.items;
  assert.deepEqual(slide.properties.image.type, ["integer", "null"]);
  assert.deepEqual(slide.required, Object.keys(slide.properties));
  assert.equal(slide.additionalProperties, false);
  assert.deepEqual(EDIT_SCHEMA.required, Object.keys(EDIT_SCHEMA.properties));
  assert.equal(EDIT_SCHEMA.additionalProperties, false);
});

const plan = { carouselType: "Case/Benchmark", transformation: "", friction: "", angle: "", evidence: [], axis: "Mercado", funnel: "Topo", headlines: [], chosen: 1, spine: { hook: "", mechanism: "", proof: [], application: "", direction: "" } };

const reviewResult: WriteResult = {
  title: "Planejar a semana",
  analysis: { hook: "Três prioridades", structure: "Lista", why: "Exemplos concretos" },
  slides: [{ kind: "cover", tag: "", title: "Separe três prioridades", body: "Reserve 30 minutos", imageIdea: "", sourceImage: 2 }],
  caption: "Como você planeja a semana?",
  hashtags: ["planejamento"],
};

test("o revisor recebe regras, perfil, fatos e o carrossel, sem o rascunho", () => {
  const prompt = reviewPrompt({
    profile: { ...base.profile, name: "Ana", voice: "Frases diretas" },
    writing: defaultWriting({ instructions: "Regra personalizada", avoid: "incrível" }),
    source: "Ana separa três prioridades e reserva 30 minutos na segunda-feira.",
    result: { ...reviewResult, plan: { ...plan, evidence: [{ fact: "A Hoka cresceu", source: "Exame, 2025" }, { fact: "Ana separa", source: "conteúdo" }] } },
  });
  assert.ok(prompt.startsWith("Regra personalizada"));
  assert.ok(prompt.includes("Anti-AI Slop"));
  assert.ok(prompt.indexOf("PERFIL DE QUEM VAI PUBLICAR") < prompt.indexOf("TAREFA:"));
  for (const text of ["Nome: Ana", "Frases diretas", "Nunca use estas palavras ou expressões: incrível", "Ana separa três prioridades e reserva 30 minutos na segunda-feira.", "A Hoka cresceu (Exame, 2025)", JSON.stringify(reviewResult)]) {
    assert.ok(prompt.includes(text), text);
  }
  assert.ok(!prompt.includes("Ana separa (conteúdo)"));
  assert.ok(!prompt.includes('"plan"'));
  for (const name of ["Gramática", "Fluidez", "AI Slop", "Fatos Verificados", "Estrutura", "Densidade", "Tom Editorial"]) assert.ok(prompt.includes(`Parâmetro`) && prompt.includes(name), name);
  assert.ok(prompt.includes("palavra por palavra"));
  assert.ok(prompt.includes("Em sourceImage, mantenha o valor de cada slide."));
});

test("o revisor limita a fonte a 14.000 caracteres", () => {
  const source = "a".repeat(14000);
  const prompt = reviewPrompt({ ...base, source: source + "NÃO INCLUIR", result: reviewResult });
  assert.ok(prompt.includes(source));
  assert.ok(!prompt.includes("NÃO INCLUIR"));
});

test("o método entra por ajuste ou por formato, e a busca só quando pedida", () => {
  const brief = { ...base, brief: "Organizar tarefas" };
  const plain = createPrompt(brief);
  assert.ok(!plain.includes("=== MÉTODO ==="));
  assert.ok(!plain.includes("Anti-AI Slop"));
  const on = createPrompt({ ...brief, writing: defaultWriting({ method: true }) });
  for (const part of ["=== MÉTODO ===", "=== BANCO DE HEADLINES ===", "=== MANUAL DE QUALIDADE ===", "=== PRINCÍPIOS DE DESIGN ===", "=== REFERÊNCIAS ===", "=== BOAS PRÁTICAS ===", "Anti-AI Slop"]) assert.ok(on.includes(part), part);
  assert.ok(!on.includes("use a busca na web"));
  assert.ok(createPrompt({ ...brief, writing: defaultWriting({ method: true }), search: true }).includes("use a busca na web"));
  for (const id of ["tendencia", "contra", "caso", "futuro"]) {
    const format = BUILTIN_FORMATS.find((item) => item.id === id);
    assert.equal(format?.method, true);
    assert.ok(createPrompt({ ...brief, format }).includes("=== MÉTODO ==="));
    assert.ok(linkPrompt({ ...base, source: emptySource("web"), level: "pouco", format }).includes("=== MÉTODO ==="));
  }
  assert.ok(METHOD_SCHEMA.required.includes("plan"));
  assert.ok(!(WRITE_SCHEMA.required as readonly string[]).includes("plan"));
});

test("nada do método depende do ambiente de uma conversa", () => {
  const all = createPrompt({ ...base, brief: "x", writing: defaultWriting({ method: true }), search: true }) + coversPrompt({ ...base, slides: [], method: true }) + reviewPrompt({ ...base, source: "x", result: reviewResult });
  for (const word of [/present_files/, /\/home\//, /playwright/i]) assert.ok(!word.test(all), String(word));
});

test("no método, as capas usam os dez ângulos editoriais", () => {
  const prompt = coversPrompt({ ...base, slides: [{ title: "Capa", body: "" }], method: true });
  for (const angle of ["Reenquadramento", "Conflito oculto", "Implicação sistêmica", "Mecanismo social", "ENGINE DE HEADLINES", "Banco dos 56 Hooks"]) assert.ok(prompt.includes(angle), angle);
  assert.ok(!prompt.includes("Promessa: número e resultado concreto."));
  assert.ok(prompt.includes('"title": "Capa"'));
});

test("schemas e instruções incluem os novos cards e o modelo Manchete", () => {
  for (const kind of ["stat", "table"] as const) {
    assert.ok(WRITE_SCHEMA.properties.slides.items.properties.kind.enum.includes(kind));
    assert.ok(EDIT_SCHEMA.properties.slides.items.properties.kind.enum.includes(kind));
  }
  const prompt = createPrompt({ ...base, brief: "Comparar os dados fornecidos", format: null });
  assert.ok(prompt.includes("Use stat e table só com dados que estão no conteúdo; nunca invente número."));
  assert.ok(prompt.includes("title é só o número"));
  assert.ok(prompt.includes("a primeira linha é o cabeçalho"));
  assert.ok(READ_SCHEMA.properties.style.properties.template.enum.includes("manchete"));
  assert.ok(readPrompt({ slideCount: 5, caption: "" }).includes("manchete (títulos enormes em caixa alta, cards alternando claro e escuro)"));
});

test("os formatos de prompts e de ferramentas vêm depois de mitos e passam seu texto para criação e links", () => {
  assert.deepEqual(BUILTIN_FORMATS.map((format) => format.id), ["storytelling", "lista", "passo-a-passo", "mitos", "prompts", "ferramentas", "tendencia", "contra", "caso", "futuro"]);
  for (const format of BUILTIN_FORMATS.slice(4, 6)) {
    assert.equal(format.origin, "builtin");
    assert.equal(format.createdAt, "2026-10-27T00:00:00.000Z");
    const created = createPrompt({ ...base, brief: "Organizar tarefas", format });
    const linked = linkPrompt({ ...base, source: emptySource("web"), level: "pouco", format });
    for (const prompt of [created, linked]) {
      assert.ok(prompt.includes(`FORMATO ESCOLHIDO: "${format.name}"`));
      assert.ok(prompt.includes(format.prompt));
    }
    assert.ok(!created.includes("Estrutura que funciona:"));
  }
});


test("as capas incluem os 10 ângulos na ordem, o perfil, as regras e os textos atuais", () => {
  const profile = { ...defaultProfile(), name: "Ana", handle: "ana", voice: "Direta, com exemplos", audience: "Pessoas criadoras" };
  const slides = [{ title: "Planejar a semana", body: "Separe três prioridades" }, { title: "Reserve tempo", body: "Use blocos de 30 minutos" }];
  const prompt = coversPrompt({ profile, writing: defaultWriting({ method: false, instructions: "Minha regra de escrita", avoid: "revolucionário" }), slides });
  assert.ok(prompt.startsWith("Minha regra de escrita"));
  for (const text of ["Nome: Ana", "@: @ana", profile.voice, profile.audience, "Nunca use estas palavras ou expressões: revolucionário", JSON.stringify(slides, null, 2)]) {
    assert.ok(prompt.includes(text), text);
  }
  const angles = ["Promessa", "Autoridade", "Erro", "Contraste", "Pergunta", "Dado", "Antes e agora", "Bastidor", "Alerta", "Caso"];
  let previous = -1;
  for (const [index, angle] of angles.entries()) {
    const position = prompt.indexOf(`${index + 1}. ${angle}:`);
    assert.ok(position > previous, angle);
    previous = position;
  }
  assert.ok(prompt.includes("title: até 12 palavras"));
  assert.ok(prompt.includes("body: até 15 palavras"));
  assert.ok(prompt.includes("Não invente número, nome nem dado"));
});

test("o schema das capas exige 10 opções com ângulo, título e texto", () => {
  assert.deepEqual(COVERS_SCHEMA.required, ["covers"]);
  const covers = COVERS_SCHEMA.properties.covers;
  assert.equal(covers.minItems, 10);
  assert.equal(covers.maxItems, 10);
  assert.deepEqual(covers.items.required, ["angle", "title", "body"]);
  for (const property of Object.values(covers.items.properties)) assert.equal(property.type, "string");
  assert.equal(covers.items.additionalProperties, false);
  assert.equal(COVERS_SCHEMA.additionalProperties, false);
});

test("os quatro formatos novos vêm após ferramentas e chegam aos prompts sem alteração", () => {
  const formats = BUILTIN_FORMATS.slice(6);
  assert.deepEqual(formats.map(({ id, name }) => ({ id, name })), [
    { id: "tendencia", name: "Tendência" },
    { id: "contra", name: "Tese contraintuitiva" },
    { id: "caso", name: "Case" },
    { id: "futuro", name: "Previsão" },
  ]);
  for (const format of formats) {
    assert.equal(format.origin, "builtin");
    assert.equal(format.createdAt, "2026-11-02T00:00:00.000Z");
    assert.ok(createPrompt({ ...base, brief: "Planejamento", format }).includes(format.prompt));
    assert.ok(linkPrompt({ ...base, source: emptySource("web"), level: "pouco", format }).includes(format.prompt));
  }
});
