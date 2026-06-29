import type { ResultadoPontuacao } from "../types";

interface Placar {
  casa: number;
  fora: number;
}

interface CalcularPontuacaoOptions {
  fase?: "grupos" | "mata-mata";
  especial?: boolean;
  classificadoPalpite?: string | null;
  classificadoOficial?: string | null;
}

const placarRegex = /(\d{1,2})\s*[xX-]\s*(\d{1,2})/;

function parsePlacar(valor: string | null | undefined): Placar | null {
  if (!valor) return null;
  const match = valor.trim().match(placarRegex);
  if (!match) return null;
  return {
    casa: Number(match[1]),
    fora: Number(match[2])
  };
}

function sinal(placar: Placar): "casa" | "fora" | "empate" {
  if (placar.casa > placar.fora) return "casa";
  if (placar.fora > placar.casa) return "fora";
  return "empate";
}

function normalizarNome(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function calcularPontuacao(
  palpite: string,
  resultado: string | null | undefined,
  options: CalcularPontuacaoOptions = {}
): ResultadoPontuacao {
  const resultadoParsed = parsePlacar(resultado);
  const palpiteParsed = parsePlacar(palpite);
  const isMataMata = options.fase === "mata-mata";
  const pontosExato = isMataMata ? (options.especial ? 25 : 20) : 5;
  const pontosParcial = isMataMata ? (options.especial ? 15 : 10) : 2;
  const classificadoCorreto =
    isMataMata &&
    Boolean(normalizarNome(options.classificadoPalpite)) &&
    normalizarNome(options.classificadoPalpite) === normalizarNome(options.classificadoOficial);
  const bonusClassificado = classificadoCorreto ? 5 : 0;

  if (!resultadoParsed) {
    return { pontos: 0, cravada: false, tipo: "pendente", pontosPlacar: 0, bonusClassificado: 0, classificadoCorreto: false };
  }

  if (!palpiteParsed) {
    return {
      pontos: bonusClassificado,
      cravada: false,
      tipo: bonusClassificado > 0 ? "classificado" : "pendente",
      pontosPlacar: 0,
      bonusClassificado,
      classificadoCorreto
    };
  }

  if (palpiteParsed.casa === resultadoParsed.casa && palpiteParsed.fora === resultadoParsed.fora) {
    return {
      pontos: pontosExato + bonusClassificado,
      cravada: true,
      tipo: "exato",
      pontosPlacar: pontosExato,
      bonusClassificado,
      classificadoCorreto
    };
  }

  const sinalPalpite = sinal(palpiteParsed);
  const sinalResultado = sinal(resultadoParsed);

  if (sinalPalpite === "empate" && sinalResultado === "empate") {
    return {
      pontos: pontosParcial + bonusClassificado,
      cravada: false,
      tipo: "empate",
      pontosPlacar: pontosParcial,
      bonusClassificado,
      classificadoCorreto
    };
  }

  if (sinalPalpite === sinalResultado) {
    return {
      pontos: pontosParcial + bonusClassificado,
      cravada: false,
      tipo: "vencedor",
      pontosPlacar: pontosParcial,
      bonusClassificado,
      classificadoCorreto
    };
  }

  return {
    pontos: bonusClassificado,
    cravada: false,
    tipo: bonusClassificado > 0 ? "classificado" : "erro",
    pontosPlacar: 0,
    bonusClassificado,
    classificadoCorreto
  };
}
