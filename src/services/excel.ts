import readWorkbook from "read-excel-file/browser";
import { PIX_INFO } from "../constants";
import type { DashboardData, Jogo, Pagamento, Palpite, Participante, ParticipanteDetalhe, RankingItem } from "../types";
import { calcularPontuacao } from "../utils/calcularPontuacao";
import { normalizarTexto } from "../utils/formatadores";

type ExcelCell = string | number | boolean | Date | null;

interface ExcelSheet {
  sheet: string;
  data: ExcelCell[][];
}

interface ParsedDay {
  label: string;
  date: string;
}

interface GameBlock {
  headerRow: number;
  startCol: number;
  totalCol: number;
  resultRow: number | null;
  nextHeaderRow: number;
  day: ParsedDay;
}

const SHEETS = {
  palpites: ["bolao - palpites", "bolao palpites", "palpites"],
  pagamento: ["bolao - pagamento", "bolao pagamento", "pagamento", "pagamentos"],
  ranking: ["ranking"]
};

const DEFAULT_YEAR = 2026;

const TEAM_NAMES: Record<string, string> = {
  AFS: "África do Sul",
  AGL: "Argélia",
  ALG: "Argélia",
  ALE: "Alemanha",
  ARA: "Arábia Saudita",
  ARG: "Argentina",
  AUS: "Austrália",
  "ÁUS": "Áustria",
  BEL: "Bélgica",
  BOS: "Bósnia",
  BRA: "Brasil",
  CAB: "Cabo Verde",
  CAN: "Canadá",
  CAT: "Catar",
  COL: "Colômbia",
  COM: "Costa do Marfim",
  COR: "Coreia do Sul",
  CRO: "Croácia",
  CUR: "Curaçao",
  EGI: "Egito",
  EQU: "Equador",
  ESC: "Escócia",
  ESP: "Espanha",
  EUA: "Estados Unidos",
  FRA: "França",
  GAN: "Gana",
  HAI: "Haiti",
  HOL: "Holanda",
  ING: "Inglaterra",
  "IRÃ": "Irã",
  IRA: "Irã",
  IRQ: "Iraque",
  JAP: "Japão",
  JOR: "Jordânia",
  MAR: "Marrocos",
  "MÉX": "México",
  MEX: "México",
  NOR: "Noruega",
  NZL: "Nova Zelândia",
  PAN: "Panamá",
  PAR: "Paraguai",
  POR: "Portugal",
  RDC: "RD Congo",
  SEN: "Senegal",
  SUE: "Suécia",
  SUI: "Suíça",
  TCH: "Tchéquia",
  TUN: "Tunísia",
  TUR: "Turquia",
  URU: "Uruguai",
  UZB: "Uzbequistão"
};

function text(cell: ExcelCell): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

function isDate(cell: ExcelCell): cell is Date {
  return cell instanceof Date && !Number.isNaN(cell.getTime());
}

function formatDateCell(cell: ExcelCell): string | null {
  if (isDate(cell)) {
    if (cell.getUTCFullYear() < 1900) return null;
    return `${cell.getUTCFullYear()}-${String(cell.getUTCMonth() + 1).padStart(2, "0")}-${String(cell.getUTCDate()).padStart(2, "0")}`;
  }

  const value = text(cell);
  const brDate = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (brDate) {
    const year = brDate[3] ? normalizeYear(brDate[3]) : DEFAULT_YEAR;
    return `${year}-${String(brDate[2]).padStart(2, "0")}-${String(brDate[1]).padStart(2, "0")}`;
  }

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return isoDate ? `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}` : null;
}

function formatTimeCell(cell: ExcelCell): string {
  if (isDate(cell)) {
    return `${String(cell.getUTCHours()).padStart(2, "0")}:${String(cell.getUTCMinutes()).padStart(2, "0")}`;
  }
  const value = text(cell);
  const match = value.match(/(\d{1,2})[:hH](\d{2})/);
  return match ? `${String(match[1]).padStart(2, "0")}:${match[2]}` : "";
}

function parseDay(cell: ExcelCell): ParsedDay | null {
  const value = text(cell);
  const match = value.match(/DIA\s+(\d+)\s*-\s*(\d{1,2})\/(\d{1,2})/i);
  if (!match) return null;
  const day = match[1];
  const date = `${DEFAULT_YEAR}-${String(match[3]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
  return { label: `Dia ${day}`, date };
}

function parseScore(value: ExcelCell | string | null | undefined): string | null {
  const match = text(value as ExcelCell).match(/(\d{1,2})\s*[xX-]\s*(\d{1,2})/);
  return match ? `${Number(match[1])}x${Number(match[2])}` : null;
}

function isGameAbbreviation(cell: ExcelCell): boolean {
  return /^[\p{L}]{2,5}\s*x\s*[\p{L}]{2,5}$/iu.test(text(cell));
}

function splitGame(abreviacao: string): { mandante: string; visitante: string } {
  const match = abreviacao.match(/^([\p{L}]{2,5})\s*(?:x|-)\s*([\p{L}]{2,5})$/iu);
  const homeRaw = match?.[1] ?? abreviacao;
  const awayRaw = match?.[2] ?? "";
  const home = homeRaw.toUpperCase();
  const away = awayRaw.toUpperCase();
  return {
    mandante: TEAM_NAMES[home] ?? homeRaw,
    visitante: TEAM_NAMES[away] ?? awayRaw
  };
}

function slug(value: string): string {
  return normalizarTexto(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeYear(year: string): number {
  const numeric = Number(year);
  return numeric < 100 ? 2000 + numeric : numeric;
}

function isParticipantName(value: string): boolean {
  const normalized = normalizarTexto(value);
  if (!normalized) return false;
  if (/^dia\s+\d+/.test(normalized)) return false;
  return !["resultado", "total", "meus palpites nicolas", "sabado", "sábado", "domingo", "segunda", "terca", "terça", "quarta", "quinta", "sexta"].includes(normalized);
}

function parsePointCravadas(value: ExcelCell): { pontos: number; cravadas: number } {
  if (typeof value === "number") return { pontos: value, cravadas: 0 };
  const match = text(value).match(/(-?\d+)\s*\((\d+)\)/);
  if (match) return { pontos: Number(match[1]), cravadas: Number(match[2]) };
  const number = Number(text(value).replace(",", "."));
  return { pontos: Number.isFinite(number) ? number : 0, cravadas: 0 };
}

function toNumber(value: ExcelCell): number {
  if (typeof value === "number") return value;
  const parsed = Number(text(value).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sheetKey(value: string): string {
  return normalizarTexto(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function findSheet(sheets: ExcelSheet[], expected: readonly string[]): ExcelSheet | null {
  const aliases = expected.map(sheetKey);
  return sheets.find((sheet) => aliases.includes(sheetKey(sheet.sheet))) ?? null;
}

function findBlockHeaderRow(rows: ExcelCell[][], dayCell: { row: number; col: number }): number {
  let bestRow = dayCell.row;
  let bestScore = 0;

  for (let rowIndex = dayCell.row; rowIndex < Math.min(rows.length, dayCell.row + 4); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const hasParticipantHeader = normalizarTexto(text(row[dayCell.col])).includes("participante") ? 2 : 0;
    const gameCount = row.slice(dayCell.col + 1).filter(isGameAbbreviation).length;
    const hasTotal = row.some((cell, colIndex) => colIndex > dayCell.col && normalizarTexto(text(cell)) === "total") ? 1 : 0;
    const score = hasParticipantHeader + gameCount * 2 + hasTotal;

    if (score > bestScore) {
      bestScore = score;
      bestRow = rowIndex;
    }
  }

  return bestRow;
}

function findDayBlocks(rows: ExcelCell[][]): GameBlock[] {
  const dayCells: Array<{ row: number; col: number; day: ParsedDay }> = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const day = parseDay(cell);
      if (day) dayCells.push({ row: rowIndex, col: colIndex, day });
    });
  });

  return dayCells
    .map((dayCell) => {
      const headerRow = findBlockHeaderRow(rows, dayCell);
      const header = rows[headerRow] ?? [];
      const gameCols: number[] = [];
      let totalCol = -1;

      for (let col = dayCell.col + 1; col < header.length; col += 1) {
        const value = normalizarTexto(text(header[col]));
        if (value === "total") {
          totalCol = col;
          break;
        }
        if (isGameAbbreviation(header[col])) gameCols.push(col);
      }

      if (totalCol < 0 && gameCols.length > 0) {
        totalCol = Math.max(...gameCols) + 1;
      }

      const nextHeaderRow =
        dayCells
          .filter((item) => item.col === dayCell.col && item.row > dayCell.row)
          .map((item) => item.row)
          .sort((a, b) => a - b)[0] ?? rows.length;

      let resultRow: number | null = null;
      for (let row = headerRow + 1; row < nextHeaderRow; row += 1) {
        if (normalizarTexto(text(rows[row]?.[dayCell.col] ?? null)) === "resultado") {
          resultRow = row;
          break;
        }
      }

      return {
        headerRow,
        startCol: dayCell.col,
        totalCol,
        resultRow,
        nextHeaderRow,
        day: dayCell.day
      };
    })
    .filter((block) => block.totalCol > block.startCol + 1);
}

function resolveParticipantName(name: string, knownNames: string[]): string {
  const normalized = normalizarTexto(name);
  const exact = knownNames.find((known) => normalizarTexto(known) === normalized);
  if (exact) return exact;

  const byPrefix = knownNames.filter((known) => normalizarTexto(known).startsWith(`${normalized} `));
  if (byPrefix.length > 0) return byPrefix[0];

  return name;
}

function parseRanking(sheet: ExcelSheet | null): RankingItem[] {
  if (!sheet) return [];
  const headerRow = sheet.data.findIndex((row) => normalizarTexto(text(row[0])) === "posicao" && normalizarTexto(text(row[1])) === "participante");
  if (headerRow < 0) return [];

  return sheet.data
    .slice(headerRow + 1)
    .map((row, index) => {
      const posicao = Number(row[0]);
      const participante = text(row[1]);
      if (!posicao || !participante) return null;
      return {
        posicao,
        participante,
        pontos: Number(row[2]) || 0,
        cravadas: Number(row[3]) || 0,
        palpites: 0,
        acertos: 0,
        aproveitamento: 0,
        ordemOriginal: index
      };
    })
    .filter((item): item is RankingItem => Boolean(item));
}

function parsePagamentos(sheet: ExcelSheet | null): Pagamento[] {
  if (!sheet) return [];
  const headerRow = sheet.data.findIndex((row) => {
    const headers = row.map((cell) => normalizarTexto(text(cell)));
    const hasParticipant = headers.some((header) => ["participante", "participantes", "nome"].some((alias) => header.includes(alias)));
    const hasPayment = headers.some((header) => ["pagou", "pago", "pix", "status"].some((alias) => header.includes(alias)));
    return hasParticipant && hasPayment;
  });
  if (headerRow < 0) return [];

  const headers = sheet.data[headerRow].map((cell) => normalizarTexto(text(cell)));
  const participanteCol = headers.findIndex((header) => ["participante", "participantes", "nome"].some((alias) => header.includes(alias)));
  const pagoCol = headers.findIndex((header) => ["pagou", "pago", "pix", "status"].some((alias) => header.includes(alias)));
  const dataCol = headers.findIndex((header) => header.includes("data"));
  const valorCol = headers.findIndex((header) => header.includes("valor"));

  if (participanteCol < 0) return [];

  return sheet.data
    .slice(headerRow + 1)
    .map((row) => {
      const participante = text(row[participanteCol]);
      if (!participante) return null;
      const paidText = pagoCol >= 0 ? normalizarTexto(text(row[pagoCol])) : "";
      const pago = ["sim", "s", "pago", "feito", "ok", "true", "1"].includes(paidText);
      const valor = valorCol >= 0 ? toNumber(row[valorCol]) : 0;
      return {
        participante,
        pago,
        dataPagamento: dataCol >= 0 ? formatDateCell(row[dataCol]) : null,
        valor: valor > 0 ? valor : PIX_INFO.valor,
        situacao: pago ? "pago" : "pendente"
      };
    })
    .filter((item): item is Pagamento => Boolean(item));
}

function parseJogosEPalpites(sheet: ExcelSheet | null, rankingNames: string[]): { jogos: Jogo[]; palpites: Palpite[] } {
  if (!sheet) return { jogos: [], palpites: [] };

  const blocks = findDayBlocks(sheet.data);
  const jogos: Jogo[] = [];
  const palpites: Palpite[] = [];

  blocks.forEach((block) => {
    const header = sheet.data[block.headerRow] ?? [];
    const timeRow = sheet.data[block.headerRow - 1] ?? [];
    const resultRow = block.resultRow !== null ? (sheet.data[block.resultRow] ?? []) : [];
    const gameCols = Array.from({ length: block.totalCol - block.startCol - 1 }, (_, index) => block.startCol + index + 1).filter((col) =>
      isGameAbbreviation(header[col])
    );

    gameCols.forEach((gameCol) => {
      const abreviacao = text(header[gameCol]).replace(/\s+/g, " ");
      const teams = splitGame(abreviacao);
      const resultado = parseScore(resultRow[gameCol]);
      const id = slug(`${block.day.label}-${abreviacao}`);

      jogos.push({
        id,
        dia: block.day.label,
        rodada: block.day.label,
        data: block.day.date,
        horario: formatTimeCell(timeRow[gameCol]),
        mandante: teams.mandante,
        visitante: teams.visitante,
        abreviacao,
        resultado,
        status: resultado ? "finalizado" : "agendado"
      });

      const stopRow = block.resultRow ?? block.nextHeaderRow;
      for (let rowIndex = block.headerRow + 1; rowIndex < stopRow; rowIndex += 1) {
        const row = sheet.data[rowIndex] ?? [];
        const rawParticipant = text(row[block.startCol]);
        const score = parseScore(row[gameCol]);
        if (!score || !isParticipantName(rawParticipant)) continue;
        const participante = resolveParticipantName(rawParticipant, rankingNames);
        const pontuacao = calcularPontuacao(score, resultado);
        palpites.push({
          jogoId: id,
          participante,
          palpite: score,
          ...pontuacao
        });
      }
    });
  });

  const uniqueGames = new Map<string, Jogo>();
  jogos.forEach((jogo) => uniqueGames.set(jogo.id, jogo));

  return { jogos: Array.from(uniqueGames.values()), palpites };
}

function completeRanking(ranking: RankingItem[], palpites: Palpite[], jogos: Jogo[]): RankingItem[] {
  const finalizedGames = Math.max(1, jogos.filter((jogo) => jogo.resultado).length);
  const byParticipant = new Map<string, Palpite[]>();
  palpites.forEach((palpite) => {
    const key = normalizarTexto(palpite.participante);
    byParticipant.set(key, [...(byParticipant.get(key) ?? []), palpite]);
  });

  if (ranking.length > 0) {
    return ranking.map((item) => {
      const participantBets = byParticipant.get(normalizarTexto(item.participante)) ?? [];
      const acertos = participantBets.filter((palpite) => palpite.pontos > 0).length;
      return {
        ...item,
        palpites: participantBets.length,
        acertos,
        aproveitamento: (item.pontos / (finalizedGames * 5)) * 100
      };
    });
  }

  const names = Array.from(byParticipant.keys());
  return names
    .map((key, index) => {
      const participantBets = byParticipant.get(key) ?? [];
      const pontos = participantBets.reduce((total, palpite) => total + palpite.pontos, 0);
      const cravadas = participantBets.filter((palpite) => palpite.cravada).length;
      return {
        posicao: 0,
        participante: participantBets[0]?.participante ?? key,
        pontos,
        cravadas,
        palpites: participantBets.length,
        acertos: participantBets.filter((palpite) => palpite.pontos > 0).length,
        aproveitamento: (pontos / (finalizedGames * 5)) * 100,
        ordemOriginal: index
      };
    })
    .sort((a, b) => b.pontos - a.pontos || b.cravadas - a.cravadas || a.ordemOriginal - b.ordemOriginal)
    .map((item, index) => ({ ...item, posicao: index + 1 }));
}

function buildParticipantes(ranking: RankingItem[], pagamentos: Pagamento[]): Participante[] {
  return ranking.map((item) => {
    const pagamento = pagamentos.find((pag) => normalizarTexto(pag.participante) === normalizarTexto(item.participante));
    return {
      nome: item.participante,
      posicao: item.posicao,
      pontos: item.pontos,
      cravadas: item.cravadas,
      palpitesEnviados: item.palpites,
      acertos: item.acertos,
      aproveitamento: item.aproveitamento,
      pagamento: pagamento?.situacao ?? "pendente",
      dataPix: pagamento?.dataPagamento ?? null
    };
  });
}

function buildParticipanteDetalhe(data: DashboardData, nome: string): ParticipanteDetalhe | null {
  const participante = data.participantes.find((item) => normalizarTexto(item.nome) === normalizarTexto(nome));
  if (!participante) return null;

  const palpites = data.palpites.filter((palpite) => normalizarTexto(palpite.participante) === normalizarTexto(participante.nome));
  const jogosComPalpite = new Set(palpites.map((palpite) => palpite.jogoId));
  return {
    ...participante,
    palpites,
    jogosSemPalpite: data.jogos.filter((jogo) => !jogosComPalpite.has(jogo.id))
  };
}

function normalizeWorkbook(raw: unknown): ExcelSheet[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const sheet = "sheet" in item ? String(item.sheet) : "";
      const data = "data" in item && Array.isArray(item.data) ? item.data : [];
      return { sheet, data } as ExcelSheet;
    })
    .filter((item): item is ExcelSheet => Boolean(item?.sheet));
}

function buildDashboardFromSheets(sheets: ExcelSheet[]): DashboardData {
  const rankingSheet = findSheet(sheets, SHEETS.ranking);
  const pagamentoSheet = findSheet(sheets, SHEETS.pagamento);
  const palpitesSheet = findSheet(sheets, SHEETS.palpites);

  const rankingBase = parseRanking(rankingSheet);
  const rankingNames = rankingBase.map((item) => item.participante);
  const pagamentos = parsePagamentos(pagamentoSheet);
  const { jogos, palpites } = parseJogosEPalpites(palpitesSheet, rankingNames);
  const ranking = completeRanking(rankingBase, palpites, jogos);
  const participantes = buildParticipantes(ranking, pagamentos);
  const pagos = pagamentos.filter((pagamento) => pagamento.pago);
  const pendentes = pagamentos.filter((pagamento) => !pagamento.pago);

  return {
    participantes,
    ranking,
    jogos,
    palpites,
    pagamentos,
    resumo: {
      totalParticipantes: participantes.length,
      jogosFinalizados: jogos.filter((jogo) => jogo.status === "finalizado").length,
      jogosPendentes: jogos.filter((jogo) => jogo.status !== "finalizado").length,
      totalCravadas: palpites.filter((palpite) => palpite.cravada).length,
      pagamentosConfirmados: pagos.length,
      valorArrecadado: pagos.reduce((total, pagamento) => total + pagamento.valor, 0),
      valorPendente: pendentes.reduce((total, pagamento) => total + pagamento.valor, 0)
    },
    ultimaAtualizacao: new Date().toISOString()
  };
}

export async function parseExcelDashboard(file: Blob): Promise<DashboardData> {
  const sheets = normalizeWorkbook(await readWorkbook(file));
  return buildDashboardFromSheets(sheets);
}

export async function loadExcelDashboard(excelUrl: string): Promise<DashboardData> {
  const response = await fetch(excelUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Erro ${response.status} ao carregar a planilha Excel.`);
  const blob = await response.blob();
  return parseExcelDashboard(blob);
}

export function getExcelAction<T>(data: DashboardData, action: string): T | null {
  const [baseAction, queryString] = action.split("?");
  const params = new URLSearchParams(queryString ?? "");

  const response =
    baseAction === "dashboard"
      ? data
      : baseAction === "ranking"
        ? data.ranking
        : baseAction === "jogos"
          ? data.jogos
          : baseAction === "palpites"
            ? data.palpites
            : baseAction === "pagamentos"
              ? data.pagamentos
              : baseAction === "participantes"
                ? data.participantes
                : baseAction === "participante"
                  ? buildParticipanteDetalhe(data, params.get("nome") ?? "")
                  : null;

  return response as T | null;
}
