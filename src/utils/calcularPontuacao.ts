import type { ResultadoPontuacao } from "../types";

interface Placar {
  casa: number;
  fora: number;
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

export function calcularPontuacao(palpite: string, resultado: string | null | undefined): ResultadoPontuacao {
  const resultadoParsed = parsePlacar(resultado);
  const palpiteParsed = parsePlacar(palpite);

  if (!resultadoParsed || !palpiteParsed) {
    return { pontos: 0, cravada: false, tipo: "pendente" };
  }

  if (palpiteParsed.casa === resultadoParsed.casa && palpiteParsed.fora === resultadoParsed.fora) {
    return { pontos: 5, cravada: true, tipo: "exato" };
  }

  const sinalPalpite = sinal(palpiteParsed);
  const sinalResultado = sinal(resultadoParsed);

  if (sinalPalpite === "empate" && sinalResultado === "empate") {
    return { pontos: 2, cravada: false, tipo: "empate" };
  }

  if (sinalPalpite === sinalResultado) {
    return { pontos: 2, cravada: false, tipo: "vencedor" };
  }

  return { pontos: 0, cravada: false, tipo: "erro" };
}
