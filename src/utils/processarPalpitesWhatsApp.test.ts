import type { Jogo, Palpite, Participante } from "../types";
import { processarPalpitesWhatsApp } from "./processarPalpitesWhatsApp.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function participante(nome: string): Participante {
  return {
    nome,
    posicao: 1,
    pontos: 0,
    cravadas: 0,
    palpitesEnviados: 0,
    acertos: 0,
    aproveitamento: 0,
    pagamento: "pendente",
    dataPix: null
  };
}

function jogo(id: string, data: string, mandante: string, visitante: string, abreviacao?: string): Jogo {
  return {
    id,
    dia: "Dia 1",
    rodada: "Rodada 1",
    data,
    horario: "12:00",
    mandante,
    visitante,
    abreviacao: abreviacao ?? `${mandante.slice(0, 3).toUpperCase()} x ${visitante.slice(0, 3).toUpperCase()}`,
    resultado: null,
    status: "agendado"
  };
}

const participantes = [
  participante("Karen Milene"),
  participante("Karolyne Azola"),
  participante("Victor Guimarães"),
  participante("Brenno Vergara"),
  participante("Maria Clara Alonso"),
  participante("José Ávila")
];

const jogos = [
  jogo("dia-9-eua-x-aus", "2026-06-19", "Estados Unidos", "Austrália", "EUA x AUS"),
  jogo("dia-9-esc-x-mar", "2026-06-19", "Escócia", "Marrocos", "ESC x MAR"),
  jogo("dia-9-bra-x-hai", "2026-06-19", "Brasil", "Haiti", "BRA x HAI"),
  jogo("dia-9-tur-x-par", "2026-06-19", "Turquia", "Paraguai", "TUR x PAR"),
  jogo("jogo-esp-cab", "2026-06-15", "Espanha", "Cabo Verde"),
  jogo("jogo-bel-egi", "2026-06-15", "Bélgica", "Egito"),
  jogo("jogo-ara-uru", "2026-06-15", "Arábia Saudita", "Uruguai"),
  jogo("jogo-ira-nzl", "2026-06-15", "Irã", "Nova Zelândia"),
  jogo("jogo-coreia-sul", "2026-06-16", "Coreia do Sul", "Japão"),
  jogo("jogo-coreia-norte", "2026-06-16", "Coreia do Norte", "Japão"),
  jogo("jogo-fra-sen", "2026-06-16", "FRA", "SEN", "FRA x SEN"),
  jogo("jogo-irq-nor", "2026-06-16", "IRQ", "NOR", "IRQ x NOR"),
  jogo("jogo-arg-agl", "2026-06-16", "ARG", "AGL", "ARG x AGL"),
  jogo("jogo-aus-jor", "2026-06-16", "\u00C1US", "JOR", "\u00C1US x JOR"),
  jogo("jogo-australia-jor", "2026-06-16", "Australia", "JOR", "AUS x JOR")
];

const palpiteExistente: Palpite = {
  participante: "Karolyne Azola",
  jogoId: "jogo-esp-cab",
  palpite: "1x0",
  pontos: 0,
  cravada: false,
  tipo: "pendente"
};

function processar(texto: string, existentes: Palpite[] = []) {
  return processarPalpitesWhatsApp(texto, { participantes, jogos, palpitesExistentes: existentes });
}

function primeiroPalpite(texto: string) {
  const resultado = processar(texto);
  const item = resultado.itens.find((palpite) => palpite.status !== "nao-enviou");
  assert(item, "Deveria encontrar um palpite processado.");
  return item;
}

const textoBase = `JOGO DIA 15/06 - SEGUNDA - HOJEEE

Meus palpites (Karolyne Azola)
Espanha 5x0 Cabo Verde
Bélgica 3x2 Egito
Arábia Saudita 1x2 Uruguai
Irã 2x1 Nova Zelândia

JOGO DIA 15/06 - SEGUNDA - HOJEEE
Meus palpites (Victor Guimarães)
Espanha 5x1 Cabo Verde
Bélgica 2x1 Egito
Arábia Saudita 0x1 Uruguai
Irã 0x2 Nova Zelândia`;

const tests: Array<[string, () => void]> = [
  [
    "mensagem da Karen sem cabeçalho de data",
    () => {
      const resultado = processar(`Meus palpites (Karen Milene)

EUA 2X2 Austrália

Escócia 2x2 Marrocos

Brasil 4x0 Haiti

Turquia 1x3 Paraguai`);
      const importaveis = resultado.itens.filter((item) => item.importavel);
      assert(importaveis.length === 4, "Os quatro palpites da Karen deveriam ser importáveis.");
      assert(importaveis.map((item) => item.placar).join(",") === "2x2,2x2,4x0,1x3", "Os placares da Karen deveriam ser preservados.");
    }
  ],
  [
    "vários participantes no mesmo texto",
    () => {
      const resultado = processar(textoBase);
      assert(resultado.participantes.length === 2, "Deveria processar dois participantes.");
      assert(resultado.itens.filter((item) => item.valido).length === 8, "Deveria processar oito palpites válidos.");
    }
  ],
  [
    "participante com nome composto",
    () => {
      const item = primeiroPalpite(`JOGO DIA 15/06\nMeus palpites (Victor Guimarães)\nEspanha 1x0 Cabo Verde`);
      assert(item.participanteOficial === "Victor Guimarães", "Deveria preservar o nome oficial do participante.");
    }
  ],
  [
    "times com nomes compostos",
    () => {
      const item = primeiroPalpite(`JOGO DIA 15/06\nMeus palpites (Karolyne Azola)\nArabia Saudita 2x1 Uruguai`);
      assert(item.jogoId === "jogo-ara-uru", "Deveria encontrar Arábia Saudita x Uruguai sem acento.");
    }
  ],
  [
    "placar com x, X, espaço, hífen e letra a",
    () => {
      ["2x1", "2 x 1", "2X1", "2 X 1", "2 a 1", "2-1"].forEach((placar) => {
        const item = primeiroPalpite(`JOGO DIA 15/06\nMeus palpites (Karolyne Azola)\nEspanha ${placar} Cabo Verde`);
        assert(item.status === "valido", `Formato ${placar} deveria ser válido.`);
        assert(item.placar === "2x1", `Formato ${placar} deveria normalizar para 2x1.`);
      });
    }
  ],
  [
    "participante que não enviou todos os jogos",
    () => {
      const resultado = processar(`JOGO DIA 15/06\nMeus palpites (Brenno Vergara)\nBélgica 1x0 Egito`);
      assert(resultado.itens.filter((item) => item.status === "nao-enviou").length === 3, "Deveria marcar três jogos como não enviados.");
    }
  ],
  [
    "comentários misturados no texto",
    () => {
      const resultado = processar(`JOGO DIA 15/06\nMeus palpites (Karolyne Azola)\nboatos que esse jogo da espanha nao passa de 3 gol\nEspanha 1x0 Cabo Verde`);
      assert(resultado.linhasIgnoradas.some((linha) => linha.includes("boatos")), "Comentário solto deveria ser ignorado.");
    }
  ],
  [
    "nome com e sem acento",
    () => {
      const item = primeiroPalpite(`JOGO DIA 15/06\nMeus palpites (Jose Avila)\nIra 1x0 Nova Zelandia`);
      assert(item.participanteOficial === "José Ávila", "Participante deveria bater sem acento.");
      assert(item.jogoId === "jogo-ira-nzl", "Times deveriam bater sem acento.");
    }
  ],
  [
    "palpite duplicado",
    () => {
      const resultado = processar(`JOGO DIA 15/06\nMeus palpites (Karolyne Azola)\nEspanha 1x0 Cabo Verde\nEspanha 2x0 Cabo Verde`);
      const duplicados = resultado.itens.filter((item) => item.duplicado);
      assert(duplicados.length === 2, "Deveria mostrar os dois palpites duplicados.");
      assert(duplicados[1].usarNaImportacao, "O último duplicado deveria ser usado por padrão.");
    }
  ],
  [
    "participante não cadastrado",
    () => {
      const item = primeiroPalpite(`JOGO DIA 15/06\nMeus palpites (Pessoa Nova)\nEspanha 1x0 Cabo Verde`);
      assert(item.status === "participante-nao-encontrado", "Participante desconhecido deveria ser inválido.");
    }
  ],
  [
    "jogo não cadastrado",
    () => {
      const item = primeiroPalpite(`JOGO DIA 15/06\nMeus palpites (Karolyne Azola)\nBrasil 1x0 Marte`);
      assert(item.status === "jogo-nao-encontrado", "Jogo desconhecido deveria ser inválido.");
    }
  ],
  [
    "texto vazio",
    () => {
      const resultado = processar("");
      assert(resultado.erros.length === 1, "Texto vazio deveria retornar erro.");
    }
  ],
  [
    "mensagem parcialmente inválida",
    () => {
      const resultado = processar(`JOGO DIA 15/06\nMeus palpites (Karolyne Azola)\nEspanha 2x Cabo Verde`);
      assert(resultado.itens.some((item) => item.status === "formato-invalido"), "Linha parcialmente inválida deveria aparecer na prévia.");
    }
  ],
  [
    "palpite já existente na planilha",
    () => {
      const resultado = processar(`JOGO DIA 15/06\nMeus palpites (Karolyne Azola)\nEspanha 2x1 Cabo Verde`, [palpiteExistente]);
      const item = resultado.itens.find((palpite) => palpite.jogoId === "jogo-esp-cab");
      assert(item?.status === "palpite-existente", "Palpite existente deveria ser identificado.");
      assert(item.decisao === "manter", "Palpite existente deveria manter o atual por padrão.");
    }
  ],
  [
    "dois jogos com times de nomes parecidos",
    () => {
      const item = primeiroPalpite(`JOGO DIA 16/06\nMeus palpites (Karolyne Azola)\nCoreia do Sul 1x0 Japão`);
      assert(item.jogoId === "jogo-coreia-sul", "Deveria escolher Coreia do Sul, não Coreia do Norte.");
    }
  ],
  [
    "mensagem copiada com informações extras do WhatsApp",
    () => {
      const item = primeiroPalpite(`JOGO DIA 15/06\n[15/06/2026, 08:00] Karolyne Azola: Meus palpites (Karolyne Azola)\n[15/06/2026, 08:01] Karolyne Azola: Espanha 1x0 Cabo Verde`);
      assert(item.status === "valido", "Prefixos do WhatsApp deveriam ser removidos.");
    }
  ],
  [
    "mensagem com nomes completos deve bater com siglas da planilha",
    () => {
      const resultado = processar(`JOGO DIA 16/06 - TER\u00C7A-FEIRA- AMANH\u00C3

Meus palpites (Maria Clara Alonso)

Fran\u00E7a 3 x 0 Senagal

Iraque 0 x 2 Noruega

Argentina 3 x 1 Arg\u00E9lia

\u00C1ustria 1 x 0 Jord\u00E2nia`);

      const importaveis = resultado.itens.filter((item) => item.importavel);
      assert(importaveis.length === 4, "Deveria encontrar os quatro jogos enviados.");
      assert(importaveis.some((item) => item.jogoId === "jogo-fra-sen"), "Deveria casar Franca/Senagal com FRA x SEN.");
      assert(importaveis.some((item) => item.jogoId === "jogo-irq-nor"), "Deveria casar Iraque/Noruega com IRQ x NOR.");
      assert(importaveis.some((item) => item.jogoId === "jogo-arg-agl"), "Deveria casar Argentina/Argelia com ARG x AGL.");
      assert(importaveis.some((item) => item.jogoId === "jogo-aus-jor"), "Deveria casar Austria/Jordania com AUS x JOR.");
    }
  ]
];

tests.forEach(([name, run]) => {
  run();
  console.log(`ok - ${name}`);
});
