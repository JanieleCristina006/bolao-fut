import type { Jogo, Pagamento, Participante, PontuacaoTipo, RankingItem } from "../types";
import { normalizarTexto } from "./formatadores";

export function filtrarRanking(
  ranking: RankingItem[],
  busca: string,
  faixa: string
): RankingItem[] {
  const termo = normalizarTexto(busca);
  return ranking.filter((item) => {
    const bateBusca = !termo || normalizarTexto(item.participante).includes(termo);
    const bateFaixa =
      faixa === "todos" ||
      (faixa === "top3" && item.posicao <= 3) ||
      (faixa === "top5" && item.posicao <= 5) ||
      (faixa === "top10" && item.posicao <= 10) ||
      (faixa === "11mais" && item.posicao >= 11);
    return bateBusca && bateFaixa;
  });
}

export function filtrarParticipantes(
  participantes: Participante[],
  busca: string,
  pagamento: string
): Participante[] {
  const termo = normalizarTexto(busca);
  return participantes.filter((participante) => {
    const bateBusca = !termo || normalizarTexto(participante.nome).includes(termo);
    const batePagamento = pagamento === "todos" || participante.pagamento === pagamento;
    return bateBusca && batePagamento;
  });
}

export interface FiltrosJogos {
  participante: string;
  dia: string;
  rodada: string;
  jogo: string;
  selecao: string;
  status: string;
  resultado: string;
  tipo: PontuacaoTipo | "todos" | "pontuado";
}

export function filtrarJogos(jogos: Jogo[], filtros: FiltrosJogos, jogoTemPalpite: (jogo: Jogo) => boolean): Jogo[] {
  const jogoTermo = normalizarTexto(filtros.jogo);
  const selecaoTermo = normalizarTexto(filtros.selecao);

  return jogos.filter((jogo) => {
    const bateDia = !filtros.dia || jogo.dia === filtros.dia;
    const bateRodada = !filtros.rodada || jogo.rodada === filtros.rodada;
    const bateJogo =
      !jogoTermo ||
      normalizarTexto(`${jogo.mandante} ${jogo.visitante} ${jogo.abreviacao}`).includes(jogoTermo);
    const bateSelecao =
      !selecaoTermo || normalizarTexto(`${jogo.mandante} ${jogo.visitante}`).includes(selecaoTermo);
    const bateStatus = filtros.status === "todos" || jogo.status === filtros.status;
    const bateResultado =
      filtros.resultado === "todos" ||
      (filtros.resultado === "com" && Boolean(jogo.resultado)) ||
      (filtros.resultado === "sem" && !jogo.resultado);
    const batePalpite = !filtros.participante || jogoTemPalpite(jogo);
    return bateDia && bateRodada && bateJogo && bateSelecao && bateStatus && bateResultado && batePalpite;
  });
}

export function filtrarPagamentos(pagamentos: Pagamento[], busca: string, status: string, data: string): Pagamento[] {
  const termo = normalizarTexto(busca);
  return pagamentos.filter((pagamento) => {
    const bateBusca = !termo || normalizarTexto(pagamento.participante).includes(termo);
    const bateStatus = status === "todos" || pagamento.situacao === status;
    const bateData = !data || pagamento.dataPagamento === data;
    return bateBusca && bateStatus && bateData;
  });
}
