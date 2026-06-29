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

function formatarBonus(palpite: Palpite): string {
  return String(palpite.bonusClassificado ?? 0);
}

export function gerarPdfPalpitesDeJogo(jogo: Jogo, palpites: Palpite[]): void {
  const doc = criarDocumento(`Palpites - ${jogo.abreviacao}`);
  const isMataMata = jogo.fase === "mata-mata";
  doc.setFontSize(10);
  doc.text(
    `${formatarData(jogo.data)} às ${jogo.horario} | Resultado: ${jogo.resultado ?? "pendente"}${
      isMataMata ? ` | Classificado: ${jogo.classificado ?? "pendente"}` : ""
    }`,
    14,
    39
  );

  autoTable(doc, {
    startY: 45,
    head: isMataMata
      ? [["Participante", "Palpite 90m", "Classificado", "Pontos", "Bonus", "Tipo"]]
      : [["Participante", "Palpite", "Pontos", "Bonus", "Tipo"]],
    body: palpites.map((palpite) =>
      isMataMata
        ? [
            palpite.participante,
            palpite.palpite || "-",
            palpite.classificado || "-",
            String(palpite.pontos),
            formatarBonus(palpite),
            PONTUACAO_LABELS[palpite.tipo]
          ]
        : [palpite.participante, palpite.palpite || "-", String(palpite.pontos), formatarBonus(palpite), PONTUACAO_LABELS[palpite.tipo]]
    ),
    styles: { fontSize: isMataMata ? 8 : 9, cellPadding: 2 },
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
        jogo.fase === "mata-mata" ? `${jogo.resultado ?? "pendente"} / ${jogo.classificado ?? "pendente"}` : (jogo.resultado ?? "pendente"),
        palpite.participante,
        jogo.fase === "mata-mata" ? `${palpite.palpite || "-"} / ${palpite.classificado || "-"}` : palpite.palpite,
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
      jogo.fase === "mata-mata" ? `${jogo.resultado ?? "pendente"} / ${jogo.classificado ?? "pendente"}` : (jogo.resultado ?? "pendente"),
      jogo.fase === "mata-mata" ? `${palpite?.palpite ?? "-"} / ${palpite?.classificado ?? "-"}` : (palpite?.palpite ?? "-"),
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
