const SHEET_NAMES = {
  palpites: ["BOLÃO - PALPITES"],
  tabela: ["BOLÃO - TABELA"],
  pagamento: ["BOLÃO - PAGAMENTO"],
  ranking: ["RANKING"]
};

const VALOR_PIX = 10;
const MAX_SCAN_ROWS = 120;
const SCORING_ENGINE_VERSION = "2026-06-19-v2";
const SCORE_COLORS = {
  exato: "#5B9BD5",
  pontuado: "#70AD47",
  neutro: "#FFFFFF",
  textoClaro: "#FFFFFF",
  textoEscuro: "#000000"
};

const TEAM_NAMES = {
  AFS: "África do Sul",
  AGL: "Argélia",
  ALG: "Argélia",
  ALE: "Alemanha",
  ARA: "Arábia Saudita",
  ARG: "Argentina",
  AUS: "Austrália",
  AUT: "Áustria",
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
  IRA: "Irã",
  IRQ: "Iraque",
  JAP: "Japão",
  JOR: "Jordânia",
  MAR: "Marrocos",
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

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = String(params.action || "dashboard");
    return json_(handleGet_(action, params));
  } catch (err) {
    return json_({ ok: false, message: errorMessage_(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var payload = parsePostPayload_(e);
    var action = String(payload.action || "");
    assertAdminToken_(payload.adminToken);

    if (action === "atualizarPagamento") {
      atualizarPagamento_(payload);
      return json_({ ok: true, message: "Pagamento atualizado com sucesso." });
    }

    if (action === "atualizarResultado") {
      atualizarResultado_(payload);
      return json_({ ok: true, message: "Resultado atualizado com sucesso." });
    }

    if (action === "atualizarPalpite") {
      atualizarPalpite_(payload);
      return json_({ ok: true, message: "Palpite atualizado com sucesso." });
    }

    if (action === "importarPalpitesEmLote") {
      return json_(importarPalpitesEmLote_(payload));
    }

    if (action === "adicionarParticipante") {
      return json_(adicionarParticipante_(payload));
    }

    if (action === "repararRanking") {
      var ss = getSpreadsheet_();
      repararRankingSheet_(findSheet_(ss, SHEET_NAMES.ranking, true));
      SpreadsheetApp.flush();
      return json_({ ok: true, message: "Ranking reparado com sucesso." });
    }

    throw new Error("Ação POST inválida.");
  } catch (err) {
    return json_({ ok: false, message: errorMessage_(err) });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {}
  }
}

function doOptions() {
  return json_({ ok: true });
}

function configurarAutomacao() {
  var ss = getSpreadsheet_();
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "handleScoringEdit_") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("handleScoringEdit_").forSpreadsheet(ss).onEdit().create();
  recalcularPontuacaoPlanilha_(ss);
  return "Automação configurada e ranking recalculado com sucesso.";
}

function recalcularTudo() {
  var ss = getSpreadsheet_();
  recalcularPontuacaoPlanilha_(ss);
  return "Pontuação e ranking recalculados com sucesso.";
}

function handleScoringEdit_(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    if (normalizarTexto_(sheet.getName()) !== normalizarTexto_(SHEET_NAMES.palpites[0])) return;

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) return;
    try {
      recalcularPontuacaoPlanilha_(sheet.getParent());
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error(errorMessage_(err));
  }
}

function getSpreadsheet_() {
  var spreadsheetId = String(PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || "").trim();
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Planilha nao encontrada. Configure SPREADSHEET_ID nas propriedades do script.");
  return ss;
}

function handleGet_(action, params) {
  if (action === "estruturaImportacao") return readEstruturaImportacao_();

  var snapshot = readSnapshot_();

  if (action === "dashboard") return snapshot;
  if (action === "ranking") return snapshot.ranking;
  if (action === "jogos") return snapshot.jogos;
  if (action === "palpites") return snapshot.palpites;
  if (action === "pagamentos") return snapshot.pagamentos;
  if (action === "participantes") return snapshot.participantes;
  if (action === "participante") return buildParticipanteDetalhe_(snapshot, params.nome);

  throw new Error("Ação GET inválida.");
}

function readEstruturaImportacao_() {
  var ss = getSpreadsheet_();
  ensureScoringSetup_(ss);
  var parsed = readPalpitesSheet_(ss);
  var jogosTabela = readJogosTabela_(ss);
  var jogos = mergeJogos_(parsed.jogos, jogosTabela);
  var pagamentos = readPagamentos_(ss);
  var rankingPlanilha = readRanking_(ss);
  var ranking = rankingPlanilha.length ? completeRanking_(rankingPlanilha, parsed.palpites, jogos) : calcularRanking_(parsed.palpites, jogos);
  var participantes = buildParticipantes_(ranking, pagamentos);
  var alvosByCell = {};

  Object.keys(parsed.index.palpites).forEach(function (key) {
    var target = parsed.index.palpites[key];
    var celula = columnName_(target.col) + target.row;
    if (alvosByCell[celula]) return;
    alvosByCell[celula] = {
      participante: target.participante,
      jogoId: target.id,
      cabecalho: target.cabecalho,
      celula: celula,
      palpiteAtual: target.palpiteAtual || ""
    };
  });

  return {
    participantes: participantes,
    jogos: parsed.jogos.map(function (jogo) {
      var header = parsed.index.jogos[jogo.id];
      return Object.assign({}, jogo, {
        abreviacao: header && header.cabecalho ? header.cabecalho : jogo.abreviacao,
        cabecalhoPlanilha: header && header.cabecalho ? header.cabecalho : jogo.abreviacao,
        celulaCabecalho: header ? columnName_(header.headerCol) + header.headerRow : ""
      });
    }),
    palpites: parsed.palpites,
    alvos: Object.keys(alvosByCell).map(function (cell) { return alvosByCell[cell]; }),
    atualizadoEm: new Date().toISOString()
  };
}

function readSnapshot_() {
  var ss = getSpreadsheet_();
  ensureScoringSetup_(ss);
  var rankingSheet = findSheet_(ss, SHEET_NAMES.ranking, false);
  if (rankingSheet) {
    repararRankingSheet_(rankingSheet);
    SpreadsheetApp.flush();
  }
  var parsedPalpites = readPalpitesSheet_(ss);
  var jogosTabela = readJogosTabela_(ss);
  var jogos = mergeJogos_(parsedPalpites.jogos, jogosTabela);
  var pagamentos = readPagamentos_(ss);
  var rankingPlanilha = readRanking_(ss);
  var ranking = rankingPlanilha.length ? completeRanking_(rankingPlanilha, parsedPalpites.palpites, jogos) : calcularRanking_(parsedPalpites.palpites, jogos);
  var participantes = buildParticipantes_(ranking, pagamentos);

  return {
    participantes: participantes,
    ranking: ranking,
    jogos: jogos,
    palpites: parsedPalpites.palpites,
    pagamentos: pagamentos,
    resumo: buildResumo_(participantes, jogos, parsedPalpites.palpites, pagamentos),
    ultimaAtualizacao: new Date().toISOString()
  };
}

function buildResumo_(participantes, jogos, palpites, pagamentos) {
  var pagos = pagamentos.filter(function (item) { return item.pago; });
  var pendentes = pagamentos.filter(function (item) { return !item.pago; });

  return {
    totalParticipantes: participantes.length,
    jogosFinalizados: jogos.filter(function (jogo) { return jogo.status === "finalizado"; }).length,
    jogosPendentes: jogos.filter(function (jogo) { return jogo.status !== "finalizado"; }).length,
    totalCravadas: palpites.filter(function (palpite) { return palpite.cravada; }).length,
    pagamentosConfirmados: pagos.length,
    valorArrecadado: pagos.reduce(function (total, item) { return total + Number(item.valor || 0); }, 0),
    valorPendente: pendentes.reduce(function (total, item) { return total + Number(item.valor || 0); }, 0)
  };
}

function readRanking_(ss) {
  var sheet = findSheet_(ss, SHEET_NAMES.ranking, false);
  if (!sheet) return [];

  var values = sheet.getDataRange().getValues();
  var headerInfo = detectHeader_(values, ["posicao", "participante", "pontos", "total", "cravadas"]);
  if (!headerInfo) return [];

  var headers = headerInfo.headers;
  var participantCols = [];
  headers.forEach(function (header, index) {
    if (header === "participante" || header === "nome") participantCols.push(index);
  });
  var participanteCol = participantCols.length ? participantCols[participantCols.length - 1] : -1;
  var posicaoCol = participantCols.length > 1 ? -1 : findColumn_(headers, ["posicao", "rank"]);
  var pontosCol = findColumnAfter_(headers, ["pontos", "total"], participanteCol + 1);
  var cravadasCol = findColumnAfter_(headers, ["cravadas", "placares", "exatos"], participanteCol + 1);
  var palpitesCol = findColumnAfter_(headers, ["palpites", "quantidade"], participanteCol + 1);

  if (participanteCol < 0 || pontosCol < 0) return [];

  var ranking = values
    .slice(headerInfo.row + 1)
    .filter(function (row) { return !isRowEmpty_(row); })
    .map(function (row, index) {
      var participante = normalizarNome_(row[participanteCol]);
      if (!participante) return null;

      return {
        posicao: posicaoCol >= 0 && toNumber_(row[posicaoCol]) > 0 ? toNumber_(row[posicaoCol]) : 0,
        participante: participante,
        pontos: toNumber_(row[pontosCol]),
        cravadas: cravadasCol >= 0 ? toNumber_(row[cravadasCol]) : 0,
        palpites: palpitesCol >= 0 ? toNumber_(row[palpitesCol]) : 0,
        acertos: 0,
        aproveitamento: 0,
        ordemOriginal: index
      };
    })
    .filter(Boolean);

  if (participantCols.length > 1) {
    return ranking
      .sort(function (a, b) {
        return b.pontos - a.pontos || b.cravadas - a.cravadas || a.ordemOriginal - b.ordemOriginal;
      })
      .map(function (item, index) {
        item.posicao = index + 1;
        return item;
      });
  }

  return ranking.sort(function (a, b) { return a.posicao - b.posicao; });
}

function readPagamentos_(ss) {
  var sheet = findSheet_(ss, SHEET_NAMES.pagamento, false);
  if (!sheet) return [];

  var values = sheet.getDataRange().getValues();
  var headerInfo = detectHeader_(values, ["participante", "nome", "pix", "pagou", "data", "valor"]);
  if (!headerInfo) return [];

  var headers = headerInfo.headers;
  var participanteCol = findColumn_(headers, ["participante", "nome"]);
  var pagoCol = findColumn_(headers, ["pagou", "pago", "pix"]);
  var dataCol = findColumn_(headers, ["data"]);
  var valorCol = findColumn_(headers, ["valor"]);

  if (participanteCol < 0) return [];

  return values
    .slice(headerInfo.row + 1)
    .filter(function (row) { return !isRowEmpty_(row); })
    .map(function (row) {
      var participante = normalizarNome_(row[participanteCol]);
      if (!participante) return null;
      var pago = pagoCol >= 0 ? parseBoolean_(row[pagoCol]) : false;
      var valor = valorCol >= 0 && toNumber_(row[valorCol]) > 0 ? toNumber_(row[valorCol]) : VALOR_PIX;

      return {
        participante: participante,
        pago: pago,
        dataPagamento: dataCol >= 0 ? formatDateIso_(row[dataCol]) : null,
        valor: valor,
        situacao: pago ? "pago" : "pendente"
      };
    })
    .filter(Boolean);
}

function readJogosTabela_(ss) {
  var sheet = findSheet_(ss, SHEET_NAMES.tabela, false);
  if (!sheet) return [];

  var values = sheet.getDataRange().getValues();
  var headerInfo = detectHeader_(values, ["mandante", "visitante", "resultado", "data", "horario", "placar"]);
  if (!headerInfo) return [];

  var headers = headerInfo.headers;
  var mandanteCol = findColumn_(headers, ["mandante", "casa", "time 1", "selecao 1"]);
  var visitanteCol = findColumn_(headers, ["visitante", "fora", "time 2", "selecao 2"]);
  var dataCol = findColumn_(headers, ["data"]);
  var horarioCol = findColumn_(headers, ["horario", "hora"]);
  var resultadoCol = findColumn_(headers, ["resultado", "placar"]);
  var diaCol = findColumn_(headers, ["dia"]);
  var rodadaCol = findColumn_(headers, ["rodada"]);

  if (mandanteCol < 0 || visitanteCol < 0) return [];

  return values
    .slice(headerInfo.row + 1)
    .filter(function (row) { return !isRowEmpty_(row); })
    .map(function (row, index) {
      var mandante = normalizarNome_(row[mandanteCol]);
      var visitante = normalizarNome_(row[visitanteCol]);
      if (!mandante || !visitante) return null;

      var abreviacao = sigla_(mandante) + " x " + sigla_(visitante);
      var resultado = resultadoCol >= 0 ? formatScore_(row[resultadoCol]) : null;
      var dia = diaCol >= 0 ? String(row[diaCol] || "Dia") : "Dia";

      return {
        id: slug_(dia + "-" + abreviacao + "-" + index),
        dia: dia,
        rodada: rodadaCol >= 0 ? String(row[rodadaCol] || dia) : dia,
        data: dataCol >= 0 ? formatDateIso_(row[dataCol]) || "" : "",
        horario: horarioCol >= 0 ? formatTime_(row[horarioCol]) : "",
        mandante: mandante,
        visitante: visitante,
        abreviacao: abreviacao,
        resultado: resultado,
        status: resultado ? "finalizado" : "agendado"
      };
    })
    .filter(Boolean);
}

function readPalpitesSheet_(ss) {
  var sheet = findSheet_(ss, SHEET_NAMES.palpites, false);
  if (!sheet) return { jogos: [], palpites: [], index: { jogos: {}, palpites: {} } };

  var values = sheet.getDataRange().getValues();
  var jogosById = {};
  var palpites = [];
  var index = { jogos: {}, palpites: {} };

  for (var row = 0; row < values.length; row += 1) {
    for (var col = 0; col < values[row].length; col += 1) {
      var gameText = cleanString_(values[row][col]).replace(/\s+/g, " ");
      if (!looksLikeGame_(gameText)) continue;

      var gameInfo = parseGameText_(gameText);
      var resultadoInfo = findResultadoForColumn_(values, row, col);
      var participantCol = guessParticipantColumn_(values, row, col, resultadoInfo ? resultadoInfo.row : row + 35);
      var dayInfo = parseDay_(findNearbyText_(values, row, col, ["dia"], 5, 6)) || parseDay_(findLeftDay_(values, row, col)) || { label: "Dia", date: "" };
      var resultado = resultadoInfo ? formatScore_(resultadoInfo.value) : null;
      var id = slug_(dayInfo.label + "-" + gameInfo.abreviacao);
      var idAliases = uniqueStrings_([id, slug_(dayInfo.label + "-" + gameText)]);

      if (!jogosById[id]) {
        jogosById[id] = {
          id: id,
          aliases: idAliases,
          dia: dayInfo.label,
          rodada: dayInfo.label,
          data: dayInfo.date || findNearbyDate_(values, row, col) || "",
          horario: findNearbyTime_(values, row, col),
          mandante: gameInfo.mandante,
          visitante: gameInfo.visitante,
          abreviacao: gameInfo.abreviacao,
          resultado: resultado,
          status: resultado ? "finalizado" : "agendado"
        };
        idAliases.forEach(function (alias) {
          index.jogos[alias] = {
            id: id,
            alias: alias,
            cabecalho: gameText,
            headerRow: row + 1,
            headerCol: col + 1,
            resultadoRow: resultadoInfo ? resultadoInfo.row + 1 : null,
            resultadoCol: resultadoInfo ? col + 1 : null
          };
        });
      }

      var stopRow = resultadoInfo ? resultadoInfo.row : Math.min(values.length - 1, row + 35);
      for (var participantRow = row + 1; participantRow < stopRow; participantRow += 1) {
        var participante = participantCol >= 0 ? normalizarNome_(values[participantRow][participantCol]) : "";
        if (!participante || shouldSkipParticipantName_(participante)) continue;

        idAliases.forEach(function (alias) {
          index.palpites[alias + "::" + normalizarTexto_(participante)] = {
            id: id,
            alias: alias,
            participante: participante,
            cabecalho: gameText,
            palpiteAtual: formatScore_(values[participantRow][col]) || "",
            row: participantRow + 1,
            col: col + 1
          };
        });

        var palpite = formatScore_(values[participantRow][col]);
        if (!palpite) continue;

        var pontuacao = calcularPontuacao_(palpite, resultado);
        palpites.push({
          jogoId: id,
          participante: participante,
          palpite: palpite,
          pontos: pontuacao.pontos,
          cravada: pontuacao.cravada,
          tipo: pontuacao.tipo
        });

      }
    }
  }

  return {
    jogos: Object.keys(jogosById).map(function (key) { return jogosById[key]; }),
    palpites: palpites,
    index: index
  };
}

function mergeJogos_(jogosPalpites, jogosTabela) {
  if (!jogosTabela.length) return jogosPalpites;
  if (!jogosPalpites.length) return jogosTabela;

  var byKey = {};
  jogosPalpites.forEach(function (jogo) {
    byKey[slug_(jogo.abreviacao)] = jogo;
  });

  jogosTabela.forEach(function (jogoTabela) {
    var key = slug_(jogoTabela.abreviacao);
    if (byKey[key]) {
      byKey[key] = Object.assign({}, byKey[key], {
        data: jogoTabela.data || byKey[key].data,
        horario: jogoTabela.horario || byKey[key].horario,
        resultado: jogoTabela.resultado || byKey[key].resultado,
        status: jogoTabela.resultado ? "finalizado" : byKey[key].status
      });
    } else {
      byKey[key] = jogoTabela;
    }
  });

  return Object.keys(byKey).map(function (key) { return byKey[key]; });
}

function completeRanking_(ranking, palpites, jogos) {
  var finalizedGames = Math.max(1, jogos.filter(function (jogo) { return jogo.resultado; }).length);
  var byParticipant = {};

  palpites.forEach(function (palpite) {
    var key = normalizarTexto_(palpite.participante);
    if (!byParticipant[key]) byParticipant[key] = [];
    byParticipant[key].push(palpite);
  });

  return ranking.map(function (item, index) {
    var bets = byParticipant[normalizarTexto_(item.participante)] || [];
    var acertos = bets.filter(function (palpite) { return palpite.pontos > 0; }).length;
    var pontos = Number(item.pontos || 0);
    return Object.assign({}, item, {
      cravadas: Number(item.cravadas || bets.filter(function (palpite) { return palpite.cravada; }).length),
      palpites: bets.length || Number(item.palpites || 0),
      acertos: acertos,
      aproveitamento: finalizedGames > 0 ? (pontos / (finalizedGames * 5)) * 100 : 0,
      ordemOriginal: item.ordemOriginal === undefined ? index : item.ordemOriginal
    });
  });
}

function calcularRanking_(palpites, jogos) {
  var finalizedGames = Math.max(1, (jogos || []).filter(function (jogo) { return jogo.resultado; }).length);
  var map = {};
  var ordem = [];

  palpites.forEach(function (palpite) {
    var key = normalizarTexto_(palpite.participante);
    if (!map[key]) {
      map[key] = {
        posicao: 0,
        participante: palpite.participante,
        pontos: 0,
        cravadas: 0,
        palpites: 0,
        acertos: 0,
        aproveitamento: 0,
        ordemOriginal: ordem.length
      };
      ordem.push(key);
    }

    map[key].pontos += Number(palpite.pontos || 0);
    map[key].cravadas += palpite.cravada ? 1 : 0;
    map[key].palpites += 1;
    map[key].acertos += Number(palpite.pontos || 0) > 0 ? 1 : 0;
  });

  return ordem
    .map(function (key) {
      var item = map[key];
      item.aproveitamento = (item.pontos / (finalizedGames * 5)) * 100;
      return item;
    })
    .sort(function (a, b) {
      return b.pontos - a.pontos || b.cravadas - a.cravadas || a.ordemOriginal - b.ordemOriginal;
    })
    .map(function (item, index) {
      item.posicao = index + 1;
      return item;
    });
}

function buildParticipantes_(ranking, pagamentos) {
  return ranking.map(function (item) {
    var pagamento = pagamentos.find(function (pag) {
      return normalizarTexto_(pag.participante) === normalizarTexto_(item.participante);
    });

    return {
      nome: item.participante,
      posicao: item.posicao,
      pontos: item.pontos,
      cravadas: item.cravadas,
      palpitesEnviados: item.palpites,
      acertos: item.acertos,
      aproveitamento: item.aproveitamento,
      pagamento: pagamento && pagamento.pago ? "pago" : "pendente",
      dataPix: pagamento ? pagamento.dataPagamento : null
    };
  });
}

function buildParticipanteDetalhe_(snapshot, nome) {
  var nomeNormalizado = normalizarTexto_(String(nome || ""));
  if (!nomeNormalizado) throw new Error("Informe o nome do participante.");

  var participante = snapshot.participantes.find(function (item) {
    return normalizarTexto_(item.nome) === nomeNormalizado;
  });
  if (!participante) throw new Error("Participante não encontrado.");

  var palpites = snapshot.palpites.filter(function (palpite) {
    return normalizarTexto_(palpite.participante) === nomeNormalizado;
  });
  var jogosComPalpite = {};
  palpites.forEach(function (palpite) {
    jogosComPalpite[palpite.jogoId] = true;
  });

  return Object.assign({}, participante, {
    palpites: palpites,
    jogosSemPalpite: snapshot.jogos.filter(function (jogo) { return !jogosComPalpite[jogo.id]; })
  });
}

function adicionarParticipante_(payload) {
  var participante = normalizarNome_(payload.nome);
  if (participante.length < 2) throw new Error("Informe o nome completo do participante.");
  if (participante.length > 80) throw new Error("O nome do participante é muito longo.");
  if (shouldSkipParticipantName_(participante)) throw new Error("Esse nome é reservado pela estrutura da planilha.");

  var ss = getSpreadsheet_();
  var palpitesSheet = findSheet_(ss, SHEET_NAMES.palpites, true);
  var rankingSheet = findSheet_(ss, SHEET_NAMES.ranking, true);
  var pagamentoSheet = findSheet_(ss, SHEET_NAMES.pagamento, true);

  var resultadoPalpites = adicionarParticipanteNosPalpites_(palpitesSheet, participante);
  var resultadoRanking = adicionarParticipanteNoRanking_(rankingSheet, participante);
  var resultadoPagamento = adicionarParticipanteNoPagamento_(pagamentoSheet, participante);
  recalcularPontuacaoPlanilha_(ss);

  SpreadsheetApp.flush();

  var estrutura = readEstruturaImportacao_();
  var participanteKey = normalizarTexto_(participante);
  var participanteCriado = estrutura.participantes.some(function (item) {
    return normalizarTexto_(item.nome) === participanteKey;
  });
  var totalAlvos = estrutura.alvos.filter(function (alvo) {
    return normalizarTexto_(alvo.participante) === participanteKey;
  }).length;

  if (!participanteCriado || totalAlvos < estrutura.jogos.length) {
    throw new Error(
      "O participante foi incluído parcialmente. Verifique as abas RANKING e BOLÃO - PALPITES antes de tentar novamente."
    );
  }

  return {
    ok: true,
    message:
      participante +
      " adicionado com sucesso em " +
      totalAlvos +
      " jogos, no Ranking e em Pagamentos.",
    participante: participante,
    jogosAdicionados: resultadoPalpites.adicionados,
    jogosExistentes: resultadoPalpites.existentes,
    rankingAdicionado: resultadoRanking.adicionado,
    pagamentoAdicionado: resultadoPagamento.adicionado
  };
}

function adicionarParticipanteNosPalpites_(sheet, participante) {
  var values = sheet.getDataRange().getValues();
  var blocks = findPalpiteBlocks_(values).sort(function (a, b) { return b.headerRow - a.headerRow; });
  if (!blocks.length) throw new Error("Nenhum bloco de jogos foi encontrado na aba BOLÃO - PALPITES.");

  var adicionados = 0;
  var existentes = 0;

  blocks.forEach(function (block) {
    var existingRow = findRowByName_(values, block.headerRow + 1, block.participantCol, participante);
    if (existingRow >= 0 && existingRow < block.resultRow) {
      existentes += 1;
      return;
    }

    var targetRowIndex = block.resultRow - 1;
    var targetIsEmpty = targetRowIndex > block.headerRow && isRowEmpty_(values[targetRowIndex] || []);
    if (!targetIsEmpty) {
      sheet.insertRowsBefore(block.resultRow + 1, 1);
      targetRowIndex = block.resultRow;
    }

    var sourceRowIndex = targetRowIndex - 1;
    while (
      sourceRowIndex > block.headerRow &&
      (!normalizarNome_(values[sourceRowIndex] && values[sourceRowIndex][block.participantCol]) ||
        shouldSkipParticipantName_(values[sourceRowIndex] && values[sourceRowIndex][block.participantCol]))
    ) {
      sourceRowIndex -= 1;
    }
    if (sourceRowIndex <= block.headerRow) throw new Error("Linha modelo de participante não encontrada.");

    var targetRow = targetRowIndex + 1;
    var sourceRow = sourceRowIndex + 1;
    var width = Math.max(sheet.getLastColumn(), block.lastCol + 1);
    sheet.getRange(sourceRow, 1, 1, width).copyTo(sheet.getRange(targetRow, 1, 1, width));
    sheet.getRange(targetRow, block.participantCol + 1).setValue(participante);

    block.gameCols.forEach(function (gameCol) {
      sheet.getRange(targetRow, gameCol + 1).clearContent();
    });

    [block.totalCol, block.cravadasCol].forEach(function (column) {
      if (column < 0) return;
      var range = sheet.getRange(targetRow, column + 1);
      if (!range.getFormula()) range.setValue(0);
    });

    adicionados += 1;
  });

  return { adicionados: adicionados, existentes: existentes };
}

function findPalpiteBlocks_(values) {
  var blocks = [];

  for (var row = 0; row < values.length; row += 1) {
    var headers = values[row].map(function (cell) { return normalizarTexto_(cell); });
    var participantCol = headers.indexOf("participante");
    if (participantCol < 0) continue;

    var gameCols = [];
    for (var col = participantCol + 1; col < values[row].length; col += 1) {
      if (looksLikeGame_(cleanString_(values[row][col]))) gameCols.push(col);
    }
    if (!gameCols.length) continue;

    var resultRow = -1;
    for (var nextRow = row + 1; nextRow < Math.min(values.length, row + 60); nextRow += 1) {
      if (normalizarTexto_(values[nextRow][participantCol]) === "resultado") {
        resultRow = nextRow;
        break;
      }
    }
    if (resultRow < 0) continue;

    var totalCol = headers.indexOf("total");
    var cravadasCol = headers.indexOf("cravadas");
    blocks.push({
      headerRow: row,
      resultRow: resultRow,
      participantCol: participantCol,
      gameCols: gameCols,
      totalCol: totalCol,
      cravadasCol: cravadasCol,
      lastCol: Math.max.apply(null, gameCols.concat([totalCol, cravadasCol].filter(function (item) { return item >= 0; })))
    });
  }

  return blocks;
}

function ensureScoringSetup_(ss) {
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty("SCORING_ENGINE_VERSION") === SCORING_ENGINE_VERSION) return;
  recalcularPontuacaoPlanilha_(ss);
}

function recalcularPontuacaoPlanilha_(ss) {
  SpreadsheetApp.flush();
  var palpitesSheet = findSheet_(ss, SHEET_NAMES.palpites, true);
  var values = palpitesSheet.getDataRange().getValues();
  var blocks = findPalpiteBlocks_(values);
  if (!blocks.length) throw new Error("Nenhum bloco de jogos encontrado para recalcular a pontuação.");

  var totais = {};
  var ordemParticipantes = [];

  blocks.forEach(function (block) {
    var rowCount = block.resultRow - block.headerRow - 1;
    if (rowCount <= 0) return;

    var backgrounds = [];
    var fontColors = [];
    var fontWeights = [];
    var totaisDoBloco = [];
    var cravadasDoBloco = [];

    for (var row = block.headerRow + 1; row < block.resultRow; row += 1) {
      var participante = normalizarNome_(values[row][block.participantCol]);
      var pontos = 0;
      var cravadas = 0;
      var rowBackgrounds = [];
      var rowFontColors = [];
      var rowFontWeights = [];

      block.gameCols.forEach(function (gameCol) {
        var pontuacao = participante
          ? calcularPontuacao_(values[row][gameCol], values[block.resultRow][gameCol])
          : { pontos: 0, cravada: false, tipo: "pendente" };
        pontos += pontuacao.pontos;
        cravadas += pontuacao.cravada ? 1 : 0;

        var pontuado = pontuacao.pontos > 0;
        rowBackgrounds.push(
          pontuacao.tipo === "exato"
            ? SCORE_COLORS.exato
            : pontuado
              ? SCORE_COLORS.pontuado
              : SCORE_COLORS.neutro
        );
        rowFontColors.push(pontuado ? SCORE_COLORS.textoClaro : SCORE_COLORS.textoEscuro);
        rowFontWeights.push(pontuado ? "bold" : "normal");
      });

      backgrounds.push(rowBackgrounds);
      fontColors.push(rowFontColors);
      fontWeights.push(rowFontWeights);
      totaisDoBloco.push([pontos]);
      cravadasDoBloco.push([cravadas]);

      if (participante && !shouldSkipParticipantName_(participante)) {
        var key = normalizarTexto_(participante);
        if (!totais[key]) {
          totais[key] = { participante: participante, pontos: 0, cravadas: 0, ordem: ordemParticipantes.length };
          ordemParticipantes.push(key);
        }
        totais[key].pontos += pontos;
        totais[key].cravadas += cravadas;
      }
    }

    var firstGameCol = Math.min.apply(null, block.gameCols);
    var lastGameCol = Math.max.apply(null, block.gameCols);
    var contiguousGameCount = lastGameCol - firstGameCol + 1;
    if (contiguousGameCount === block.gameCols.length) {
      palpitesSheet
        .getRange(block.headerRow + 2, firstGameCol + 1, rowCount, contiguousGameCount)
        .setBackgrounds(backgrounds)
        .setFontColors(fontColors)
        .setFontWeights(fontWeights);
    }

    if (block.totalCol >= 0) {
      palpitesSheet.getRange(block.headerRow + 2, block.totalCol + 1, rowCount, 1).setValues(totaisDoBloco);
    }
    if (block.cravadasCol >= 0) {
      palpitesSheet.getRange(block.headerRow + 2, block.cravadasCol + 1, rowCount, 1).setValues(cravadasDoBloco);
    }
  });

  atualizarBaseRanking_(ss, totais);
  repararRankingSheet_(findSheet_(ss, SHEET_NAMES.ranking, true));
  PropertiesService.getScriptProperties().setProperty("SCORING_ENGINE_VERSION", SCORING_ENGINE_VERSION);
  SpreadsheetApp.flush();
}

function atualizarBaseRanking_(ss, totais) {
  var sheet = findSheet_(ss, SHEET_NAMES.ranking, true);
  var values = sheet.getDataRange().getValues();
  var headerInfo = detectHeader_(values, ["posicao", "participante", "pontos", "cravadas"]);
  if (!headerInfo) throw new Error("Cabeçalho do Ranking não encontrado.");

  var participantCols = [];
  headerInfo.headers.forEach(function (header, index) {
    if (header === "participante" || header === "nome") participantCols.push(index);
  });
  if (participantCols.length < 2) throw new Error("Base interna do Ranking não encontrada.");

  var participantCol = participantCols[participantCols.length - 1];
  var pointsCol = findColumnAfter_(headerInfo.headers, ["pontos", "total"], participantCol + 1);
  var cravadasCol = findColumnAfter_(headerInfo.headers, ["cravadas", "placares", "exatos"], participantCol + 1);
  var orderCol = findColumnAfter_(headerInfo.headers, ["ordem"], participantCol + 1);
  if (pointsCol < 0 || cravadasCol < 0 || orderCol < 0) {
    throw new Error("Colunas de cálculo do Ranking não encontradas.");
  }

  var firstRow = headerInfo.row + 1;
  var points = [];
  var cravadas = [];
  var orders = [];
  var rowCount = 0;

  for (var row = firstRow; row < values.length; row += 1) {
    var participante = normalizarNome_(values[row][participantCol]);
    if (!participante) break;
    var total = totais[normalizarTexto_(participante)] || { pontos: 0, cravadas: 0 };
    points.push([total.pontos]);
    cravadas.push([total.cravadas]);
    orders.push([total.pontos * 100000 + total.cravadas * 100 + (100 - rowCount)]);
    rowCount += 1;
  }

  if (!rowCount) throw new Error("Nenhum participante encontrado na base do Ranking.");
  sheet.getRange(firstRow + 1, pointsCol + 1, rowCount, 1).setValues(points);
  sheet.getRange(firstRow + 1, cravadasCol + 1, rowCount, 1).setValues(cravadas);
  sheet.getRange(firstRow + 1, orderCol + 1, rowCount, 1).setValues(orders);
}

function adicionarParticipanteNoRanking_(sheet, participante) {
  var values = sheet.getDataRange().getValues();
  var headerInfo = detectHeader_(values, ["posicao", "participante", "pontos", "cravadas"]);
  if (!headerInfo) throw new Error("Cabeçalho do Ranking não encontrado.");

  var headers = headerInfo.headers;
  var participantCols = [];
  headers.forEach(function (header, index) {
    if (header === "participante" || header === "nome") participantCols.push(index);
  });
  if (participantCols.length < 2) throw new Error("Coluna-base de participantes do Ranking não encontrada.");

  var outputParticipantCol = participantCols[0];
  var sourceParticipantCol = participantCols[participantCols.length - 1];
  var sourcePointsCol = findColumnAfter_(headers, ["pontos", "total"], sourceParticipantCol + 1);
  var sourceCravadasCol = findColumnAfter_(headers, ["cravadas", "placares", "exatos"], sourceParticipantCol + 1);
  var sourceOrderCol = findColumnAfter_(headers, ["ordem"], sourceParticipantCol + 1);
  if (sourcePointsCol < 0 || sourceCravadasCol < 0 || sourceOrderCol < 0) {
    throw new Error("Colunas-base de pontos, cravadas e ordem não encontradas no Ranking.");
  }

  var dataStart = headerInfo.row + 1;
  var existingRow = findRowByName_(values, dataStart, sourceParticipantCol, participante);
  if (existingRow >= 0) return { adicionado: false, row: existingRow + 1 };

  var targetRowIndex = dataStart;
  while (targetRowIndex < values.length && normalizarNome_(values[targetRowIndex][sourceParticipantCol])) {
    targetRowIndex += 1;
  }

  var rulesRow = values.findIndex(function (row) {
    return normalizarTexto_(row[0]).indexOf("regras") === 0;
  });
  if (rulesRow >= 0 && targetRowIndex >= rulesRow) {
    sheet.insertRowsBefore(rulesRow + 1, 1);
    targetRowIndex = rulesRow;
  }

  var sourceRowIndex = targetRowIndex - 1;
  if (sourceRowIndex < dataStart) throw new Error("Linha modelo do Ranking não encontrada.");

  var targetRow = targetRowIndex + 1;
  var sourceRow = sourceRowIndex + 1;
  var lastCol = Math.max(sheet.getLastColumn(), sourceOrderCol + 1);
  sheet.getRange(sourceRow, 1, 1, lastCol).copyTo(sheet.getRange(targetRow, 1, 1, lastCol));
  sheet.getRange(targetRow, sourceParticipantCol + 1).setValue(participante);

  var pointsRange = sheet.getRange(targetRow, sourcePointsCol + 1);
  var cravadasRange = sheet.getRange(targetRow, sourceCravadasCol + 1);
  if (!pointsRange.getFormula()) pointsRange.setValue(0);
  if (!cravadasRange.getFormula()) cravadasRange.setValue(0);

  return { adicionado: true, row: targetRow };
}

function repararRankingSheet_(sheet) {
  SpreadsheetApp.flush();
  var values = sheet.getDataRange().getValues();
  var headerInfo = detectHeader_(values, ["posicao", "participante", "pontos", "cravadas"]);
  if (!headerInfo) throw new Error("Cabeçalho do Ranking não encontrado.");

  var headers = headerInfo.headers;
  var participantCols = [];
  headers.forEach(function (header, index) {
    if (header === "participante" || header === "nome") participantCols.push(index);
  });
  if (participantCols.length < 2) return;

  var outputPositionCol = findColumn_(headers, ["posicao", "rank"]) + 1;
  var outputParticipantCol = participantCols[0] + 1;
  var sourceParticipantCol = participantCols[participantCols.length - 1] + 1;
  var sourcePointsCol = findColumnAfter_(headers, ["pontos", "total"], sourceParticipantCol) + 1;
  var sourceCravadasCol = findColumnAfter_(headers, ["cravadas", "placares", "exatos"], sourceParticipantCol) + 1;
  var sourceOrderCol = findColumnAfter_(headers, ["ordem"], sourceParticipantCol) + 1;
  if (outputPositionCol < 1 || sourcePointsCol < 1 || sourceCravadasCol < 1) {
    throw new Error("Colunas-base do Ranking não encontradas.");
  }

  var firstRow = headerInfo.row + 2;
  var base = [];
  for (var row = firstRow - 1; row < values.length; row += 1) {
    var participante = normalizarNome_(values[row][sourceParticipantCol - 1]);
    if (!participante) break;
    base.push({
      participante: participante,
      pontos: toNumber_(values[row][sourcePointsCol - 1]),
      cravadas: toNumber_(values[row][sourceCravadasCol - 1]),
      ordem: sourceOrderCol > 0 ? toNumber_(values[row][sourceOrderCol - 1]) : row
    });
  }
  if (!base.length) throw new Error("Nenhum participante encontrado na base do Ranking.");

  base.sort(function (a, b) {
    return b.pontos - a.pontos || b.cravadas - a.cravadas || b.ordem - a.ordem;
  });

  var output = base.map(function (item, index) {
    return [index + 1, item.participante, item.pontos, item.cravadas];
  });
  var outputStartCol = outputPositionCol;
  var outputWidth = outputParticipantCol - outputPositionCol + 3;
  if (outputWidth !== 4) {
    throw new Error("Estrutura de saída do Ranking diferente do esperado.");
  }
  sheet.getRange(firstRow, outputStartCol, base.length, outputWidth).clearContent();
  sheet.getRange(firstRow, outputStartCol, output.length, 4).setValues(output);
}

function findColumnAfter_(headers, names, startCol) {
  for (var index = startCol; index < headers.length; index += 1) {
    var header = headers[index];
    if (names.some(function (name) { return header.indexOf(normalizarTexto_(name)) >= 0; })) return index;
  }
  return -1;
}

function adicionarParticipanteNoPagamento_(sheet, participante) {
  var values = sheet.getDataRange().getValues();
  var headerInfo = detectHeader_(values, ["participante", "nome", "pix", "pagou", "data"]);
  if (!headerInfo) throw new Error("Cabeçalho de Pagamentos não encontrado.");

  var participantCol = findColumn_(headerInfo.headers, ["participante", "nome"]);
  if (participantCol < 0) throw new Error("Coluna de participante não encontrada em Pagamentos.");

  var dataStart = headerInfo.row + 1;
  var existingRow = findRowByName_(values, dataStart, participantCol, participante);
  if (existingRow >= 0) return { adicionado: false, row: existingRow + 1 };

  var targetRowIndex = dataStart;
  while (targetRowIndex < values.length && normalizarNome_(values[targetRowIndex][participantCol])) {
    targetRowIndex += 1;
  }

  var targetRow = targetRowIndex + 1;
  var sourceRow = Math.max(dataStart + 1, targetRow - 1);
  var lastCol = Math.max(sheet.getLastColumn(), headerInfo.headers.length);
  sheet.getRange(sourceRow, 1, 1, lastCol).copyTo(sheet.getRange(targetRow, 1, 1, lastCol));
  sheet.getRange(targetRow, 1, 1, lastCol).clearContent();
  sheet.getRange(targetRow, participantCol + 1).setValue(participante);

  return { adicionado: true, row: targetRow };
}

function importarPalpitesEmLote_(payload) {
  var itens = payload.palpites;
  if (!Array.isArray(itens)) throw new Error("Lista de palpites obrigatória.");
  if (!itens.length) throw new Error("Nenhum palpite enviado para importação.");

  var ss = getSpreadsheet_();
  var sheet = findSheet_(ss, SHEET_NAMES.palpites, true);
  var parsed = readPalpitesSheet_(ss);
  var values = sheet.getDataRange().getValues();
  var detalhes = [];
  var erros = [];
  var updates = [];
  var ignorados = 0;

  itens.forEach(function (item, index) {
    try {
      var participante = normalizarNome_(item.participante);
      var jogoId = String(item.jogoId || "");
      var golsCasa = Number(item.golsCasa);
      var golsFora = Number(item.golsFora);
      var decisao = String(item.decisao || "substituir");

      if (!participante) throw new Error("Participante obrigatório.");
      if (["substituir", "manter", "ignorar"].indexOf(decisao) < 0) throw new Error("Decisão de importação inválida.");
      if (!isValidScoreNumber_(golsCasa) || !isValidScoreNumber_(golsFora)) throw new Error("Placar inválido.");

      var jogo = (jogoId ? findJogoById_(parsed.jogos, jogoId) : null) || findJogoByTimes_(parsed.jogos, item);
      if (!jogo) throw new Error("Jogo não encontrado na aba de palpites.");

      var target =
        findValidatedTargetByCell_(values, item, participante, jogo) ||
        findPalpiteTarget_(parsed, item, participante, jogo) ||
        findPalpiteTargetInValues_(values, participante, jogo);
      if (!target) throw new Error("Célula de palpite não encontrada para participante e jogo.");

      var novoPalpite = golsCasa + "x" + golsFora;
      var atual = formatScore_(values[target.row - 1][target.col - 1]);
      var detalheBase = {
        participante: participante,
        jogo: jogo.mandante + " x " + jogo.visitante,
        atual: atual || "",
        novo: novoPalpite
      };

      if (decisao === "ignorar") {
        ignorados += 1;
        detalhes.push(Object.assign({}, detalheBase, { status: "ignorado" }));
        return;
      }

      if (atual && decisao !== "substituir") {
        ignorados += 1;
        detalhes.push(Object.assign({}, detalheBase, { status: "mantido" }));
        return;
      }

      if (atual === novoPalpite) {
        ignorados += 1;
        detalhes.push(Object.assign({}, detalheBase, { status: "sem_alteracao" }));
        return;
      }

      if (sheet.getRange(target.row, target.col).getFormula()) {
        throw new Error("A célula de destino contém fórmula e não será sobrescrita.");
      }

      updates.push({
        row: target.row,
        col: target.col,
        value: novoPalpite,
        atual: atual || "",
        detalhe: Object.assign({}, detalheBase, {
          celula: columnName_(target.col) + target.row
        })
      });
    } catch (err) {
      var message = "Item " + (index + 1) + ": " + errorMessage_(err);
      erros.push(message);
      detalhes.push({
        participante: normalizarNome_(item && item.participante),
        jogo: String(item && item.jogoId || ""),
        status: "erro",
        erro: message
      });
    }
  });

  writePalpiteUpdates_(sheet, updates);
  SpreadsheetApp.flush();
  if (updates.length) recalcularPontuacaoPlanilha_(ss);

  var importados = 0;
  var atualizados = 0;
  updates.forEach(function (update) {
    var gravado = formatScore_(sheet.getRange(update.row, update.col).getValue());
    if (gravado !== update.value) {
      var verificationMessage = "Falha ao confirmar gravação em " + columnName_(update.col) + update.row + ".";
      erros.push(verificationMessage);
      detalhes.push(Object.assign({}, update.detalhe, { status: "erro", erro: verificationMessage }));
      return;
    }

    if (update.atual) {
      atualizados += 1;
      detalhes.push(Object.assign({}, update.detalhe, { status: "atualizado" }));
    } else {
      importados += 1;
      detalhes.push(Object.assign({}, update.detalhe, { status: "importado" }));
    }
  });

  var alterados = importados + atualizados;
  var errorSuffix = erros.length ? " " + erros.length + " erro(s). Primeiro: " + erros[0] : "";

  return {
    ok: erros.length === 0 || alterados > 0,
    message: "Importação concluída: " + importados + " novos, " + atualizados + " atualizados, " + ignorados + " ignorados." + errorSuffix,
    importados: importados,
    atualizados: atualizados,
    ignorados: ignorados,
    erros: erros,
    detalhes: detalhes
  };
}

function isValidScoreNumber_(value) {
  return isFinite(value) && Math.floor(value) === value && value >= 0 && value <= 99;
}

function findJogoById_(jogos, jogoId) {
  return jogos.find(function (jogo) {
    return jogo.id === jogoId || (jogo.aliases || []).indexOf(jogoId) >= 0;
  }) || null;
}

function findPalpiteTarget_(parsed, payload, participante, jogo) {
  var participanteKey = normalizarTexto_(participante);
  var ids = uniqueStrings_([String(payload.jogoId || ""), jogo && jogo.id].concat((jogo && jogo.aliases) || []));

  for (var index = 0; index < ids.length; index += 1) {
    var target = parsed.index.palpites[ids[index] + "::" + participanteKey];
    if (target) return target;
  }

  return null;
}

function findPalpiteTargetInValues_(values, participante, jogo) {
  var participanteKey = normalizarTexto_(participante);
  var matches = [];

  for (var row = 0; row < values.length; row += 1) {
    var gameCols = [];
    for (var col = 0; col < values[row].length; col += 1) {
      var gameText = cleanString_(values[row][col]).replace(/\s+/g, " ");
      if (!looksLikeGame_(gameText)) continue;
      var gameInfo = parseGameText_(gameText);
      if (teamsEquivalent_(jogo.mandante, gameInfo.mandante, splitGameAbreviacao_(gameInfo.abreviacao).home) &&
          teamsEquivalent_(jogo.visitante, gameInfo.visitante, splitGameAbreviacao_(gameInfo.abreviacao).away)) {
        gameCols.push(col);
      }
    }

    if (!gameCols.length) continue;
    var resultInfo = findResultadoForColumn_(values, row, gameCols[0]);
    var stopRow = resultInfo ? resultInfo.row : Math.min(values.length, row + 45);
    var participantCol = guessParticipantColumn_(values, row, gameCols[0], stopRow);
    if (participantCol < 0) continue;

    for (var participantRow = row + 1; participantRow < stopRow; participantRow += 1) {
      if (normalizarTexto_(values[participantRow][participantCol]) === participanteKey) {
        gameCols.forEach(function (gameCol) {
          matches.push({ row: participantRow + 1, col: gameCol + 1 });
        });
      }
    }
  }

  return matches.length === 1 ? matches[0] : null;
}

function findValidatedTargetByCell_(values, payload, participante, jogo) {
  var address = parseCellAddress_(payload && payload.celula);
  if (!address || address.row < 1 || address.col < 1) return null;
  if (!values[address.row - 1] || address.col > values[address.row - 1].length) return null;

  var participantFound = false;
  for (var col = 0; col < address.col - 1; col += 1) {
    if (normalizarTexto_(values[address.row - 1][col]) === normalizarTexto_(participante)) {
      participantFound = true;
      break;
    }
  }
  if (!participantFound) return null;

  for (var row = address.row - 2; row >= Math.max(0, address.row - 46); row -= 1) {
    var header = cleanString_(values[row][address.col - 1]).replace(/\s+/g, " ");
    if (!looksLikeGame_(header)) continue;
    var gameInfo = parseGameText_(header);
    var parts = splitGameAbreviacao_(gameInfo.abreviacao);
    var sameGame =
      teamsEquivalent_(jogo.mandante, gameInfo.mandante, parts.home) &&
      teamsEquivalent_(jogo.visitante, gameInfo.visitante, parts.away);
    return sameGame ? { row: address.row, col: address.col } : null;
  }

  return null;
}

function parseCellAddress_(value) {
  var match = String(value || "").trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  var col = 0;
  for (var index = 0; index < match[1].length; index += 1) {
    col = col * 26 + match[1].charCodeAt(index) - 64;
  }
  return { row: Number(match[2]), col: col };
}

function findJogoByTimes_(jogos, payload) {
  var timeCasa = normalizarNome_(payload.timeCasa);
  var timeFora = normalizarNome_(payload.timeFora);
  if (!timeCasa || !timeFora) return null;

  var matches = jogos.filter(function (jogo) {
    var parts = splitGameAbreviacao_(jogo.abreviacao);
    return teamsEquivalent_(timeCasa, jogo.mandante, parts.home) && teamsEquivalent_(timeFora, jogo.visitante, parts.away);
  });

  return matches.length === 1 ? matches[0] : null;
}

function splitGameAbreviacao_(abreviacao) {
  var parts = String(abreviacao || "").split(/\s*(?:x|-)\s*/i);
  return {
    home: normalizarNome_(parts[0]),
    away: normalizarNome_(parts[1])
  };
}

function teamsEquivalent_(left, right, rightSigla) {
  var leftAliases = teamAliases_(left);
  var rightAliases = teamAliases_(right);

  teamAliases_(rightSigla).forEach(function (alias) {
    rightAliases.push(alias);
  });

  rightAliases = uniqueStrings_(rightAliases);
  return leftAliases.some(function (alias) {
    return rightAliases.indexOf(alias) >= 0;
  });
}

function teamAliases_(value) {
  var raw = normalizarNome_(value);
  var key = isAustriaSheetCode_(raw) ? "austria" : normalizarTexto_(raw);
  var aliases = [key];

  Object.keys(TEAM_NAMES).forEach(function (sigla) {
    var siglaKey = isAustriaSheetCode_(sigla) ? "austria" : normalizarTexto_(sigla);
    var nomeKey = normalizarTexto_(TEAM_NAMES[sigla]);
    if (key === siglaKey || key === nomeKey) {
      aliases.push(siglaKey);
      aliases.push(nomeKey);
    }
  });

  if (key === "senagal") {
    aliases.push("senegal");
    aliases.push("sen");
  }

  return uniqueStrings_(aliases);
}

function isAustriaSheetCode_(value) {
  return /^\s*\u00C1US\s*$/i.test(String(value || ""));
}

function uniqueStrings_(items) {
  var seen = {};
  var result = [];
  items.forEach(function (item) {
    var value = String(item || "");
    if (!value || seen[value]) return;
    seen[value] = true;
    result.push(value);
  });
  return result;
}

function writePalpiteUpdates_(sheet, updates) {
  if (!updates.length) return;

  updates.sort(function (a, b) {
    return a.col - b.col || a.row - b.row;
  });

  var group = [];
  function flushGroup() {
    if (!group.length) return;
    var first = group[0];
    var nextValues = group.map(function (item) { return [item.value]; });
    sheet.getRange(first.row, first.col, group.length, 1).setValues(nextValues);
    group = [];
  }

  updates.forEach(function (update) {
    var previous = group[group.length - 1];
    if (!previous || (previous.col === update.col && previous.row + 1 === update.row)) {
      group.push(update);
      return;
    }
    flushGroup();
    group.push(update);
  });

  flushGroup();
}

function columnName_(column) {
  var result = "";
  var current = Number(column);
  while (current > 0) {
    current -= 1;
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26);
  }
  return result;
}

function atualizarPagamento_(payload) {
  var participante = normalizarNome_(payload.participante);
  if (!participante) throw new Error("Participante obrigatório.");
  if (typeof payload.pago !== "boolean") throw new Error("Campo pago deve ser booleano.");

  var ss = getSpreadsheet_();
  var sheet = findSheet_(ss, SHEET_NAMES.pagamento, true);
  var values = sheet.getDataRange().getValues();
  var headerInfo = detectHeader_(values, ["participante", "nome", "pix", "pagou", "data"]);
  if (!headerInfo) throw new Error("Cabeçalho de pagamentos não encontrado.");

  var headers = headerInfo.headers;
  var participanteCol = findColumn_(headers, ["participante", "nome"]);
  var pagoCol = findColumn_(headers, ["pagou", "pago", "pix"]);
  var dataCol = findColumn_(headers, ["data"]);
  if (participanteCol < 0 || pagoCol < 0) throw new Error("Colunas de participante/pagamento não encontradas.");

  var targetRow = findRowByName_(values, headerInfo.row + 1, participanteCol, participante);
  if (targetRow < 0) throw new Error("Participante não encontrado na aba de pagamento.");

  setCellValueSafe_(sheet, targetRow + 1, pagoCol + 1, payload.pago ? "SIM" : "NÃO");
  if (dataCol >= 0) {
    setCellValueSafe_(sheet, targetRow + 1, dataCol + 1, payload.pago ? parseDateForSheet_(payload.dataPagamento) : "");
  }
}

function atualizarResultado_(payload) {
  var jogoId = String(payload.jogoId || "");
  var resultado = formatScore_(payload.resultado);
  if (!jogoId) throw new Error("jogoId obrigatório.");
  if (!resultado) throw new Error("Resultado inválido. Use formato 2x1.");

  var ss = getSpreadsheet_();
  var parsed = readPalpitesSheet_(ss);
  var target = parsed.index.jogos[jogoId];
  if (!target || !target.resultadoRow || !target.resultadoCol) {
    throw new Error("Célula de resultado não encontrada para este jogo.");
  }

  var sheet = findSheet_(ss, SHEET_NAMES.palpites, true);
  setCellValueSafe_(sheet, target.resultadoRow, target.resultadoCol, resultado);
  recalcularPontuacaoPlanilha_(ss);
}

function atualizarPalpite_(payload) {
  var participante = normalizarNome_(payload.participante);
  var jogoId = String(payload.jogoId || "");
  var palpite = formatScore_(payload.palpite);
  if (!participante || !palpite) throw new Error("Participante e palpite válido são obrigatórios.");

  var ss = getSpreadsheet_();
  var parsed = readPalpitesSheet_(ss);
  var jogo = (jogoId ? findJogoById_(parsed.jogos, jogoId) : null) || findJogoByTimes_(parsed.jogos, payload);
  if (!jogo) throw new Error("Jogo nao encontrado na aba de palpites.");

  var sheet = findSheet_(ss, SHEET_NAMES.palpites, true);
  var values = sheet.getDataRange().getValues();
  var target =
    findValidatedTargetByCell_(values, payload, participante, jogo) ||
    findPalpiteTarget_(parsed, payload, participante, jogo) ||
    findPalpiteTargetInValues_(values, participante, jogo);
  if (!target) throw new Error("Célula de palpite não encontrada.");

  setCellValueSafe_(sheet, target.row, target.col, palpite);
  SpreadsheetApp.flush();
  if (formatScore_(sheet.getRange(target.row, target.col).getValue()) !== palpite) {
    throw new Error("O palpite não foi confirmado na célula " + columnName_(target.col) + target.row + ".");
  }
  recalcularPontuacaoPlanilha_(ss);
}

function parsePostPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error("Corpo da requisição ausente.");
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error("JSON inválido no corpo da requisição.");
  }
}

function assertAdminToken_(token) {
  var configured = PropertiesService.getScriptProperties().getProperty("ADMIN_TOKEN");
  if (!configured) throw new Error("ADMIN_TOKEN não configurado em PropertiesService.");
  if (String(token || "") !== configured) throw new Error("Token administrativo inválido.");
}

function setCellValueSafe_(sheet, row, col, value) {
  var range = sheet.getRange(row, col);
  if (range.getFormula()) throw new Error("A célula de destino contém fórmula e não será sobrescrita.");
  range.setValue(value);
}

function findSheet_(ss, aliases, required) {
  var sheets = ss.getSheets();
  var wanted = aliases.map(function (name) { return normalizarTexto_(name); });
  var sheet = sheets.find(function (item) {
    return wanted.indexOf(normalizarTexto_(item.getName())) >= 0;
  });
  if (!sheet && required) throw new Error("Aba não encontrada: " + aliases[0]);
  return sheet || null;
}

function detectHeader_(values, keywords) {
  var best = null;
  for (var row = 0; row < Math.min(values.length, MAX_SCAN_ROWS); row += 1) {
    var headers = values[row].map(function (cell) { return normalizarTexto_(cell); });
    var score = keywords.reduce(function (total, keyword) {
      return total + (headers.some(function (header) { return header.indexOf(normalizarTexto_(keyword)) >= 0; }) ? 1 : 0);
    }, 0);
    if (score > 1 && (!best || score > best.score)) {
      best = { row: row, headers: headers, score: score };
    }
  }
  return best;
}

function findColumn_(headers, names) {
  for (var index = 0; index < headers.length; index += 1) {
    var header = headers[index];
    if (names.some(function (name) { return header.indexOf(normalizarTexto_(name)) >= 0; })) return index;
  }
  return -1;
}

function findRowByName_(values, startRow, col, name) {
  var normalized = normalizarTexto_(name);
  for (var row = startRow; row < values.length; row += 1) {
    if (normalizarTexto_(values[row][col]) === normalized) return row;
  }
  return -1;
}

function isRowEmpty_(row) {
  return row.every(function (cell) { return cleanString_(cell) === ""; });
}

function looksLikeGame_(text) {
  var normalized = normalizarTexto_(text).toUpperCase();
  return /^[A-Z]{2,5}\s*(X|-)\s*[A-Z]{2,5}$/.test(normalized);
}

function parseGameText_(text) {
  var parts = String(text).split(/\s*(?:x|X|-)\s*/);
  var homeRaw = cleanString_(parts[0]);
  var awayRaw = cleanString_(parts[1]);
  var home = normalizarTexto_(homeRaw).toUpperCase();
  var away = normalizarTexto_(awayRaw).toUpperCase();

  if (/^\u00C1US$/i.test(homeRaw)) home = "AUT";
  if (/^\u00C1US$/i.test(awayRaw)) away = "AUT";

  return {
    mandante: TEAM_NAMES[home] || homeRaw,
    visitante: TEAM_NAMES[away] || awayRaw,
    abreviacao: home + " x " + away
  };
}

function parseDay_(value) {
  var text = cleanString_(value);
  var match = text.match(/DIA\s+(\d+)\s*-\s*(\d{1,2})\/(\d{1,2})/i);
  if (!match) return null;
  return {
    label: "Dia " + match[1],
    date: "2026-" + pad2_(match[3]) + "-" + pad2_(match[2])
  };
}

function findLeftDay_(values, row, col) {
  for (var c = col; c >= Math.max(0, col - 12); c -= 1) {
    for (var r = row; r >= Math.max(0, row - 3); r -= 1) {
      var value = cleanString_(values[r][c]);
      if (/DIA\s+\d+/i.test(value)) return value;
    }
  }
  return "";
}

function findResultadoForColumn_(values, headerRow, gameCol) {
  var limit = Math.min(values.length - 1, headerRow + 45);
  for (var row = headerRow + 1; row <= limit; row += 1) {
    var leftText = cleanString_(values[row].slice(Math.max(0, gameCol - 6), gameCol).join(" "));
    var value = values[row][gameCol];
    if (/resultado|oficial|final/i.test(leftText)) {
      return { row: row, value: value };
    }
  }

  return null;
}

function guessParticipantColumn_(values, headerRow, gameCol, stopRow) {
  var bestCol = -1;
  var bestScore = 0;
  for (var col = Math.max(0, gameCol - 8); col < gameCol; col += 1) {
    var score = 0;
    for (var row = headerRow + 1; row < Math.min(values.length, stopRow); row += 1) {
      var text = normalizarNome_(values[row][col]);
      if (text && !formatScore_(text) && !shouldSkipParticipantName_(text)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }
  return bestCol;
}

function findNearbyText_(values, row, col, labels, rowsBack, colsBack) {
  var minRow = Math.max(0, row - rowsBack);
  var minCol = Math.max(0, col - colsBack);
  for (var r = minRow; r <= row; r += 1) {
    for (var c = minCol; c <= col; c += 1) {
      var text = cleanString_(values[r][c]);
      var normalized = normalizarTexto_(text);
      if (labels.some(function (label) { return normalized.indexOf(normalizarTexto_(label)) >= 0; })) {
        var sameCellSuffix = text.replace(/^[^:]+:\s*/, "");
        if (sameCellSuffix && normalizarTexto_(sameCellSuffix) !== normalized) return sameCellSuffix;
        var right = cleanString_(values[r][c + 1]);
        if (right) return right;
      }
    }
  }
  return "";
}

function findNearbyDate_(values, row, col) {
  var minRow = Math.max(0, row - 5);
  var minCol = Math.max(0, col - 5);
  for (var r = minRow; r <= row + 1 && r < values.length; r += 1) {
    for (var c = minCol; c <= col + 1 && c < values[r].length; c += 1) {
      var formatted = formatDateIso_(values[r][c]);
      if (formatted) return formatted;
    }
  }
  return "";
}

function findNearbyTime_(values, row, col) {
  var minRow = Math.max(0, row - 5);
  var minCol = Math.max(0, col - 5);
  for (var r = minRow; r <= row + 1 && r < values.length; r += 1) {
    for (var c = minCol; c <= col + 1 && c < values[r].length; c += 1) {
      var formatted = formatTime_(values[r][c]);
      if (formatted) return formatted;
    }
  }
  return "";
}

function shouldSkipParticipantName_(name) {
  var text = normalizarTexto_(name);
  if (!text) return true;
  return /^(?:total|resultado|oficial|dia(?:\s+\d+.*)?|data|horario|rodada|participante|nome|sabado|domingo|segunda|terca|quarta|quinta|sexta)$/.test(text);
}

function calcularPontuacao_(palpite, resultado) {
  var p = parseScore_(palpite);
  var r = parseScore_(resultado);
  if (!p || !r) return { pontos: 0, cravada: false, tipo: "pendente" };
  if (p.casa === r.casa && p.fora === r.fora) return { pontos: 5, cravada: true, tipo: "exato" };
  if (winner_(p) === "empate" && winner_(r) === "empate") return { pontos: 2, cravada: false, tipo: "empate" };
  if (winner_(p) === winner_(r)) return { pontos: 2, cravada: false, tipo: "vencedor" };
  return { pontos: 0, cravada: false, tipo: "erro" };
}

function parseScore_(value) {
  var match = cleanString_(value).match(/(\d{1,2})\s*(?:[xX-]|\ba\b)\s*(\d{1,2})/i);
  if (!match) return null;
  return { casa: Number(match[1]), fora: Number(match[2]) };
}

function formatScore_(value) {
  var score = parseScore_(value);
  return score ? score.casa + "x" + score.fora : null;
}

function winner_(score) {
  if (score.casa > score.fora) return "casa";
  if (score.fora > score.casa) return "fora";
  return "empate";
}

function parseBoolean_(value) {
  if (value === true) return true;
  var text = normalizarTexto_(value);
  return ["sim", "s", "pago", "ok", "true", "1"].indexOf(text) >= 0;
}

function formatDateIso_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var text = cleanString_(value);
  var br = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (br) {
    var year = br[3] ? normalizeYear_(br[3]) : new Date().getFullYear();
    return year + "-" + pad2_(br[2]) + "-" + pad2_(br[1]);
  }
  var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[1] + "-" + iso[2] + "-" + iso[3] : null;
}

function parseDateForSheet_(value) {
  var iso = formatDateIso_(value);
  if (!iso) return "";
  var parts = iso.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatTime_(value) {
  if (!value && value !== 0) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  }
  var text = cleanString_(value);
  var match = text.match(/(\d{1,2})[:hH](\d{2})/);
  return match ? pad2_(match[1]) + ":" + match[2] : "";
}

function normalizeYear_(year) {
  var numeric = Number(year);
  return numeric < 100 ? 2000 + numeric : numeric;
}

function pad2_(value) {
  return String(value).padStart(2, "0");
}

function normalizarNome_(value) {
  return cleanString_(value).replace(/\s+/g, " ").trim();
}

function cleanString_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizarTexto_(value) {
  return cleanString_(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber_(value) {
  if (typeof value === "number") return value;
  var parsed = Number(cleanString_(value).replace(",", ".").replace(/[^\d.-]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

function slug_(value) {
  return normalizarTexto_(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sigla_(name) {
  return normalizarTexto_(name)
    .split(" ")
    .map(function (part) { return part.charAt(0); })
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorMessage_(err) {
  return err && err.message ? err.message : String(err);
}
