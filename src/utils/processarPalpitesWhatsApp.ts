import type { Jogo, Palpite, Participante } from "../types";
import type {
  ImportacaoPalpiteItem,
  PalpiteProcessado,
  ProcessarPalpitesWhatsAppOptions,
  ResultadoImportacaoPalpites,
  StatusImportacaoPalpite
} from "../types/importacaoPalpites";
import { dataCurtaDeIso, limparEspacos, normalizarChave, normalizarTexto } from "./normalizarTexto.js";

interface BlocoParticipante {
  id: number;
  participanteTexto: string;
  participanteOficial?: string;
  participanteValido: boolean;
  data: string | null;
  itens: ImportacaoPalpiteItem[];
  avisos: string[];
}

interface PalpiteLinha {
  timeCasa: string;
  timeFora: string;
  golsCasa: number;
  golsFora: number;
}

interface ResultadoJogo {
  tipo: "direto" | "invertido" | "ambiguous" | "nenhum";
  jogo?: Jogo;
  mensagem?: string;
}

const SCORE_PATTERN = "(\\d{1,2})\\s*(?:[xX]|-|a)\\s*(\\d{1,2})";
const SCORE_REGEX = new RegExp(SCORE_PATTERN, "i");
const PALPITE_REGEX = new RegExp(`^(.+?)\\s+${SCORE_PATTERN}\\s+(.+)$`, "i");
const PARTICIPANTE_REGEX = /meus\s+palpites\s*\(([^)]+)\)/i;
const TIME_ALIASES = [
  ["africa do sul", "afs"],
  ["argelia", "agl", "alg"],
  ["alemanha", "ale"],
  ["arabia saudita", "ara"],
  ["argentina", "arg"],
  ["australia", "aus"],
  ["austria", "aut"],
  ["belgica", "bel"],
  ["bosnia", "bos"],
  ["brasil", "bra"],
  ["cabo verde", "cab"],
  ["canada", "can"],
  ["catar", "cat"],
  ["colombia", "col"],
  ["coreia do sul", "cor"],
  ["costa do marfim", "com"],
  ["croacia", "cro"],
  ["curacao", "cur"],
  ["egito", "egi"],
  ["equador", "equ"],
  ["escocia", "esc"],
  ["espanha", "esp"],
  ["estados unidos", "eua"],
  ["franca", "fra"],
  ["gana", "gan"],
  ["haiti", "hai"],
  ["holanda", "hol"],
  ["inglaterra", "ing"],
  ["ira", "ira"],
  ["iraque", "irq"],
  ["japao", "jap"],
  ["jordania", "jor"],
  ["marrocos", "mar"],
  ["mexico", "mex"],
  ["noruega", "nor"],
  ["nova zelandia", "nzl"],
  ["panama", "pan"],
  ["paraguai", "par"],
  ["portugal", "por"],
  ["rd congo", "rdc", "republica democratica do congo"],
  ["senegal", "sen", "senagal"],
  ["suecia", "sue"],
  ["suica", "sui"],
  ["tchequia", "tch", "republica tcheca"],
  ["tunisia", "tun"],
  ["turquia", "tur"],
  ["uruguai", "uru"],
  ["uzbequistao", "uzb"]
].map((aliases) => aliases.map((alias) => normalizarChave(alias)));

function pad2(valor: string | number): string {
  return String(valor).padStart(2, "0");
}

function dataCurtaDeTexto(texto: string): string | null {
  const match = texto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!match) return null;
  return `${pad2(match[1])}/${pad2(match[2])}`;
}

function limparLinhaWhatsApp(linha: string): string {
  let texto = linha.replace(/[\u200e\u200f]/g, "").trim();

  texto = texto.replace(/^\[\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]\s*/i, "");
  texto = texto.replace(/^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s+-\s*/i, "");
  texto = texto.replace(/^\+?\d[\d\s().-]{7,}\s*[-:]\s*/i, "");

  if (PARTICIPANTE_REGEX.test(texto) || SCORE_REGEX.test(texto)) {
    texto = texto.replace(/^[^:]{2,80}:\s+/, "");
  }

  return limparEspacos(texto);
}

function deveIgnorarLinha(linha: string): boolean {
  const normalizada = normalizarTexto(linha);
  if (!normalizada) return true;
  if (/^jogo\s+dia\b/.test(normalizada)) return true;
  if (/^hoje+$/.test(normalizada)) return true;
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(linha)) return true;
  if (/^\+?\d[\d\s().-]{7,}$/.test(linha)) return true;
  return false;
}

function extrairParticipante(linha: string): string | null {
  const match = linha.match(PARTICIPANTE_REGEX);
  return match ? limparEspacos(match[1]) : null;
}

function interpretarLinhaPalpite(linha: string): PalpiteLinha | null {
  const match = linha.match(PALPITE_REGEX);
  if (!match) return null;

  const timeCasa = limparEspacos(match[1]);
  const timeFora = limparEspacos(match[4]);
  const golsCasa = Number(match[2]);
  const golsFora = Number(match[3]);

  if (!timeCasa || !timeFora || Number.isNaN(golsCasa) || Number.isNaN(golsFora)) return null;
  return { timeCasa, timeFora, golsCasa, golsFora };
}

function parecePalpiteComFormatoInvalido(linha: string): boolean {
  if (SCORE_REGEX.test(linha)) return false;
  return /\d{1,2}\s*(?:[xX-]|\ba\b)/i.test(linha) || /(?:[xX-]|\ba\b)\s*\d{1,2}/i.test(linha);
}

function encontrarParticipante(nome: string, participantes: Participante[]): Participante | undefined {
  const chave = normalizarChave(nome);
  return participantes.find((participante) => normalizarChave(participante.nome) === chave);
}

function dataCompativel(jogo: Jogo, data: string | null): boolean {
  if (!data) return true;
  const dataJogo = dataCurtaDeIso(jogo.data);
  if (!dataJogo) return true;
  return dataJogo === data;
}

function ehSiglaAustria(valor: string | undefined): boolean {
  return /^\s*\u00C1US\s*$/i.test(String(valor ?? ""));
}

function aliasesDoTime(nome: string, sigla?: string): Set<string> {
  const nomeChave = ehSiglaAustria(nome) ? "austria" : normalizarChave(nome);
  const siglaChave = ehSiglaAustria(sigla) ? "austria" : normalizarChave(sigla);
  const chaves = new Set([nomeChave]);

  TIME_ALIASES.forEach((aliases) => {
    if (aliases.includes(nomeChave)) {
      aliases.forEach((alias) => chaves.add(alias));
    }
  });

  if (siglaChave && nomeChave.length <= 3) {
    chaves.add(siglaChave);
    TIME_ALIASES.forEach((aliases) => {
      if (aliases.includes(siglaChave)) {
        aliases.forEach((alias) => chaves.add(alias));
      }
    });
  }

  chaves.delete("");
  return chaves;
}

function siglasDaAbreviacao(abreviacao: string): [string, string] {
  const [casa = "", fora = ""] = abreviacao.split(/\s*(?:x|-)\s*/i).map(limparEspacos);
  return [casa, fora];
}

function timesEquivalentes(timePalpite: string, timeJogo: string, siglaJogo?: string): boolean {
  const aliasesPalpite = aliasesDoTime(timePalpite);
  const aliasesJogo = aliasesDoTime(timeJogo, siglaJogo);
  return [...aliasesPalpite].some((alias) => aliasesJogo.has(alias));
}

function jogoEquivalente(palpite: PalpiteLinha, jogo: Jogo, invertido = false): boolean {
  const [siglaCasa, siglaFora] = siglasDaAbreviacao(jogo.abreviacao);
  const casaJogo = invertido ? jogo.visitante : jogo.mandante;
  const foraJogo = invertido ? jogo.mandante : jogo.visitante;
  const siglaCasaJogo = invertido ? siglaFora : siglaCasa;
  const siglaForaJogo = invertido ? siglaCasa : siglaFora;

  return (
    timesEquivalentes(palpite.timeCasa, casaJogo, siglaCasaJogo) &&
    timesEquivalentes(palpite.timeFora, foraJogo, siglaForaJogo)
  );
}

function encontrarJogo(palpite: PalpiteLinha, data: string | null, jogos: Jogo[]): ResultadoJogo {
  const diretos = jogos.filter((jogo) => jogoEquivalente(palpite, jogo));
  const diretosNaData = diretos.filter((jogo) => dataCompativel(jogo, data));

  if (diretosNaData.length === 1) return { tipo: "direto", jogo: diretosNaData[0] };
  if (diretosNaData.length > 1) return { tipo: "ambiguous", mensagem: "Mais de um jogo encontrado para esses times." };
  if (!data && diretos.length === 1) return { tipo: "direto", jogo: diretos[0] };

  const invertidos = jogos.filter((jogo) => jogoEquivalente(palpite, jogo, true));
  const invertidosNaData = invertidos.filter((jogo) => dataCompativel(jogo, data));

  if (invertidosNaData.length > 0) {
    return {
      tipo: "invertido",
      jogo: invertidosNaData[0],
      mensagem: "Times encontrados em ordem invertida. Confira antes de importar."
    };
  }

  if (diretos.length > 0 && data) {
    return { tipo: "nenhum", mensagem: "Jogo encontrado com esses times, mas em outra data." };
  }

  return { tipo: "nenhum", mensagem: "Jogo não encontrado na lista cadastrada." };
}

function palpiteExistente(
  palpites: Palpite[],
  participanteOficial: string | undefined,
  jogoId: string | undefined
): Palpite | undefined {
  if (!participanteOficial || !jogoId) return undefined;
  const participanteKey = normalizarChave(participanteOficial);
  return palpites.find((palpite) => palpite.jogoId === jogoId && normalizarChave(palpite.participante) === participanteKey);
}

function statusComErros(erros: string[], fallback: StatusImportacaoPalpite): StatusImportacaoPalpite {
  if (erros.some((erro) => /participante/i.test(erro))) return "participante-nao-encontrado";
  if (erros.some((erro) => /invertida/i.test(erro))) return "times-invertidos";
  if (erros.some((erro) => /jogo/i.test(erro))) return "jogo-nao-encontrado";
  return fallback;
}

function criarItemValidoOuInvalidado(
  palpite: PalpiteLinha,
  linhaOriginal: string,
  linha: number,
  bloco: BlocoParticipante,
  options: ProcessarPalpitesWhatsAppOptions
): ImportacaoPalpiteItem {
  const participante = encontrarParticipante(bloco.participanteTexto, options.participantes);
  const participanteOficial = participante?.nome;
  const resultadoJogo = encontrarJogo(palpite, bloco.data, options.jogos);
  const jogo = resultadoJogo.tipo === "direto" ? resultadoJogo.jogo : undefined;
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!participanteOficial) erros.push(`Participante não cadastrado: ${bloco.participanteTexto}.`);
  if (resultadoJogo.tipo === "invertido") {
    erros.push(resultadoJogo.mensagem ?? "Times encontrados em ordem invertida.");
  } else if (resultadoJogo.tipo !== "direto") {
    erros.push(resultadoJogo.mensagem ?? "Jogo não encontrado.");
  }

  const existente = palpiteExistente(options.palpitesExistentes ?? [], participanteOficial, jogo?.id);
  if (existente) avisos.push(`Palpite atual: ${existente.palpite}.`);

  const valido = erros.length === 0;
  const status: StatusImportacaoPalpite = valido ? (existente ? "palpite-existente" : "valido") : statusComErros(erros, "formato-invalido");

  return {
    id: `linha-${linha}-${normalizarChave(bloco.participanteTexto)}-${normalizarChave(palpite.timeCasa)}-${normalizarChave(palpite.timeFora)}`,
    participanteTexto: bloco.participanteTexto,
    participanteOficial,
    participanteValido: Boolean(participanteOficial),
    data: bloco.data,
    linha,
    linhaOriginal,
    timeCasa: palpite.timeCasa,
    timeFora: palpite.timeFora,
    golsCasa: palpite.golsCasa,
    golsFora: palpite.golsFora,
    placar: `${palpite.golsCasa}x${palpite.golsFora}`,
    jogoId: jogo?.id,
    jogoTexto: jogo ? `${jogo.mandante} x ${jogo.visitante}` : `${palpite.timeCasa} x ${palpite.timeFora}`,
    mandanteOficial: jogo?.mandante,
    visitanteOficial: jogo?.visitante,
    status,
    valido,
    importavel: valido,
    incluir: valido,
    usarNaImportacao: valido,
    duplicado: false,
    palpiteAtual: existente?.palpite ?? null,
    decisao: existente ? "manter" : "substituir",
    avisos,
    erros
  };
}

function criarItemFormatoInvalido(linhaOriginal: string, linha: number, bloco: BlocoParticipante): ImportacaoPalpiteItem {
  return {
    id: `linha-invalida-${linha}-${normalizarChave(bloco.participanteTexto)}`,
    participanteTexto: bloco.participanteTexto,
    participanteOficial: bloco.participanteOficial,
    participanteValido: bloco.participanteValido,
    data: bloco.data,
    linha,
    linhaOriginal,
    timeCasa: "",
    timeFora: "",
    golsCasa: null,
    golsFora: null,
    placar: "",
    jogoTexto: linhaOriginal,
    status: "formato-invalido",
    valido: false,
    importavel: false,
    incluir: false,
    usarNaImportacao: false,
    duplicado: false,
    decisao: "ignorar",
    avisos: [],
    erros: ["Linha com possível palpite, mas formato inválido."]
  };
}

function marcarDuplicados(itens: ImportacaoPalpiteItem[]): void {
  const grupos = new Map<string, ImportacaoPalpiteItem[]>();

  itens.forEach((item) => {
    if (!item.jogoId || item.status === "nao-enviou" || item.status === "formato-invalido") return;
    const participanteKey = normalizarChave(item.participanteOficial ?? item.participanteTexto);
    const key = `${participanteKey}::${item.jogoId}`;
    grupos.set(key, [...(grupos.get(key) ?? []), item]);
  });

  grupos.forEach((grupo) => {
    if (grupo.length < 2) return;
    grupo.forEach((item, index) => {
      item.duplicado = true;
      item.status = "duplicado";
      item.avisos = [...item.avisos, "Palpite duplicado para o mesmo participante e jogo."];
      item.usarNaImportacao = index === grupo.length - 1 && item.valido;
      item.importavel = item.valido && item.usarNaImportacao;
      if (index === grupo.length - 1) {
        item.avisos = [...item.avisos, "Por padrão, este último palpite será usado."];
      } else {
        item.avisos = [...item.avisos, "Este palpite anterior ficará fora da importação."];
        item.incluir = false;
      }
    });
  });
}

function jogosDoMesmoDia(jogos: Jogo[], data: string | null): Jogo[] {
  if (!data) return [];
  return jogos.filter((jogo) => dataCurtaDeIso(jogo.data) === data);
}

function adicionarNaoEnviados(blocos: BlocoParticipante[], jogos: Jogo[], palpitesExistentes: Palpite[]): void {
  blocos.forEach((bloco) => {
    if (!bloco.participanteOficial) return;
    const jogosEsperados = jogosDoMesmoDia(jogos, bloco.data);
    if (!jogosEsperados.length) return;

    const enviados = new Set(
      bloco.itens
        .filter((item) => item.jogoId && item.status !== "times-invertidos")
        .map((item) => item.jogoId)
    );

    jogosEsperados.forEach((jogo) => {
      if (enviados.has(jogo.id)) return;
      const existente = palpiteExistente(palpitesExistentes, bloco.participanteOficial, jogo.id);
      bloco.itens.push({
        id: `nao-enviou-${bloco.id}-${normalizarChave(bloco.participanteOficial)}-${jogo.id}`,
        participanteTexto: bloco.participanteTexto,
        participanteOficial: bloco.participanteOficial,
        participanteValido: true,
        data: bloco.data,
        timeCasa: jogo.mandante,
        timeFora: jogo.visitante,
        golsCasa: null,
        golsFora: null,
        placar: "—",
        jogoId: jogo.id,
        jogoTexto: `${jogo.mandante} x ${jogo.visitante}`,
        mandanteOficial: jogo.mandante,
        visitanteOficial: jogo.visitante,
        status: "nao-enviou",
        valido: false,
        importavel: false,
        incluir: false,
        usarNaImportacao: false,
        duplicado: false,
        palpiteAtual: existente?.palpite ?? null,
        decisao: "ignorar",
        avisos: [
          existente
            ? `Participante não enviou neste texto. Palpite atual permanece: ${existente.palpite}.`
            : "Participante não enviou palpite para este jogo."
        ],
        erros: []
      });
    });
  });
}

function montarResumo(itens: ImportacaoPalpiteItem[]): ResultadoImportacaoPalpites["resumo"] {
  return {
    total: itens.length,
    validos: itens.filter((item) => item.valido).length,
    importaveis: itens.filter((item) => item.importavel && item.incluir && item.usarNaImportacao).length,
    invalidos: itens.filter((item) => !item.valido && item.status !== "nao-enviou").length,
    duplicados: itens.filter((item) => item.duplicado).length,
    naoEnviados: itens.filter((item) => item.status === "nao-enviou").length,
    comPalpiteExistente: itens.filter((item) => Boolean(item.palpiteAtual)).length
  };
}

export function processarPalpitesWhatsApp(
  texto: string,
  options: ProcessarPalpitesWhatsAppOptions
): ResultadoImportacaoPalpites {
  const linhasIgnoradas: string[] = [];
  const erros: string[] = [];
  const blocos: BlocoParticipante[] = [];
  let dataAtual: string | null = null;
  let blocoAtual: BlocoParticipante | null = null;

  if (!texto.trim()) {
    return {
      participantes: [],
      itens: [],
      linhasIgnoradas: [],
      erros: ["Cole as mensagens do WhatsApp antes de processar."],
      resumo: montarResumo([])
    };
  }

  texto.split(/\r?\n/).forEach((linhaBruta, index) => {
    const linhaNumero = index + 1;
    const linha = limparLinhaWhatsApp(linhaBruta);
    if (!linha) return;

    const dataNaLinha = dataCurtaDeTexto(linha);
    if (/jogo\s+dia/i.test(linha) && dataNaLinha) {
      dataAtual = dataNaLinha;
      return;
    }

    const participanteTexto = extrairParticipante(linha);
    if (participanteTexto) {
      const participante = encontrarParticipante(participanteTexto, options.participantes);
      blocoAtual = {
        id: blocos.length + 1,
        participanteTexto,
        participanteOficial: participante?.nome,
        participanteValido: Boolean(participante),
        data: dataAtual,
        itens: [],
        avisos: participante ? [] : [`Participante não cadastrado: ${participanteTexto}.`]
      };
      blocos.push(blocoAtual);
      return;
    }

    if (deveIgnorarLinha(linha)) return;

    const palpite = interpretarLinhaPalpite(linha);
    if (palpite && blocoAtual) {
      const item = criarItemValidoOuInvalidado(palpite, linha, linhaNumero, blocoAtual, options);
      blocoAtual.itens.push(item);
      return;
    }

    if (blocoAtual && parecePalpiteComFormatoInvalido(linha)) {
      blocoAtual.itens.push(criarItemFormatoInvalido(linha, linhaNumero, blocoAtual));
      return;
    }

    linhasIgnoradas.push(linha);
  });

  const itensAntesDuplicados = blocos.flatMap((bloco) => bloco.itens);
  marcarDuplicados(itensAntesDuplicados);
  adicionarNaoEnviados(blocos, options.jogos, options.palpitesExistentes ?? []);
  const itens = blocos.flatMap((bloco) => bloco.itens);

  if (!blocos.length) {
    erros.push("Nenhum bloco 'Meus palpites (participante)' foi encontrado.");
  }

  const participantes: PalpiteProcessado[] = blocos.map((bloco) => ({
    participante: bloco.participanteTexto,
    participanteOficial: bloco.participanteOficial,
    data: bloco.data,
    jogos: bloco.itens,
    avisos: bloco.avisos
  }));

  return {
    participantes,
    itens,
    linhasIgnoradas,
    erros,
    resumo: montarResumo(itens)
  };
}
