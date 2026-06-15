export function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`´^~]/g, "")
    .replace(/[-–—_/.,;:()[\]{}!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizarChave(valor: unknown): string {
  return normalizarTexto(valor).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function nomesEquivalentes(a: unknown, b: unknown): boolean {
  return normalizarChave(a) === normalizarChave(b);
}

export function limparEspacos(valor: unknown): string {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

export function dataCurtaDeIso(dataIso: string | null | undefined): string | null {
  if (!dataIso) return null;
  const match = String(dataIso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[3]}/${match[2]}`;
}
