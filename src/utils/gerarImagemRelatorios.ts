import { PIX_INFO, PONTUACAO_LABELS } from "../constants";
import type { DashboardData, Jogo, Pagamento, Palpite, ParticipanteDetalhe, RankingItem } from "../types";
import { formatarData, formatarMoeda, porcentagem } from "./formatadores";
import {
  baixarTabelaComoImagem,
  criarTabelaPalpitesDeJogo,
  gerarArquivosTabelaComoImagem,
  nomeSeguro,
  tomDoPalpite
} from "./gerarImagemPalpites";
import { baixarBlob, criarArquivoZip } from "./criarZip";
import { rotuloSituacaoPagamento } from "./pagamentos";

export function gerarImagemRelatorioGeral(data: DashboardData): void {
  baixarTabelaComoImagem({
    titulo: "Relatório geral",
    colunas: [
      { titulo: "Indicador", largura: 0.62 },
      { titulo: "Valor", largura: 0.38 }
    ],
    linhas: [
      ["Participantes", String(data.resumo.totalParticipantes)],
      ["Jogos finalizados", String(data.resumo.jogosFinalizados)],
      ["Jogos pendentes", String(data.resumo.jogosPendentes)],
      ["Cravadas", String(data.resumo.totalCravadas)],
      ["Pagamentos confirmados", String(data.resumo.pagamentosConfirmados)],
      ["Participantes isentos", String(data.resumo.pagamentosIsentos ?? 0)],
      ["Valor arrecadado", formatarMoeda(data.resumo.valorArrecadado)]
    ],
    nomeArquivo: "relatorio-geral-bolao"
  });
}

export function gerarImagemRanking(ranking: RankingItem[]): void {
  baixarTabelaComoImagem({
    titulo: "Ranking — Bolão Futebol Inglês",
    colunas: [
      { titulo: "Posição", largura: 0.1 },
      { titulo: "Participante", largura: 0.34 },
      { titulo: "Pontos", largura: 0.12 },
      { titulo: "Cravadas", largura: 0.14 },
      { titulo: "Palpites", largura: 0.13 },
      { titulo: "Aproveit.", largura: 0.17 }
    ],
    linhas: ranking.map((item) => [
      `${item.posicao}º`,
      item.participante,
      String(item.pontos),
      String(item.cravadas),
      String(item.palpites),
      porcentagem(item.aproveitamento)
    ]),
    nomeArquivo: "ranking-bolao-futebol-ingles"
  });
}

export function gerarImagemPagamentos(pagamentos: Pagamento[]): void {
  baixarTabelaComoImagem({
    titulo: "Pagamentos",
    subtitulo: PIX_INFO.texto,
    colunas: [
      { titulo: "Participante", largura: 0.42 },
      { titulo: "Situação", largura: 0.2 },
      { titulo: "Data", largura: 0.18 },
      { titulo: "Valor", largura: 0.2 }
    ],
    linhas: pagamentos.map((pagamento) => [
      pagamento.participante,
      rotuloSituacaoPagamento(pagamento.situacao),
      formatarData(pagamento.dataPagamento),
      formatarMoeda(pagamento.valor)
    ]),
    nomeArquivo: "pagamentos-bolao"
  });
}

export function gerarImagemParticipante(participante: ParticipanteDetalhe, jogos: Jogo[]): void {
  baixarTabelaComoImagem({
    titulo: `Relatório individual - ${participante.nome}`,
    subtitulo: `${participante.posicao}º lugar | ${participante.pontos} pontos | ${participante.cravadas} cravadas | ${porcentagem(participante.aproveitamento)}`,
    colunas: [
      { titulo: "Jogo", largura: 0.26 },
      { titulo: "Data", largura: 0.2 },
      { titulo: "Resultado", largura: 0.13 },
      { titulo: "Palpite", largura: 0.13 },
      { titulo: "Pontos", largura: 0.1 },
      { titulo: "Tipo", largura: 0.18 }
    ],
    linhas: jogos.map((jogo) => {
      const palpite = participante.palpites.find((item) => item.jogoId === jogo.id);
      return [
        `${jogo.mandante} x ${jogo.visitante}`,
        `${formatarData(jogo.data)} ${jogo.horario}`,
        jogo.resultado ?? "pendente",
        palpite?.palpite ?? "-",
        String(palpite?.pontos ?? 0),
        palpite ? PONTUACAO_LABELS[palpite.tipo] : "Sem palpite"
      ];
    }),
    tonsLinhas: jogos.map((jogo) => tomDoPalpite(participante.palpites.find((item) => item.jogoId === jogo.id))),
    nomeArquivo: `relatorio-${nomeSeguro(participante.nome)}`
  });
}

export async function gerarZipImagensPalpitesFiltrados(jogos: Jogo[], palpites: Palpite[]): Promise<void> {
  const arquivos = [];

  for (const [indice, jogo] of jogos.entries()) {
    const palpitesDoJogo = palpites.filter((palpite) => palpite.jogoId === jogo.id);
    const imagens = await gerarArquivosTabelaComoImagem(criarTabelaPalpitesDeJogo(jogo, palpitesDoJogo));
    const prefixo = String(indice + 1).padStart(2, "0");
    arquivos.push(...imagens.map((imagem) => ({ ...imagem, nome: `${prefixo}-${imagem.nome}` })));
  }

  const zip = await criarArquivoZip(arquivos);
  baixarBlob(zip, "palpites-filtrados-por-jogo.zip");
}

export function gerarImagemPalpitesParticipante(nome: string, jogos: Jogo[], palpites: Palpite[]): void {
  baixarTabelaComoImagem({
    titulo: `Palpites - ${nome}`,
    colunas: [
      { titulo: "Jogo", largura: 0.28 },
      { titulo: "Data", largura: 0.19 },
      { titulo: "Resultado", largura: 0.13 },
      { titulo: "Palpite", largura: 0.13 },
      { titulo: "Pontos", largura: 0.1 },
      { titulo: "Tipo", largura: 0.17 }
    ],
    linhas: jogos.map((jogo) => {
      const palpite = palpites.find((item) => item.jogoId === jogo.id && item.participante === nome);
      return [
        `${jogo.mandante} x ${jogo.visitante}`,
        `${formatarData(jogo.data)} ${jogo.horario}`,
        jogo.resultado ?? "pendente",
        palpite?.palpite ?? "-",
        String(palpite?.pontos ?? 0),
        palpite ? PONTUACAO_LABELS[palpite.tipo] : "Sem palpite"
      ];
    }),
    tonsLinhas: jogos.map((jogo) =>
      tomDoPalpite(palpites.find((item) => item.jogoId === jogo.id && item.participante === nome))
    ),
    nomeArquivo: `palpites-${nomeSeguro(nome)}`
  });
}
