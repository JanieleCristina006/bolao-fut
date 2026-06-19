export type StatusJogo = "agendado" | "andamento" | "finalizado";

export type PontuacaoTipo = "exato" | "vencedor" | "empate" | "erro" | "pendente";

export type PagamentoSituacao = "pago" | "pendente";

export interface ResultadoPontuacao {
  pontos: number;
  cravada: boolean;
  tipo: PontuacaoTipo;
}

export interface Jogo {
  id: string;
  dia: string;
  rodada: string;
  data: string;
  horario: string;
  mandante: string;
  visitante: string;
  abreviacao: string;
  resultado: string | null;
  status: StatusJogo;
}

export interface Palpite extends ResultadoPontuacao {
  jogoId: string;
  participante: string;
  palpite: string;
}

export interface RankingItem {
  posicao: number;
  participante: string;
  pontos: number;
  cravadas: number;
  palpites: number;
  acertos: number;
  aproveitamento: number;
  ordemOriginal: number;
}

export interface Pagamento {
  participante: string;
  pago: boolean;
  dataPagamento: string | null;
  valor: number;
  situacao: PagamentoSituacao;
}

export interface Participante {
  nome: string;
  posicao: number;
  pontos: number;
  cravadas: number;
  palpitesEnviados: number;
  acertos: number;
  aproveitamento: number;
  pagamento: PagamentoSituacao;
  dataPix: string | null;
}

export interface ResumoDashboard {
  totalParticipantes: number;
  jogosFinalizados: number;
  jogosPendentes: number;
  totalCravadas: number;
  pagamentosConfirmados: number;
  valorArrecadado: number;
  valorPendente: number;
}

export interface DashboardData {
  participantes: Participante[];
  ranking: RankingItem[];
  jogos: Jogo[];
  palpites: Palpite[];
  pagamentos: Pagamento[];
  resumo: ResumoDashboard;
  ultimaAtualizacao: string;
}

export interface ParticipanteDetalhe extends Participante {
  palpites: Palpite[];
  jogosSemPalpite: Jogo[];
}

export interface AtualizarPagamentoPayload {
  participante: string;
  pago: boolean;
  dataPagamento: string;
  adminToken: string;
}

export interface AtualizarResultadoPayload {
  jogoId: string;
  resultado: string;
  adminToken: string;
}

export interface AtualizarPalpitePayload {
  participante: string;
  jogoId: string;
  palpite: string;
  adminToken: string;
}

export interface AdicionarParticipantePayload {
  nome: string;
  adminToken: string;
}

export interface AdicionarParticipanteResponse extends ApiMessage {
  participante: string;
  jogosAdicionados: number;
  jogosExistentes: number;
  rankingAdicionado: boolean;
  pagamentoAdicionado: boolean;
}

export interface ApiMessage {
  ok: boolean;
  message: string;
}
