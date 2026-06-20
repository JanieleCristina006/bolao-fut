import autoTable from "jspdf-autotable";
import type { DashboardData } from "../types";
import { formatarMoeda } from "./formatadores";
import { criarDocumento, salvarPdf } from "./pdfBase";

export function gerarPdfRelatorioGeral(data: DashboardData): void {
  const doc = criarDocumento("Relatório geral");

  autoTable(doc, {
    startY: 38,
    head: [["Indicador", "Valor"]],
    body: [
      ["Participantes", String(data.resumo.totalParticipantes)],
      ["Jogos finalizados", String(data.resumo.jogosFinalizados)],
      ["Jogos pendentes", String(data.resumo.jogosPendentes)],
      ["Cravadas", String(data.resumo.totalCravadas)],
      ["Pagamentos confirmados", String(data.resumo.pagamentosConfirmados)],
      ["Participantes isentos", String(data.resumo.pagamentosIsentos ?? 0)],
      ["Valor arrecadado", formatarMoeda(data.resumo.valorArrecadado)]
    ],
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [217, 4, 41], textColor: 255 },
    margin: { left: 14, right: 14 }
  });

  salvarPdf(doc, "relatorio-geral-bolao.pdf");
}
