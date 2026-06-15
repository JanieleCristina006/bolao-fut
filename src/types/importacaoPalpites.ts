import type { Jogo, Palpite, Participante } from "./index";

export type StatusImportacaoPalpite =
  | "valido"
  | "palpite-existente"
  | "participante-nao-encontrado"
  | "jogo-nao-encontrado"
  | "times-invertidos"
  | "duplicado"
  | "nao-enviou"
  | "formato-invalido"
  | "removido";

export type DecisaoImportacaoPalpite = "substituir" | "manter" | "ignorar";

export interface ImportacaoPalpiteItem {
  id: string;
  participanteTexto: string;
  participanteOficial?: string;
  participanteValido: boolean;
  data: string | null;
  linha?: number;
  linhaOriginal?: string;
  timeCasa: string;
  timeFora: string;
  golsCasa: number | null;
  golsFora: number | null;
  placar: string;
  jogoId?: string;
  jogoTexto: string;
  mandanteOficial?: string;
  visitanteOficial?: string;
  status: StatusImportacaoPalpite;
  valido: boolean;
  importavel: boolean;
  incluir: boolean;
  usarNaImportacao: boolean;
  duplicado: boolean;
  palpiteAtual?: string | null;
  decisao: DecisaoImportacaoPalpite;
  avisos: string[];
  erros: string[];
}

export interface PalpiteProcessado {
  participante: string;
  participanteOficial?: string;
  data: string | null;
  jogos: ImportacaoPalpiteItem[];
  avisos: string[];
}

export interface ResultadoImportacaoPalpites {
  participantes: PalpiteProcessado[];
  itens: ImportacaoPalpiteItem[];
  linhasIgnoradas: string[];
  erros: string[];
  resumo: {
    total: number;
    validos: number;
    importaveis: number;
    invalidos: number;
    duplicados: number;
    naoEnviados: number;
    comPalpiteExistente: number;
  };
}

export interface ProcessarPalpitesWhatsAppOptions {
  participantes: Participante[];
  jogos: Jogo[];
  palpitesExistentes?: Palpite[];
}

export interface ImportarPalpiteEmLoteItem {
  participante: string;
  jogoId: string;
  timeCasa: string;
  timeFora: string;
  golsCasa: number;
  golsFora: number;
  decisao: DecisaoImportacaoPalpite;
}

export interface ImportarPalpitesEmLotePayload {
  adminToken: string;
  data?: string | null;
  palpites: ImportarPalpiteEmLoteItem[];
}

export interface ImportarPalpitesEmLoteDetalhe {
  participante: string;
  jogo: string;
  status: string;
  atual?: string;
  novo?: string;
  erro?: string;
}

export interface ImportarPalpitesEmLoteResponse {
  ok: boolean;
  message: string;
  importados: number;
  atualizados: number;
  ignorados: number;
  erros: string[];
  detalhes: ImportarPalpitesEmLoteDetalhe[];
}
