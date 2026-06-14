import { PIX_INFO } from "../constants";
import type { DashboardData, Jogo, Pagamento, Palpite, Participante, ParticipanteDetalhe, RankingItem } from "../types";
import { calcularPontuacao } from "../utils/calcularPontuacao";

const nomes = [
  "Arthur Lima",
  "Beatriz Alves",
  "Caio Martins",
  "Daniela Rocha",
  "Eduardo Souza",
  "Fernanda Reis",
  "Gabriel Nunes",
  "Helena Costa",
  "Igor Batista",
  "Júlia Pereira",
  "Karen Dias",
  "Lucas Mendes",
  "Marina Lopes",
  "Nicolas Freitas",
  "Olívia Campos",
  "Paulo Henrique",
  "Quitéria Santos",
  "Rafael Gomes",
  "Sabrina Teixeira",
  "Thiago Moura",
  "Valentina Farias",
  "William Duarte"
];

export const jogosMock: Jogo[] = [
  {
    id: "rodada-1-ars-che",
    dia: "Dia 1",
    rodada: "Rodada 1",
    data: "2026-06-20",
    horario: "10:00",
    mandante: "Arsenal",
    visitante: "Chelsea",
    abreviacao: "ARS x CHE",
    resultado: "2x1",
    status: "finalizado"
  },
  {
    id: "rodada-1-liv-mci",
    dia: "Dia 1",
    rodada: "Rodada 1",
    data: "2026-06-20",
    horario: "13:00",
    mandante: "Liverpool",
    visitante: "Manchester City",
    abreviacao: "LIV x MCI",
    resultado: "1x1",
    status: "finalizado"
  },
  {
    id: "rodada-1-tot-mun",
    dia: "Dia 1",
    rodada: "Rodada 1",
    data: "2026-06-20",
    horario: "16:00",
    mandante: "Tottenham",
    visitante: "Manchester United",
    abreviacao: "TOT x MUN",
    resultado: "0x2",
    status: "finalizado"
  },
  {
    id: "rodada-2-new-avl",
    dia: "Dia 2",
    rodada: "Rodada 2",
    data: "2026-06-21",
    horario: "11:30",
    mandante: "Newcastle",
    visitante: "Aston Villa",
    abreviacao: "NEW x AVL",
    resultado: "3x1",
    status: "finalizado"
  },
  {
    id: "rodada-2-bha-eve",
    dia: "Dia 2",
    rodada: "Rodada 2",
    data: "2026-06-21",
    horario: "14:30",
    mandante: "Brighton",
    visitante: "Everton",
    abreviacao: "BHA x EVE",
    resultado: null,
    status: "agendado"
  },
  {
    id: "rodada-2-cry-ful",
    dia: "Dia 2",
    rodada: "Rodada 2",
    data: "2026-06-21",
    horario: "17:00",
    mandante: "Crystal Palace",
    visitante: "Fulham",
    abreviacao: "CRY x FUL",
    resultado: null,
    status: "agendado"
  },
  {
    id: "rodada-3-bre-wol",
    dia: "Dia 3",
    rodada: "Rodada 3",
    data: "2026-06-22",
    horario: "12:00",
    mandante: "Brentford",
    visitante: "Wolverhampton",
    abreviacao: "BRE x WOL",
    resultado: null,
    status: "agendado"
  },
  {
    id: "rodada-3-whu-lee",
    dia: "Dia 3",
    rodada: "Rodada 3",
    data: "2026-06-22",
    horario: "15:00",
    mandante: "West Ham",
    visitante: "Leeds United",
    abreviacao: "WHU x LEE",
    resultado: null,
    status: "agendado"
  }
];

const palpitesBase = ["2x1", "1x1", "0x2", "3x1", "1x0", "2x2", "0x0", "2x0", "1x2", "3x2"];

function palpitePara(indiceParticipante: number, indiceJogo: number): string {
  if ((indiceParticipante + indiceJogo) % 13 === 0) return "";
  const base = palpitesBase[(indiceParticipante * 3 + indiceJogo * 2) % palpitesBase.length];
  return base;
}

export const palpitesMock: Palpite[] = jogosMock.flatMap((jogo, indiceJogo) =>
  nomes
    .map((nome, indiceParticipante) => {
      const palpite = palpitePara(indiceParticipante, indiceJogo);
      const pontuacao = calcularPontuacao(palpite, jogo.resultado);
      return {
        jogoId: jogo.id,
        participante: nome,
        palpite,
        ...pontuacao
      };
    })
    .filter((palpite) => palpite.palpite.length > 0)
);

function gerarRanking(): RankingItem[] {
  const ranking = nomes.map((nome, ordemOriginal) => {
    const palpitesParticipante = palpitesMock.filter((palpite) => palpite.participante === nome);
    const pontos = palpitesParticipante.reduce((total, palpite) => total + palpite.pontos, 0);
    const cravadas = palpitesParticipante.filter((palpite) => palpite.cravada).length;
    const acertos = palpitesParticipante.filter((palpite) => palpite.pontos > 0).length;
    const jogosComResultado = jogosMock.filter((jogo) => jogo.resultado).length;
    const aproveitamento = jogosComResultado > 0 ? (pontos / (jogosComResultado * 5)) * 100 : 0;

    return {
      posicao: 0,
      participante: nome,
      pontos,
      cravadas,
      palpites: palpitesParticipante.length,
      acertos,
      aproveitamento,
      ordemOriginal
    };
  });

  return ranking
    .sort((a, b) => b.pontos - a.pontos || b.cravadas - a.cravadas || a.ordemOriginal - b.ordemOriginal)
    .map((item, indice) => ({ ...item, posicao: indice + 1 }));
}

export const rankingMock = gerarRanking();

export const pagamentosMock: Pagamento[] = nomes.map((nome, indice) => {
  const pago = indice % 4 !== 0;
  return {
    participante: nome,
    pago,
    dataPagamento: pago ? `2026-06-${String(10 + (indice % 10)).padStart(2, "0")}` : null,
    valor: PIX_INFO.valor,
    situacao: pago ? "pago" : "pendente"
  };
});

export const participantesMock: Participante[] = rankingMock.map((ranking) => {
  const pagamento = pagamentosMock.find((item) => item.participante === ranking.participante);
  return {
    nome: ranking.participante,
    posicao: ranking.posicao,
    pontos: ranking.pontos,
    cravadas: ranking.cravadas,
    palpitesEnviados: ranking.palpites,
    acertos: ranking.acertos,
    aproveitamento: ranking.aproveitamento,
    pagamento: pagamento?.situacao ?? "pendente",
    dataPix: pagamento?.dataPagamento ?? null
  };
});

export const dashboardMock: DashboardData = {
  participantes: participantesMock,
  ranking: rankingMock,
  jogos: jogosMock,
  palpites: palpitesMock,
  pagamentos: pagamentosMock,
  resumo: {
    totalParticipantes: participantesMock.length,
    jogosFinalizados: jogosMock.filter((jogo) => jogo.status === "finalizado").length,
    jogosPendentes: jogosMock.filter((jogo) => jogo.status !== "finalizado").length,
    totalCravadas: palpitesMock.filter((palpite) => palpite.cravada).length,
    pagamentosConfirmados: pagamentosMock.filter((pagamento) => pagamento.pago).length,
    valorArrecadado: pagamentosMock.filter((pagamento) => pagamento.pago).reduce((total, pagamento) => total + pagamento.valor, 0),
    valorPendente: pagamentosMock.filter((pagamento) => !pagamento.pago).reduce((total, pagamento) => total + pagamento.valor, 0)
  },
  ultimaAtualizacao: new Date().toISOString()
};

export function getParticipanteMock(nome: string): ParticipanteDetalhe | null {
  const participante = participantesMock.find((item) => item.nome.toLowerCase() === nome.toLowerCase());
  if (!participante) return null;

  const palpites = palpitesMock.filter((palpite) => palpite.participante === participante.nome);
  const jogosComPalpite = new Set(palpites.map((palpite) => palpite.jogoId));
  return {
    ...participante,
    palpites,
    jogosSemPalpite: jogosMock.filter((jogo) => !jogosComPalpite.has(jogo.id))
  };
}
