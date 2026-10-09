const button = document.getElementById("copy-prompt");
const prompt = document.getElementById("install-prompt");
const status = document.getElementById("copy-status");

button.addEventListener("click", async () => {
  let copied = false;
  try {
    await navigator.clipboard.writeText(prompt.value);
    copied = true;
  } catch {
    // Browsers without clipboard permission can still copy a selected field.
    prompt.focus({ preventScroll: true });
    prompt.select();
    prompt.setSelectionRange(0, prompt.value.length);
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
  }
  if (copied) {
    button.textContent = "Copiado";
    status.textContent = "Pedido copiado. Cole no ChatGPT Work ou no Codex.";
    button.focus({ preventScroll: true });
  } else {
    button.textContent = "Copiar pedido";
    status.textContent = "Pedido selecionado. Use Copiar no menu do navegador ou Ctrl/Cmd+C.";
  }
});
