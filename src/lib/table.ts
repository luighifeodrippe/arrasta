/** Cabeçalho e linhas, com 2 ou 3 colunas. Entradas fora do formato continuam como texto. */
export function parseTable(body: string): string[][] | null {
  const lines = body.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2 || lines.length > 6) return null;
  const rows = lines.map((line) => line.split("|").map((cell) => cell.trim()));
  const columns = rows[0].length;
  if (columns < 2 || columns > 3 || rows.some((row) => row.length !== columns)) return null;
  return rows;
}
