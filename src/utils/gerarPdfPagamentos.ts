import autoTable from "jspdf-autotable";
import { PIX_INFO } from "../constants";
import type { Pagamento } from "../types";
import { formatarData, formatarMoeda } from "./formatadores";
import { criarDocumento, salvarPdf } from "./pdfBase";

export function gerarPdfPagamentos(pagamentos: Pagamento[]): void {
  const doc = criarDocumento("Pagamentos");
  doc.setFontSize(10);
  doc.text(PIX_INFO.texto, 14, 39);

  autoTable(doc, {
    startY: 46,
    head: [["Participante", "Situação", "Data", "Valor"]],
    body: pagamentos.map((pagamento) => [
      pagamento.participante,
      pagamento.situacao === "pago" ? "Pago" : "Pendente",
      formatarData(pagamento.dataPagamento),
      formatarMoeda(pagamento.valor)
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [217, 4, 41], textColor: 255 },
    margin: { left: 14, right: 14 }
  });

  salvarPdf(doc, "pagamentos-bolao.pdf");
}
