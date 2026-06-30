import { APP_NAME } from "../constants";
import type { Jogo, Palpite, Participante } from "../types";
import { normalizarTexto } from "./formatadores";

export type ParticipanteImagem = Pick<Participante, "nome">;

export interface TabelaImagem {
  titulo: string;
  subtitulo?: string;
  colunas: Array<{ titulo: string; largura: number }>;
  linhas: string[][];
  tonsLinhas?: Array<"verde" | "azul" | "vermelho" | "neutro">;
  nomeArquivo: string;
}

export interface ArquivoImagem {
  nome: string;
  blob: Blob;
}

interface LinhaImagem {
  celulas: string[];
  tom?: "verde" | "azul" | "vermelho" | "neutro";
}

interface LinhaPalpiteImagem {
  participante: string;
  palpite?: Palpite;
  naoEnviou: boolean;
  tom: "verde" | "azul" | "vermelho" | "neutro";
}

const NAO_ENVIOU = "-";

export function tomDoPalpite(palpite: Palpite | undefined): "verde" | "azul" | "vermelho" | "neutro" {
  if (palpite?.tipo === "exato") return "verde";
  if (palpite?.tipo === "vencedor" || palpite?.tipo === "empate" || palpite?.tipo === "classificado") return "azul";
  if (palpite?.tipo === "erro") return "vermelho";
  return "neutro";
}

function formatarBonus(palpite: Palpite): string {
  return String(palpite.bonusClassificado ?? 0);
}

const CANVAS_WIDTH = 1400;
const CANVAS_MAX_HEIGHT = 16000;
const MARGIN = 56;
const HEADER_HEIGHT = 250;
const TABLE_HEADER_HEIGHT = 82;
const FOOTER_HEIGHT = 52;
const CELL_PADDING = 24;
const LINE_HEIGHT = 44;
const LOGO_SIZE = 128;

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
  linhas: LinhaImagem[],
  larguras: number[]
): LinhaImagem[][] {
  const limite = CANVAS_MAX_HEIGHT - HEADER_HEIGHT - TABLE_HEADER_HEIGHT - FOOTER_HEIGHT - MARGIN;
  const paginas: LinhaImagem[][] = [];
  let paginaAtual: LinhaImagem[] = [];
  let alturaAtual = 0;

  linhas.forEach((linha) => {
    const altura = alturaLinha(contexto, linha.celulas, larguras);
    if (paginaAtual.length && alturaAtual + altura > limite) {
      paginas.push(paginaAtual);
      paginaAtual = [];
      alturaAtual = 0;
    }
    paginaAtual.push(linha);
    alturaAtual += altura;
  });

  if (paginaAtual.length) paginas.push(paginaAtual);
  return paginas.length ? paginas : [[{ celulas: Array(larguras.length).fill("-"), tom: "neutro" }]];
}

function coresDaLinha(tom: LinhaImagem["tom"], indice: number): { fundo: string; borda: string; texto: string } {
  if (tom === "verde") return { fundo: "#15803d", borda: "#052e16", texto: "#ffffff" };
  if (tom === "azul") return { fundo: "#1d4ed8", borda: "#172554", texto: "#ffffff" };
  if (tom === "vermelho") return { fundo: "#b91c1c", borda: "#450a0a", texto: "#ffffff" };
  return { fundo: indice % 2 === 0 ? "#ffffff" : "#d1d5db", borda: "#334155", texto: "#000000" };
}

function carregarLogo(): Promise<HTMLImageElement | null> {
  const logoExistente = document.querySelector<HTMLImageElement>('img[src="/logo.jpg"]');
  if (logoExistente?.complete && logoExistente.naturalWidth > 0) return Promise.resolve(logoExistente);

  return new Promise((resolve) => {
    const logo = new Image();
    logo.onload = () => resolve(logo);
    logo.onerror = () => resolve(null);
    logo.src = "/logo.jpg";
  });
}

function desenharPagina(
  tabela: TabelaImagem,
  linhas: LinhaImagem[],
  numeroPagina: number,
  totalPaginas: number,
  larguras: number[],
  contextoMedicao: CanvasRenderingContext2D,
  logo: HTMLImageElement | null
): HTMLCanvasElement {
  const alturas = linhas.map((linha) => alturaLinha(contextoMedicao, linha.celulas, larguras));
  const altura = HEADER_HEIGHT + TABLE_HEADER_HEIGHT + alturas.reduce((total, item) => total + item, 0) + FOOTER_HEIGHT + MARGIN;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = altura;

  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível preparar a imagem.");

  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, canvas.width, canvas.height);

  if (logo) {
    contexto.save();
    contexto.beginPath();
    contexto.roundRect(MARGIN, 34, LOGO_SIZE, LOGO_SIZE, 18);
    contexto.clip();
    contexto.drawImage(logo, MARGIN, 34, LOGO_SIZE, LOGO_SIZE);
    contexto.restore();
  }

  const inicioTexto = logo ? MARGIN + LOGO_SIZE + 26 : MARGIN;
  contexto.fillStyle = "#475569";
  contexto.font = "800 29px Inter, Arial, sans-serif";
  contexto.fillText(APP_NAME, inicioTexto, 70);

  contexto.fillStyle = "#0f172a";
  contexto.font = "900 64px Inter, Arial, sans-serif";
  const linhasTitulo = quebrarTexto(contexto, tabela.titulo, CANVAS_WIDTH - inicioTexto - MARGIN);
  linhasTitulo.slice(0, 2).forEach((texto, indice) => {
    contexto.fillText(texto, inicioTexto, 138 + indice * 62);
  });

  if (tabela.subtitulo) {
    contexto.fillStyle = "#475569";
    contexto.font = "700 22px Inter, Arial, sans-serif";
    contexto.fillText(tabela.subtitulo, inicioTexto, 228);
  }

  let y = HEADER_HEIGHT;
  contexto.fillStyle = "#111827";
  contexto.fillRect(MARGIN, y, CANVAS_WIDTH - MARGIN * 2, TABLE_HEADER_HEIGHT);
  contexto.strokeStyle = "#020617";
  contexto.lineWidth = 2;
  contexto.strokeRect(MARGIN, y, CANVAS_WIDTH - MARGIN * 2, TABLE_HEADER_HEIGHT);
  contexto.font = "900 28px Inter, Arial, sans-serif";
  contexto.fillStyle = "#ffffff";
  contexto.textBaseline = "middle";

  let x = MARGIN;
  tabela.colunas.forEach((coluna, indice) => {
    contexto.fillText(coluna.titulo, x + CELL_PADDING, y + TABLE_HEADER_HEIGHT / 2, larguras[indice] - CELL_PADDING * 2);
    x += larguras[indice];
    if (indice < tabela.colunas.length - 1) {
      contexto.strokeStyle = "#475569";
      contexto.beginPath();
      contexto.moveTo(x, y);
      contexto.lineTo(x, y + TABLE_HEADER_HEIGHT);
      contexto.stroke();
    }
  });

  y += TABLE_HEADER_HEIGHT;
  contexto.font = "800 31px Inter, Arial, sans-serif";
  contexto.textBaseline = "top";

  linhas.forEach((linha, indiceLinha) => {
    const altura = alturas[indiceLinha];
    const cores = coresDaLinha(linha.tom, indiceLinha);
    contexto.fillStyle = cores.fundo;
    contexto.fillRect(MARGIN, y, CANVAS_WIDTH - MARGIN * 2, altura);
    contexto.strokeStyle = cores.borda;
    contexto.strokeRect(MARGIN, y, CANVAS_WIDTH - MARGIN * 2, altura);

    x = MARGIN;
    linha.celulas.forEach((celula, indiceColuna) => {
      contexto.fillStyle = cores.texto;
      const linhasCelula = quebrarTexto(contexto, celula, larguras[indiceColuna] - CELL_PADDING * 2);
      linhasCelula.forEach((texto, indiceTexto) => {
        contexto.fillText(texto, x + CELL_PADDING, y + CELL_PADDING + indiceTexto * LINE_HEIGHT);
      });
      x += larguras[indiceColuna];
      if (indiceColuna < linha.celulas.length - 1) {
        contexto.strokeStyle = cores.borda;
        contexto.beginPath();
        contexto.moveTo(x, y);
        contexto.lineTo(x, y + altura);
        contexto.stroke();
      }
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

function canvasParaBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível gerar a imagem."));
    }, "image/png");
  });
}

export async function gerarArquivosTabelaComoImagem(tabela: TabelaImagem): Promise<ArquivoImagem[]> {
  const canvasMedicao = document.createElement("canvas");
  const contextoMedicao = canvasMedicao.getContext("2d");
  if (!contextoMedicao) throw new Error("Não foi possível preparar a imagem.");
  contextoMedicao.font = "800 31px Inter, Arial, sans-serif";
  const logo = await carregarLogo();

  const larguras = largurasColunas(tabela.colunas);
  const linhas = tabela.linhas.map((celulas, indice) => ({ celulas, tom: tabela.tonsLinhas?.[indice] }));
  const paginas = separarPaginas(contextoMedicao, linhas, larguras);

  return Promise.all(paginas.map(async (linhas, indice) => {
    const canvas = desenharPagina(tabela, linhas, indice + 1, paginas.length, larguras, contextoMedicao, logo);
    const sufixo = paginas.length > 1 ? `-pagina-${indice + 1}` : "";
    return {
      nome: `${tabela.nomeArquivo}${sufixo}.png`,
      blob: await canvasParaBlob(canvas)
    };
  }));
}

async function executarDownloadImagem(tabela: TabelaImagem): Promise<void> {
  const arquivos = await gerarArquivosTabelaComoImagem(tabela);
  arquivos.forEach((arquivo) => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(arquivo.blob);
    link.download = arquivo.nome;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

export function baixarTabelaComoImagem(tabela: TabelaImagem): void {
  void executarDownloadImagem(tabela);
}

function criarLinhasPalpitesImagem(palpites: Palpite[], participantes?: ParticipanteImagem[]): LinhaPalpiteImagem[] {
  const ordemDosTons = { verde: 0, azul: 1, vermelho: 2, neutro: 3 } as const;
  const palpitesPorParticipante = new Map(palpites.map((palpite) => [normalizarTexto(palpite.participante), palpite]));
  const usados = new Set<string>();
  const linhas: LinhaPalpiteImagem[] = [];

  participantes?.forEach((participante) => {
    const key = normalizarTexto(participante.nome);
    const palpite = palpitesPorParticipante.get(key);
    usados.add(key);
    linhas.push({
      participante: participante.nome,
      palpite,
      naoEnviou: !palpite,
      tom: tomDoPalpite(palpite)
    });
  });

  palpites.forEach((palpite) => {
    const key = normalizarTexto(palpite.participante);
    if (usados.has(key)) return;
    linhas.push({
      participante: palpite.participante,
      palpite,
      naoEnviou: false,
      tom: tomDoPalpite(palpite)
    });
  });

  return linhas.sort((a, b) => {
    const diferencaTom = ordemDosTons[a.tom] - ordemDosTons[b.tom];
    return diferencaTom || a.participante.localeCompare(b.participante, "pt-BR");
  });
}

export function criarTabelaPalpitesDeJogo(jogo: Jogo, palpites: Palpite[], participantes?: ParticipanteImagem[]): TabelaImagem {
  const linhasPalpites = criarLinhasPalpitesImagem(palpites, participantes);
  const isMataMata = jogo.fase === "mata-mata";

  return {
    titulo: `${jogo.mandante} x ${jogo.visitante}`,
    colunas: isMataMata
      ? [
          { titulo: "Participante", largura: 0.27 },
          { titulo: "Palpite 90m", largura: 0.13 },
          { titulo: "Classificado", largura: 0.17 },
          { titulo: "Pontos", largura: 0.1 },
          { titulo: "Bonus", largura: 0.1 },
          { titulo: "Resultado", largura: 0.23 }
        ]
      : [
          { titulo: "Participante", largura: 0.35 },
          { titulo: "Palpite", largura: 0.16 },
          { titulo: "Pontos", largura: 0.12 },
          { titulo: "Bonus", largura: 0.1 },
          { titulo: "Resultado do jogo", largura: 0.27 }
        ],
    linhas: linhasPalpites.map((linha) =>
      isMataMata
        ? [
            linha.participante,
            linha.naoEnviou ? NAO_ENVIOU : (linha.palpite?.palpite || "-"),
            linha.naoEnviou ? NAO_ENVIOU : (linha.palpite?.classificado || "-"),
            String(linha.palpite?.pontos ?? 0),
            linha.palpite ? formatarBonus(linha.palpite) : "0",
            `${jogo.resultado ?? "pendente"} / ${jogo.classificado ?? "pendente"}`
          ]
        : [
            linha.participante,
            linha.naoEnviou ? NAO_ENVIOU : (linha.palpite?.palpite || "-"),
            String(linha.palpite?.pontos ?? 0),
            linha.palpite ? formatarBonus(linha.palpite) : "0",
            jogo.resultado ?? "pendente"
          ]
    ),
    tonsLinhas: linhasPalpites.map((linha) => linha.tom),
    nomeArquivo: `palpites-${nomeSeguro(jogo.mandante)}-x-${nomeSeguro(jogo.visitante)}`
  };
}

export function gerarImagemPalpitesDeJogo(jogo: Jogo, palpites: Palpite[], participantes?: ParticipanteImagem[]): void {
  baixarTabelaComoImagem(criarTabelaPalpitesDeJogo(jogo, palpites, participantes));
}
