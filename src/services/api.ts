import { normalizarTexto } from "../utils/formatadores";
import { normalizarSituacaoPagamento } from "../utils/pagamentos";
import type {
  AdicionarParticipantePayload,
  AdicionarParticipanteResponse,
  ApiMessage,
  AtualizarPagamentoPayload,
  AtualizarPalpitePayload,
  AtualizarRankingPontosPayload,
  AtualizarResultadoPayload,
  DashboardData,
  Jogo,
  Pagamento,
  Palpite,
  Participante,
  ParticipanteDetalhe,
  RemoverParticipantePayload,
  RemoverParticipanteResponse,
  RankingItem
} from "../types";
import type {
  EstruturaImportacaoPalpites,
  ImportarPalpitesEmLotePayload,
  ImportarPalpitesEmLoteResponse
} from "../types/importacaoPalpites";

const API_URL = ((import.meta.env.VITE_GOOGLE_SCRIPT_API_URL as string | undefined) || "/api/sheets").trim();

function isApiErrorPayload(value: unknown): value is ApiMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as ApiMessage).ok === false &&
    typeof (value as ApiMessage).message === "string"
  );
}

async function parseApiJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const body = await response.text();

  if (!response.ok) {
    try {
      const errorPayload = JSON.parse(body) as Partial<ApiMessage>;
      if (typeof errorPayload.message === "string" && errorPayload.message.trim()) {
        throw new Error(errorPayload.message);
      }
    } catch (error) {
      if (error instanceof Error && !(error instanceof SyntaxError)) throw error;
    }
    throw new Error(`${fallbackMessage}. Erro ${response.status}.`);
  }

  if (/^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body)) {
    throw new Error(
      "A URL do Google Apps Script redirecionou para o login do Google. Publique o script como Aplicativo da Web com acesso liberado."
    );
  }

  try {
    const json = JSON.parse(body) as T;
    if (isApiErrorPayload(json)) throw new Error(json.message);
    return json;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("A API da planilha não retornou JSON válido. Verifique a URL /exec do Google Apps Script.");
    }
    throw error;
  }
}

function normalizarDashboard(data: DashboardData): DashboardData {
  const pagamentos = data.pagamentos.map((item) => {
    const situacao = normalizarSituacaoPagamento(item.situacao, item.pago);
    return {
      ...item,
      pago: situacao === "pago",
      valor: situacao === "isento" ? 0 : item.valor,
      situacao
    };
  });
  const pagamentosPorParticipante = new Map(
    pagamentos.map((item) => [normalizarTexto(item.participante), item])
  );
  const pagos = pagamentos.filter((item) => item.situacao === "pago");
  const isentos = pagamentos.filter((item) => item.situacao === "isento");
  const pendentes = pagamentos.filter((item) => item.situacao === "pendente");

  return {
    ...data,
    ranking: data.ranking.map((item, index) => ({ ...item, ordemOriginal: item.ordemOriginal ?? index })),
    pagamentos,
    participantes: data.participantes.map((item) => ({
      ...item,
      pagamento:
        pagamentosPorParticipante.get(normalizarTexto(item.nome))?.situacao ??
        normalizarSituacaoPagamento(item.pagamento)
    })),
    resumo: {
      ...data.resumo,
      pagamentosConfirmados: pagos.length,
      pagamentosIsentos: isentos.length,
      valorArrecadado: pagos.reduce((total, item) => total + Number(item.valor || 0), 0),
      valorPendente: pendentes.reduce((total, item) => total + Number(item.valor || 0), 0)
    }
  };
}

async function request<T>(action: string, forceRefresh = false): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  const url = new URL(API_URL, window.location.origin);
  const [baseAction, queryString] = action.split("?");
  url.searchParams.set("action", baseAction);
  if (queryString) {
    new URLSearchParams(queryString).forEach((value, key) => url.searchParams.set(key, value));
  }

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
      headers: forceRefresh ? { "Cache-Control": "no-cache" } : undefined
    });
    const json = await parseApiJson<T>(response, "Não foi possível acessar a API da planilha");
    return json;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("A API demorou para responder. Tente novamente.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function post<T>(payload: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const json = await parseApiJson<T>(response, "Não foi possível gravar dados na planilha");
    return json;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("A gravação demorou para responder. Tente novamente.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido.";
}

function isInvalidPostActionError(error: unknown): boolean {
  const normalized = getErrorMessage(error)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return normalized.includes("acao post invalida");
}

async function getEstruturaImportacao(): Promise<EstruturaImportacaoPalpites> {
  try {
    return await request<EstruturaImportacaoPalpites>(`estruturaImportacao?t=${Date.now()}`, true);
  } catch (error) {
    const normalized = getErrorMessage(error)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (normalized.includes("acao get invalida")) {
      throw new Error(
        "O Google Apps Script publicado está em uma versão antiga. Copie o Code.gs atualizado e implante uma Nova versão antes de importar."
      );
    }
    throw error;
  }
}

async function adicionarParticipante(payload: AdicionarParticipantePayload): Promise<AdicionarParticipanteResponse> {
  try {
    return await post<AdicionarParticipanteResponse>({ action: "adicionarParticipante", ...payload });
  } catch (error) {
    if (isInvalidPostActionError(error)) {
      throw new Error(
        "O Google Apps Script publicado ainda não possui o cadastro de participantes. Atualize o Code.gs e implante uma Nova versão."
      );
    }
    throw error;
  }
}

async function removerParticipante(payload: RemoverParticipantePayload): Promise<RemoverParticipanteResponse> {
  try {
    return await post<RemoverParticipanteResponse>({ action: "removerParticipante", ...payload });
  } catch (error) {
    if (isInvalidPostActionError(error)) {
      throw new Error(
        "O Google Apps Script publicado ainda nao possui a remocao de participantes. Atualize o Code.gs e implante uma Nova versao."
      );
    }
    throw error;
  }
}

async function importarPalpitesIndividualmente(payload: ImportarPalpitesEmLotePayload): Promise<ImportarPalpitesEmLoteResponse> {
  const detalhes: ImportarPalpitesEmLoteResponse["detalhes"] = [];
  const erros: string[] = [];
  let importados = 0;
  let ignorados = 0;

  for (const item of payload.palpites) {
    const jogo = `${item.timeCasa} x ${item.timeFora}`;
    const palpite = `${item.golsCasa}x${item.golsFora}`;
    const novo = item.classificado ? `${palpite} / ${item.classificado}` : palpite;

    if (item.decisao === "ignorar" || item.decisao === "manter") {
      ignorados += 1;
      detalhes.push({
        participante: item.participante,
        jogo,
        status: item.decisao === "manter" ? "mantido" : "ignorado",
        novo
      });
      continue;
    }

    try {
      await post<ApiMessage>({
        action: "atualizarPalpite",
        adminToken: payload.adminToken,
        participante: item.participante,
        jogoId: item.jogoId,
        timeCasa: item.timeCasa,
        timeFora: item.timeFora,
        palpite,
        classificado: item.classificado || undefined
      });

      importados += 1;
      detalhes.push({
        participante: item.participante,
        jogo,
        status: "importado",
        novo
      });
    } catch (error) {
      const message = `${item.participante} - ${jogo}: ${getErrorMessage(error)}`;
      erros.push(message);
      detalhes.push({
        participante: item.participante,
        jogo,
        status: "erro",
        novo,
        erro: message
      });
    }
  }

  if (!importados && erros.length > 0) {
    throw new Error(erros[0]);
  }

  const prefix = erros.length > 0 ? "Importação parcial em modo de compatibilidade" : "Importação concluída em modo de compatibilidade";
  const errorSuffix = erros.length > 0 ? ` ${erros.length} falharam. Primeiro erro: ${erros[0]}` : "";

  return {
    ok: erros.length === 0,
    message: `${prefix}: ${importados} palpites enviados, ${ignorados} ignorados.${errorSuffix}`,
    importados,
    atualizados: 0,
    ignorados,
    erros,
    detalhes
  };
}

export function isAdminWritesEnabled(): boolean {
  return Boolean(API_URL);
}

export function isLiveDataSourceActive(): boolean {
  return Boolean(API_URL);
}

export const api = {
  getDashboard: (forceRefresh = false) => request<DashboardData>("dashboard", forceRefresh).then(normalizarDashboard),
  getRanking: (forceRefresh = false) => request<RankingItem[]>("ranking", forceRefresh),
  getJogos: (forceRefresh = false) => request<Jogo[]>("jogos", forceRefresh),
  getPalpites: (forceRefresh = false) => request<Palpite[]>("palpites", forceRefresh),
  getParticipantes: (forceRefresh = false) =>
    request<Participante[]>("participantes", forceRefresh).then((participantes) =>
      participantes.map((participante) => ({
        ...participante,
        pagamento: normalizarSituacaoPagamento(participante.pagamento)
      }))
    ),
  getPagamentos: (forceRefresh = false) =>
    request<Pagamento[]>("pagamentos", forceRefresh).then((pagamentos) =>
      pagamentos.map((pagamento) => {
        const situacao = normalizarSituacaoPagamento(pagamento.situacao, pagamento.pago);
        return {
          ...pagamento,
          pago: situacao === "pago",
          valor: situacao === "isento" ? 0 : pagamento.valor,
          situacao
        };
      })
    ),
  getParticipante: (nome: string, forceRefresh = false) =>
    request<ParticipanteDetalhe>(`participante?nome=${encodeURIComponent(nome)}`, forceRefresh).then((participante) => ({
      ...participante,
      pagamento: normalizarSituacaoPagamento(participante.pagamento)
    })),
  getEstruturaImportacao,
  atualizarPagamento: (payload: AtualizarPagamentoPayload) =>
    post<ApiMessage>({ action: "atualizarPagamento", ...payload }),
  atualizarResultado: (payload: AtualizarResultadoPayload) =>
    post<ApiMessage>({ action: "atualizarResultado", ...payload }),
  atualizarPalpite: (payload: AtualizarPalpitePayload) =>
    post<ApiMessage>({ action: "atualizarPalpite", ...payload }),
  atualizarRankingPontos: (payload: AtualizarRankingPontosPayload) =>
    post<ApiMessage>({ action: "atualizarRankingPontos", ...payload }),
  adicionarParticipante,
  removerParticipante,
  importarPalpitesEmLote: async (payload: ImportarPalpitesEmLotePayload) => {
    try {
      const response = await post<ImportarPalpitesEmLoteResponse>({ action: "importarPalpitesEmLote", ...payload });
      if (response.erros.length > 0 && response.importados + response.atualizados === 0) {
        throw new Error(response.erros[0]);
      }
      return response;
    } catch (error) {
      if (!isInvalidPostActionError(error)) throw error;
      return importarPalpitesIndividualmente(payload);
    }
  }
};
