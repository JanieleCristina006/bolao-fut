import type { PagamentoSituacao } from "../types";
import { normalizarTexto } from "./formatadores";

export function normalizarSituacaoPagamento(valor: unknown, pago = false): PagamentoSituacao {
  const texto = normalizarTexto(String(valor ?? ""));
  if (["isento", "isenta", "dispensado", "dispensada"].includes(texto)) return "isento";
  if (pago || ["sim", "s", "pago", "feito", "ok", "true", "1"].includes(texto)) return "pago";
  return "pendente";
}

export function rotuloSituacaoPagamento(situacao: PagamentoSituacao): string {
  if (situacao === "pago") return "Pago";
  if (situacao === "isento") return "Isento";
  return "Pendente";
}

export function respostaPix(situacao: PagamentoSituacao): string {
  if (situacao === "pago") return "Sim";
  if (situacao === "isento") return "Isento";
  return "Não";
}
