export type StatusJogo = "agendado" | "andamento" | "finalizado";

export type PontuacaoTipo = "exato" | "vencedor" | "empate" | "classificado" | "erro" | "pendente";

export type FaseJogo = "grupos" | "mata-mata";

export type TipoPontuacaoJogo = "grupos" | "geral" | "especial";

export type PagamentoSituacao = "pago" | "pendente" | "isento";

export interface ResultadoPontuacao {
  pontos: number;
  cravada: boolean;
  tipo: PontuacaoTipo;
  pontosPlacar?: number;
  bonusClassificado?: number;
  classificadoCorreto?: boolean;
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
  classificado?: string | null;
  fase?: FaseJogo;
  tipoPontuacao?: TipoPontuacaoJogo;
  pontosMaximos?: number;
  status: StatusJogo;
}

export interface Palpite extends ResultadoPontuacao {
  jogoId: string;
  participante: string;
  palpite: string;
  classificado?: string | null;
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
  pagamentosIsentos?: number;
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
  classificado?: string;
  adminToken: string;
}

export interface AtualizarPalpitePayload {
  participante: string;
  jogoId: string;
  palpite: string;
  classificado?: string;
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

export interface RemoverParticipantePayload {
  nome: string;
  adminToken: string;
}

export interface RemoverParticipanteResponse extends ApiMessage {
  participante: string;
  jogosRemovidos: number;
  rankingRemovido: boolean;
  pagamentoRemovido: boolean;
}

export interface ApiMessage {
  ok: boolean;
  message: string;
}
