function criarData(valor: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return new Date(`${valor}T12:00:00`);
  }
  return new Date(valor);
}

export function formatarData(dataIso: string | null | undefined): string {
  if (!dataIso) return "-";
  const data = criarData(dataIso);
  if (Number.isNaN(data.getTime())) return dataIso;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(data);
}

export function formatarDataHora(dataIso: string | null | undefined): string {
  if (!dataIso) return "-";
  const data = criarData(dataIso);
  if (Number.isNaN(data.getTime())) return dataIso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(data);
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function porcentagem(valor: number): string {
  return `${valor.toFixed(0)}%`;
}
