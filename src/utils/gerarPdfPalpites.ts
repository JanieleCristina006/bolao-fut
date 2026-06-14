import autoTable from "jspdf-autotable";
import { PONTUACAO_LABELS } from "../constants";
import type { Jogo, Palpite } from "../types";
import { formatarData } from "./formatadores";
import { criarDocumento, salvarPdf } from "./pdfBase";

function legenda(): string {
  return Object.entries(PONTUACAO_LABELS)
    .map(([tipo, label]) => `${tipo}: ${label}`)
    .join(" | ");
}

export function gerarPdfPalpitesDeJogo(jogo: Jogo, palpites: Palpite[]): void {
  const doc = criarDocumento(`Palpites - ${jogo.abreviacao}`);
  doc.setFontSize(10);
  doc.text(`${formatarData(jogo.data)} às ${jogo.horario} | Resultado: ${jogo.resultado ?? "pendente"}`, 14, 39);

  autoTable(doc, {
    startY: 45,
    head: [["Participante", "Palpite", "Pontos", "Tipo"]],
    body: palpites.map((palpite) => [
      palpite.participante,
      palpite.palpite || "-",
      String(palpite.pontos),
      PONTUACAO_LABELS[palpite.tipo]
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [217, 4, 41], textColor: 255 },
    margin: { left: 14, right: 14 }
  });

  doc.setFontSize(8);
  doc.text(legenda(), 14, 280, { maxWidth: 180 });
  salvarPdf(doc, `palpites-${jogo.id}.pdf`);
}

export function gerarPdfPalpitesFiltrados(jogos: Jogo[], palpites: Palpite[]): void {
  const doc = criarDocumento("Palpites filtrados");
  const linhas = jogos.flatMap((jogo) =>
    palpites
      .filter((palpite) => palpite.jogoId === jogo.id)
      .map((palpite) => [
        jogo.abreviacao,
        `${formatarData(jogo.data)} ${jogo.horario}`,
        jogo.resultado ?? "pendente",
        palpite.participante,
        palpite.palpite,
        String(palpite.pontos),
        PONTUACAO_LABELS[palpite.tipo]
      ])
  );

  autoTable(doc, {
    startY: 38,
    head: [["Jogo", "Data", "Resultado", "Participante", "Palpite", "Pontos", "Tipo"]],
    body: linhas,
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [217, 4, 41], textColor: 255 },
    margin: { left: 10, right: 10 }
  });

  doc.setFontSize(8);
  doc.text(legenda(), 14, 280, { maxWidth: 180 });
  salvarPdf(doc, "palpites-filtrados-bolao.pdf");
}

export function gerarPdfPalpitesParticipante(nome: string, jogos: Jogo[], palpites: Palpite[]): void {
  const doc = criarDocumento(`Palpites - ${nome}`);
  const linhas = jogos.map((jogo) => {
    const palpite = palpites.find((item) => item.jogoId === jogo.id && item.participante === nome);
    return [
      jogo.abreviacao,
      `${formatarData(jogo.data)} ${jogo.horario}`,
      jogo.resultado ?? "pendente",
      palpite?.palpite ?? "-",
      String(palpite?.pontos ?? 0),
      palpite ? PONTUACAO_LABELS[palpite.tipo] : "Sem palpite"
    ];
  });

  autoTable(doc, {
    startY: 38,
    head: [["Jogo", "Data", "Resultado", "Palpite", "Pontos", "Tipo"]],
    body: linhas,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [217, 4, 41], textColor: 255 },
    margin: { left: 14, right: 14 }
  });

  salvarPdf(doc, `palpites-${nome.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
