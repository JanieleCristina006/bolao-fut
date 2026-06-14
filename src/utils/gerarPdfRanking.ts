import autoTable from "jspdf-autotable";
import type { RankingItem } from "../types";
import { criarDocumento, salvarPdf } from "./pdfBase";

export function gerarPdfRanking(ranking: RankingItem[]): void {
  const doc = criarDocumento("Ranking — Bolão Futebol Inglês");

  autoTable(doc, {
    startY: 38,
    head: [["Posição", "Participante", "Pontos", "Cravadas", "Palpites", "Aproveitamento"]],
    body: ranking.map((item) => [
      `${item.posicao}º`,
      item.participante,
      String(item.pontos),
      String(item.cravadas),
      String(item.palpites),
      `${item.aproveitamento.toFixed(0)}%`
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [217, 4, 41], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 }
  });

  salvarPdf(doc, "ranking-bolao-futebol-ingles.pdf");
}
