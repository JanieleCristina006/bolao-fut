import { APP_NAME, PONTUACAO_LABELS } from "../constants";
import type { Jogo, Palpite } from "../types";
import { formatarData, formatarDataHora } from "./formatadores";

export interface TabelaImagem {
  titulo: string;
  subtitulo?: string;
  colunas: Array<{ titulo: string; largura: number }>;
  linhas: string[][];
  nomeArquivo: string;
}

const CANVAS_WIDTH = 1400;
const CANVAS_MAX_HEIGHT = 16000;
const MARGIN = 56;
const HEADER_HEIGHT = 150;
const TABLE_HEADER_HEIGHT = 54;
const FOOTER_HEIGHT = 52;
const CELL_PADDING = 12;
const LINE_HEIGHT = 24;

export function nomeSeguro(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function quebrarTexto(contexto: CanvasRenderingContext2D, texto: string, larguraMaxima: number): string[] {
  const palavras = String(texto || "-").split(/\s+/);
  const linhas: string[] = [];
  let linha = "";

  palavras.forEach((palavra) => {
    const candidata = linha ? `${linha} ${palavra}` : palavra;
    if (contexto.measureText(candidata).width <= larguraMaxima || !linha) {
      linha = candidata;
      return;
    }
    linhas.push(linha);
    linha = palavra;
  });

  if (linha) linhas.push(linha);
  return linhas.length ? linhas : ["-"];
}

function largurasColunas(colunas: TabelaImagem["colunas"]): number[] {
  const larguraUtil = CANVAS_WIDTH - MARGIN * 2;
  return colunas.map((coluna) => larguraUtil * coluna.largura);
}

function alturaLinha(
  contexto: CanvasRenderingContext2D,
  linha: string[],
  larguras: number[]
): number {
  const maiorQuantidadeDeLinhas = Math.max(
    1,
    ...linha.map((celula, indice) => quebrarTexto(contexto, celula, larguras[indice] - CELL_PADDING * 2).length)
  );
  return maiorQuantidadeDeLinhas * LINE_HEIGHT + CELL_PADDING * 2;
}

function separarPaginas(
  contexto: CanvasRenderingContext2D,
  linhas: string[][],
  larguras: number[]
): string[][][] {
  const limite = CANVAS_MAX_HEIGHT - HEADER_HEIGHT - TABLE_HEADER_HEIGHT - FOOTER_HEIGHT - MARGIN;
  const paginas: string[][][] = [];
  let paginaAtual: string[][] = [];
  let alturaAtual = 0;

  linhas.forEach((linha) => {
    const altura = alturaLinha(contexto, linha, larguras);
    if (paginaAtual.length && alturaAtual + altura > limite) {
      paginas.push(paginaAtual);
      paginaAtual = [];
      alturaAtual = 0;
    }
    paginaAtual.push(linha);
    alturaAtual += altura;
  });

  if (paginaAtual.length) paginas.push(paginaAtual);
  return paginas.length ? paginas : [[Array(larguras.length).fill("-")]];
}

function desenharPagina(
  tabela: TabelaImagem,
  linhas: string[][],
  numeroPagina: number,
  totalPaginas: number,
  larguras: number[],
  contextoMedicao: CanvasRenderingContext2D
): HTMLCanvasElement {
  const alturas = linhas.map((linha) => alturaLinha(contextoMedicao, linha, larguras));
  const altura = HEADER_HEIGHT + TABLE_HEADER_HEIGHT + alturas.reduce((total, item) => total + item, 0) + FOOTER_HEIGHT + MARGIN;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = altura;

  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível preparar a imagem.");

  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, canvas.width, canvas.height);

  contexto.fillStyle = "#0f172a";
  contexto.font = "700 30px Inter, Arial, sans-serif";
  contexto.fillText(APP_NAME, MARGIN, 52);

  contexto.fillStyle = "#d90429";
  contexto.font = "700 24px Inter, Arial, sans-serif";
  contexto.fillText(tabela.titulo, MARGIN, 88);

  contexto.fillStyle = "#64748b";
  contexto.font = "400 17px Inter, Arial, sans-serif";
  if (tabela.subtitulo) contexto.fillText(tabela.subtitulo, MARGIN, 116);
  contexto.fillText(`Gerado em ${formatarDataHora(new Date().toISOString())}`, MARGIN, 140);

  let y = HEADER_HEIGHT;
  contexto.fillStyle = "#d90429";
  contexto.fillRect(MARGIN, y, CANVAS_WIDTH - MARGIN * 2, TABLE_HEADER_HEIGHT);
  contexto.font = "700 18px Inter, Arial, sans-serif";
  contexto.fillStyle = "#ffffff";
  contexto.textBaseline = "middle";

  let x = MARGIN;
  tabela.colunas.forEach((coluna, indice) => {
    contexto.fillText(coluna.titulo, x + CELL_PADDING, y + TABLE_HEADER_HEIGHT / 2, larguras[indice] - CELL_PADDING * 2);
    x += larguras[indice];
  });

  y += TABLE_HEADER_HEIGHT;
  contexto.font = "400 17px Inter, Arial, sans-serif";
  contexto.textBaseline = "top";

  linhas.forEach((linha, indiceLinha) => {
    const altura = alturas[indiceLinha];
    contexto.fillStyle = indiceLinha % 2 === 0 ? "#ffffff" : "#f8fafc";
    contexto.fillRect(MARGIN, y, CANVAS_WIDTH - MARGIN * 2, altura);
    contexto.strokeStyle = "#e2e8f0";
    contexto.strokeRect(MARGIN, y, CANVAS_WIDTH - MARGIN * 2, altura);

    x = MARGIN;
    linha.forEach((celula, indiceColuna) => {
      contexto.fillStyle = "#1e293b";
      const linhasCelula = quebrarTexto(contexto, celula, larguras[indiceColuna] - CELL_PADDING * 2);
      linhasCelula.forEach((texto, indiceTexto) => {
        contexto.fillText(texto, x + CELL_PADDING, y + CELL_PADDING + indiceTexto * LINE_HEIGHT);
      });
      x += larguras[indiceColuna];
    });

    y += altura;
  });

  contexto.fillStyle = "#64748b";
  contexto.font = "400 15px Inter, Arial, sans-serif";
  contexto.textBaseline = "alphabetic";
  contexto.fillText(APP_NAME, MARGIN, canvas.height - 22);
  contexto.textAlign = "right";
  contexto.fillText(`Página ${numeroPagina} de ${totalPaginas}`, CANVAS_WIDTH - MARGIN, canvas.height - 22);

  return canvas;
}

export function baixarTabelaComoImagem(tabela: TabelaImagem): void {
  const canvasMedicao = document.createElement("canvas");
  const contextoMedicao = canvasMedicao.getContext("2d");
  if (!contextoMedicao) throw new Error("Não foi possível preparar a imagem.");
  contextoMedicao.font = "400 17px Inter, Arial, sans-serif";

  const larguras = largurasColunas(tabela.colunas);
  const paginas = separarPaginas(contextoMedicao, tabela.linhas, larguras);

  paginas.forEach((linhas, indice) => {
    const canvas = desenharPagina(tabela, linhas, indice + 1, paginas.length, larguras, contextoMedicao);
    const link = document.createElement("a");
    const sufixo = paginas.length > 1 ? `-pagina-${indice + 1}` : "";
    link.download = `${tabela.nomeArquivo}${sufixo}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}

export function gerarImagemPalpitesDeJogo(jogo: Jogo, palpites: Palpite[]): void {
  baixarTabelaComoImagem({
    titulo: `${jogo.mandante} x ${jogo.visitante}`,
    subtitulo: `${formatarData(jogo.data)} às ${jogo.horario} | Resultado: ${jogo.resultado ?? "pendente"}`,
    colunas: [
      { titulo: "Participante", largura: 0.4 },
      { titulo: "Palpite", largura: 0.18 },
      { titulo: "Pontos", largura: 0.14 },
      { titulo: "Tipo", largura: 0.28 }
    ],
    linhas: palpites.map((palpite) => [
      palpite.participante,
      palpite.palpite || "-",
      String(palpite.pontos),
      PONTUACAO_LABELS[palpite.tipo]
    ]),
    nomeArquivo: `palpites-${nomeSeguro(jogo.id)}`
  });
}
