import { CACHE_TTL_MS } from "../constants";
import { dashboardMock, getParticipanteMock, jogosMock, pagamentosMock, palpitesMock, participantesMock, rankingMock } from "../mocks/data";
import { getExcelAction, loadExcelDashboard, parseExcelDashboard } from "./excel";
import type {
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
  return EXCEL_URL ? "excel" : API_URL ? "api" : "mock";
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
    // Importacao continua funcionando em memoria se o navegador negar armazenamento.
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
    if (importedData === null) throw new Error("Registro nao encontrado na planilha importada.");
    return importedData;
  }

  const dataSource = getBaseDataSource();
  const cacheKey = `bolao-cache:${dataSource}:${action}`;
  if (!forceRefresh) {
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
  const url = new URL(API_URL);
  const [baseAction, queryString] = action.split("?");
  url.searchParams.set("action", baseAction);
  if (queryString) {
    new URLSearchParams(queryString).forEach((value, key) => url.searchParams.set(key, value));
  }

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    const json = await parseApiJson<T>(response, "Não foi possível acessar a API da planilha");
    setCache(cacheKey, json);
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
  if (importedSpreadsheet || EXCEL_URL) {
    const message: ApiMessage = {
      ok: false,
      message: "A integracao direta com Excel e somente leitura no navegador. Para gravar pagamentos, use Google Apps Script ou um backend."
    };
    return Promise.resolve(message as T);
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
  return dataSource === "excel" ? "Excel conectado" : dataSource === "api" ? "Google Planilhas conectado" : "Modo demonstracao";
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

async function importarPlanilha(file: File): Promise<DashboardData> {
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
  atualizarPagamento: (payload: AtualizarPagamentoPayload) =>
    post<ApiMessage>({ action: "atualizarPagamento", ...payload }),
  atualizarResultado: (payload: AtualizarResultadoPayload) =>
    post<ApiMessage>({ action: "atualizarResultado", ...payload }),
  atualizarPalpite: (payload: AtualizarPalpitePayload) =>
    post<ApiMessage>({ action: "atualizarPalpite", ...payload })
};
