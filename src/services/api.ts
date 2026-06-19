import { CACHE_TTL_MS } from "../constants";
import { dashboardMock, getParticipanteMock, jogosMock, pagamentosMock, palpitesMock, participantesMock, rankingMock } from "../mocks/data";
import { getExcelAction, loadExcelDashboard, parseExcelDashboard } from "./excel";
import type {
  AdicionarParticipantePayload,
  AdicionarParticipanteResponse,
  ApiMessage,
  AtualizarPagamentoPayload,
  AtualizarPalpitePayload,
  AtualizarResultadoPayload,
  DashboardData,
  Jogo,
  Pagamento,
  Palpite,
  Participante,
  ParticipanteDetalhe,
  RankingItem
} from "../types";
import type {
  EstruturaImportacaoPalpites,
  ImportarPalpitesEmLotePayload,
  ImportarPalpitesEmLoteResponse
} from "../types/importacaoPalpites";

const EXCEL_URL = (import.meta.env.VITE_EXCEL_FILE_URL as string | undefined)?.trim();
const API_URL = (import.meta.env.VITE_GOOGLE_SCRIPT_API_URL as string | undefined)?.trim();
const IMPORTED_SPREADSHEET_KEY = "bolao-imported-spreadsheet";

type DataSource = "excel" | "api" | "mock";

interface ImportedSpreadsheet {
  fileName: string;
  importedAt: string;
  dashboard: DashboardData;
}

export const DATA_SOURCE_CHANGE_EVENT = "bolao:data-source-change";

let importedSpreadsheet = readImportedSpreadsheet();

export const USE_MOCK_DATA = getBaseDataSource() === "mock";
export const ADMIN_WRITES_ENABLED = isAdminWritesEnabled();
export const DATA_SOURCE_LABEL = getDataSourceLabel();

let excelDashboardPromise: Promise<DashboardData> | null = null;

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getBaseDataSource(): DataSource {
  return API_URL ? "api" : EXCEL_URL ? "excel" : "mock";
}

function isDashboardData(value: unknown): value is DashboardData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<DashboardData>;
  return (
    Array.isArray(data.participantes) &&
    Array.isArray(data.ranking) &&
    Array.isArray(data.jogos) &&
    Array.isArray(data.palpites) &&
    Array.isArray(data.pagamentos) &&
    Boolean(data.resumo)
  );
}

function readImportedSpreadsheet(): ImportedSpreadsheet | null {
  if (getBaseDataSource() === "api") {
    getStorage()?.removeItem(IMPORTED_SPREADSHEET_KEY);
    return null;
  }

  const raw = getStorage()?.getItem(IMPORTED_SPREADSHEET_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ImportedSpreadsheet>;
    if (!parsed.fileName || !parsed.importedAt || !isDashboardData(parsed.dashboard)) return null;
    return {
      fileName: parsed.fileName,
      importedAt: parsed.importedAt,
      dashboard: normalizarDashboard(parsed.dashboard)
    };
  } catch {
    getStorage()?.removeItem(IMPORTED_SPREADSHEET_KEY);
    return null;
  }
}

function saveImportedSpreadsheet(nextSpreadsheet: ImportedSpreadsheet): void {
  try {
    getStorage()?.setItem(IMPORTED_SPREADSHEET_KEY, JSON.stringify(nextSpreadsheet));
  } catch {
    // Importação continua funcionando em memória se o navegador negar armazenamento.
  }
}

function emitDataSourceChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DATA_SOURCE_CHANGE_EVENT));
}

function getCache<T>(key: string): T | null {
  const storage = getStorage();
  const raw = storage?.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed.expiresAt < Date.now()) {
      storage?.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    storage?.removeItem(key);
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  const payload: CacheEntry<T> = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  getStorage()?.setItem(key, JSON.stringify(payload));
}

function clearCache(): void {
  const storage = getStorage();
  if (!storage) return;
  Object.keys(storage)
    .filter((key) => key.startsWith("bolao-cache:"))
    .forEach((key) => storage.removeItem(key));
}

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
    throw new Error(`${fallbackMessage}. Erro ${response.status}.`);
  }

  if (/^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body)) {
    throw new Error(
      "A URL do Google Apps Script redirecionou para login do Google. Publique o script como Aplicativo da Web com acesso liberado ou use VITE_EXCEL_FILE_URL."
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
  return {
    ...data,
    ranking: data.ranking.map((item, index) => ({ ...item, ordemOriginal: item.ordemOriginal ?? index })),
    pagamentos: data.pagamentos.map((item) => ({
      ...item,
      situacao: item.pago ? "pago" : "pendente"
    })),
    participantes: data.participantes.map((item) => ({
      ...item,
      pagamento: item.pagamento ?? "pendente"
    }))
  };
}

async function request<T>(action: string, forceRefresh = false): Promise<T> {
  if (importedSpreadsheet) {
    const importedData = getExcelAction<T>(importedSpreadsheet.dashboard, action);
    if (importedData === null) throw new Error("Registro não encontrado na planilha importada.");
    return importedData;
  }

  const dataSource = getBaseDataSource();
  const cacheKey = `bolao-cache:${dataSource}:${action}`;
  const shouldUseCache = dataSource !== "api";
  if (shouldUseCache && !forceRefresh) {
    const cached = getCache<T>(cacheKey);
    if (cached) return cached;
  }

  if (dataSource === "excel" && EXCEL_URL) {
    if (!excelDashboardPromise || forceRefresh) {
      excelDashboardPromise = loadExcelDashboard(EXCEL_URL);
    }
    const dashboard = await excelDashboardPromise;
    const excelData = getExcelAction<T>(dashboard, action);
    if (excelData === null) throw new Error("Registro não encontrado na planilha Excel.");
    setCache(cacheKey, excelData);
    return excelData;
  }

  if (dataSource === "mock" || !API_URL) {
    const mockData = await mockGet<T>(action);
    setCache(cacheKey, mockData);
    return mockData;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  const url = new URL(API_URL, window.location.origin);
  const [baseAction, queryString] = action.split("?");
  url.searchParams.set("action", baseAction);
  if (queryString) {
    new URLSearchParams(queryString).forEach((value, key) => url.searchParams.set(key, value));
  }

  try {
    const response = await fetch(url.toString(), { cache: "no-store", signal: controller.signal });
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
  if (importedSpreadsheet || getBaseDataSource() === "excel") {
    throw new Error("O arquivo Excel aberto no navegador é somente leitura. Para gravar palpites, conecte o Google Apps Script.");
  }

  if (!API_URL) {
    return mockPost<T>(payload);
  }

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
    clearCache();
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

async function importarPalpitesIndividualmente(payload: ImportarPalpitesEmLotePayload): Promise<ImportarPalpitesEmLoteResponse> {
  const detalhes: ImportarPalpitesEmLoteResponse["detalhes"] = [];
  const erros: string[] = [];
  let importados = 0;
  let ignorados = 0;

  for (const item of payload.palpites) {
    const jogo = `${item.timeCasa} x ${item.timeFora}`;
    const palpite = `${item.golsCasa}x${item.golsFora}`;

    if (item.decisao === "ignorar" || item.decisao === "manter") {
      ignorados += 1;
      detalhes.push({
        participante: item.participante,
        jogo,
        status: item.decisao === "manter" ? "mantido" : "ignorado",
        novo: palpite
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
        palpite
      });

      importados += 1;
      detalhes.push({
        participante: item.participante,
        jogo,
        status: "importado",
        novo: palpite
      });
    } catch (error) {
      const message = `${item.participante} - ${jogo}: ${getErrorMessage(error)}`;
      erros.push(message);
      detalhes.push({
        participante: item.participante,
        jogo,
        status: "erro",
        novo: palpite,
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

function mockGet<T>(action: string): Promise<T> {
  const [baseAction, queryString] = action.split("?");
  const params = new URLSearchParams(queryString ?? "");

  const resposta =
    baseAction === "dashboard"
      ? dashboardMock
      : baseAction === "ranking"
        ? rankingMock
        : baseAction === "jogos"
          ? jogosMock
          : baseAction === "palpites"
            ? palpitesMock
            : baseAction === "pagamentos"
              ? pagamentosMock
              : baseAction === "participantes"
                ? participantesMock
                : baseAction === "participante"
                  ? getParticipanteMock(params.get("nome") ?? "")
                  : null;

  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (resposta === null) {
        reject(new Error("Registro não encontrado nos dados de demonstração."));
        return;
      }
      resolve(resposta as T);
    }, 260);
  });
}

function mockPost<T>(payload: Record<string, unknown>): Promise<T> {
  const message: ApiMessage = {
    ok: true,
    message: `Ação ${String(payload.action ?? "administrativa")} simulada nos dados mockados.`
  };
  return Promise.resolve(message as T);
}

export function getDataSourceLabel(): string {
  if (importedSpreadsheet) return `Planilha importada: ${importedSpreadsheet.fileName}`;

  const dataSource = getBaseDataSource();
  return dataSource === "excel" ? "Excel conectado" : dataSource === "api" ? "Google Planilhas conectado" : "Modo demonstração";
}

export function getImportedSpreadsheetName(): string | null {
  return importedSpreadsheet?.fileName ?? null;
}

export function isImportedSpreadsheetActive(): boolean {
  return Boolean(importedSpreadsheet);
}

export function isAdminWritesEnabled(): boolean {
  return !importedSpreadsheet && getBaseDataSource() === "api";
}

export function isLiveDataSourceActive(): boolean {
  return !importedSpreadsheet && getBaseDataSource() === "api";
}

export function isSpreadsheetImportEnabled(): boolean {
  return getBaseDataSource() !== "api";
}

async function importarPlanilha(file: File): Promise<DashboardData> {
  if (!isSpreadsheetImportEnabled()) {
    throw new Error("A fonte em tempo real via Google Apps Script já está ativa. Desative VITE_GOOGLE_SCRIPT_API_URL para importar Excel local.");
  }

  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error("Selecione um arquivo Excel .xlsx.");
  }

  const dashboard = normalizarDashboard(await parseExcelDashboard(file));
  importedSpreadsheet = {
    fileName: file.name,
    importedAt: new Date().toISOString(),
    dashboard
  };

  saveImportedSpreadsheet(importedSpreadsheet);
  excelDashboardPromise = null;
  clearCache();
  emitDataSourceChange();

  return dashboard;
}

function limparPlanilhaImportada(): void {
  importedSpreadsheet = null;
  getStorage()?.removeItem(IMPORTED_SPREADSHEET_KEY);
  excelDashboardPromise = null;
  clearCache();
  emitDataSourceChange();
}

export const api = {
  importarPlanilha,
  limparPlanilhaImportada,
  getDashboard: (forceRefresh = false) => request<DashboardData>("dashboard", forceRefresh).then(normalizarDashboard),
  getRanking: (forceRefresh = false) => request<RankingItem[]>("ranking", forceRefresh),
  getJogos: (forceRefresh = false) => request<Jogo[]>("jogos", forceRefresh),
  getPalpites: (forceRefresh = false) => request<Palpite[]>("palpites", forceRefresh),
  getParticipantes: (forceRefresh = false) => request<Participante[]>("participantes", forceRefresh),
  getPagamentos: (forceRefresh = false) => request<Pagamento[]>("pagamentos", forceRefresh),
  getParticipante: (nome: string, forceRefresh = false) =>
    request<ParticipanteDetalhe>(`participante?nome=${encodeURIComponent(nome)}`, forceRefresh),
  getEstruturaImportacao,
  atualizarPagamento: (payload: AtualizarPagamentoPayload) =>
    post<ApiMessage>({ action: "atualizarPagamento", ...payload }),
  atualizarResultado: (payload: AtualizarResultadoPayload) =>
    post<ApiMessage>({ action: "atualizarResultado", ...payload }),
  atualizarPalpite: (payload: AtualizarPalpitePayload) =>
    post<ApiMessage>({ action: "atualizarPalpite", ...payload }),
  adicionarParticipante,
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
