import autoTable from "jspdf-autotable";
import type { Jogo, ParticipanteDetalhe } from "../types";
import { formatarData, porcentagem } from "./formatadores";
import { criarDocumento, salvarPdf } from "./pdfBase";

export function gerarPdfParticipante(participante: ParticipanteDetalhe, jogos: Jogo[]): void {
  const doc = criarDocumento(`Relatório individual - ${participante.nome}`);
  doc.setFontSize(10);
  doc.text(
    `${participante.posicao}º lugar | ${participante.pontos} pontos | ${participante.cravadas} cravadas | ${porcentagem(participante.aproveitamento)}`,
    14,
    39
  );

  autoTable(doc, {
    startY: 46,
    head: [["Jogo", "Data", "Resultado", "Palpite", "Pontos", "Tipo"]],
    body: jogos.map((jogo) => {
      const palpite = participante.palpites.find((item) => item.jogoId === jogo.id);
      return [
        jogo.abreviacao,
        `${formatarData(jogo.data)} ${jogo.horario}`,
        jogo.resultado ?? "pendente",
        palpite?.palpite ?? "-",
        String(palpite?.pontos ?? 0),
        palpite?.tipo ?? "sem palpite"
      ];
    }),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [217, 4, 41], textColor: 255 },
    margin: { left: 14, right: 14 }
  });

  salvarPdf(doc, `relatorio-${participante.nome.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
