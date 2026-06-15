const SHEET_NAMES = {
  palpites: ["BOLÃO - PALPITES"],
  tabela: ["BOLÃO - TABELA"],
  pagamento: ["BOLÃO - PAGAMENTO"],
  ranking: ["RANKING"]
};

const VALOR_PIX = 10;
const MAX_SCAN_ROWS = 120;

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

function handleGet_(action, params) {
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

function readSnapshot_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
  var posicaoCol = findColumn_(headers, ["posicao", "rank"]);
  var participanteCol = findColumn_(headers, ["participante", "nome"]);
  var pontosCol = findColumn_(headers, ["pontos", "total"]);
  var cravadasCol = findColumn_(headers, ["cravadas", "placares", "exatos"]);
  var palpitesCol = findColumn_(headers, ["palpites", "quantidade"]);

  if (participanteCol < 0 || pontosCol < 0) return [];

  return values
    .slice(headerInfo.row + 1)
    .filter(function (row) { return !isRowEmpty_(row); })
    .map(function (row, index) {
      var participante = normalizarNome_(row[participanteCol]);
      if (!participante) return null;

      return {
        posicao: posicaoCol >= 0 && toNumber_(row[posicaoCol]) > 0 ? toNumber_(row[posicaoCol]) : index + 1,
        participante: participante,
        pontos: toNumber_(row[pontosCol]),
        cravadas: cravadasCol >= 0 ? toNumber_(row[cravadasCol]) : 0,
        palpites: palpitesCol >= 0 ? toNumber_(row[palpitesCol]) : 0,
        acertos: 0,
        aproveitamento: 0,
        ordemOriginal: index
      };
    })
    .filter(Boolean)
    .sort(function (a, b) { return a.posicao - b.posicao; });
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

      if (!jogosById[id]) {
        jogosById[id] = {
          id: id,
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
        index.jogos[id] = {
          headerRow: row + 1,
          headerCol: col + 1,
          resultadoRow: resultadoInfo ? resultadoInfo.row + 1 : null,
          resultadoCol: resultadoInfo ? col + 1 : null
        };
      }

      var stopRow = resultadoInfo ? resultadoInfo.row : Math.min(values.length - 1, row + 35);
      for (var participantRow = row + 1; participantRow < stopRow; participantRow += 1) {
        var participante = participantCol >= 0 ? normalizarNome_(values[participantRow][participantCol]) : "";
        if (!participante || shouldSkipParticipantName_(participante)) continue;

        index.palpites[id + "::" + normalizarTexto_(participante)] = {
          row: participantRow + 1,
          col: col + 1
        };

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

function importarPalpitesEmLote_(payload) {
  var itens = payload.palpites;
  if (!Array.isArray(itens)) throw new Error("Lista de palpites obrigatória.");
  if (!itens.length) throw new Error("Nenhum palpite enviado para importação.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
      if (!jogoId) throw new Error("jogoId obrigatório.");
      if (["substituir", "manter", "ignorar"].indexOf(decisao) < 0) throw new Error("Decisão de importação inválida.");
      if (!isValidScoreNumber_(golsCasa) || !isValidScoreNumber_(golsFora)) throw new Error("Placar inválido.");

      var jogo = findJogoById_(parsed.jogos, jogoId);
      if (!jogo) throw new Error("Jogo não encontrado na aba de palpites.");

      var target = parsed.index.palpites[jogoId + "::" + normalizarTexto_(participante)];
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
        detalhe: detalheBase
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

  var importados = 0;
  var atualizados = 0;
  updates.forEach(function (update) {
    if (update.atual) {
      atualizados += 1;
      detalhes.push(Object.assign({}, update.detalhe, { status: "atualizado" }));
    } else {
      importados += 1;
      detalhes.push(Object.assign({}, update.detalhe, { status: "importado" }));
    }
  });

  SpreadsheetApp.flush();

  return {
    ok: true,
    message: "Importação concluída: " + importados + " novos, " + atualizados + " atualizados, " + ignorados + " ignorados.",
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
  return jogos.find(function (jogo) { return jogo.id === jogoId; }) || null;
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

function atualizarPagamento_(payload) {
  var participante = normalizarNome_(payload.participante);
  if (!participante) throw new Error("Participante obrigatório.");
  if (typeof payload.pago !== "boolean") throw new Error("Campo pago deve ser booleano.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
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

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var parsed = readPalpitesSheet_(ss);
  var target = parsed.index.jogos[jogoId];
  if (!target || !target.resultadoRow || !target.resultadoCol) {
    throw new Error("Célula de resultado não encontrada para este jogo.");
  }

  var sheet = findSheet_(ss, SHEET_NAMES.palpites, true);
  setCellValueSafe_(sheet, target.resultadoRow, target.resultadoCol, resultado);
}

function atualizarPalpite_(payload) {
  var participante = normalizarNome_(payload.participante);
  var jogoId = String(payload.jogoId || "");
  var palpite = formatScore_(payload.palpite);
  if (!participante || !jogoId || !palpite) throw new Error("Participante, jogoId e palpite válido são obrigatórios.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var parsed = readPalpitesSheet_(ss);
  var target = parsed.index.palpites[jogoId + "::" + normalizarTexto_(participante)];
  if (!target) throw new Error("Célula de palpite não encontrada.");

  var sheet = findSheet_(ss, SHEET_NAMES.palpites, true);
  setCellValueSafe_(sheet, target.row, target.col, palpite);
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
    if (/resultado|oficial|final/i.test(leftText) && formatScore_(value)) {
      return { row: row, value: value };
    }
  }

  for (var fallbackRow = limit; fallbackRow > headerRow; fallbackRow -= 1) {
    var fallbackValue = values[fallbackRow][gameCol];
    if (formatScore_(fallbackValue)) return { row: fallbackRow, value: fallbackValue };
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
  return !text || /total|resultado|oficial|dia|data|horario|rodada|participante|nome|sabado|domingo|segunda|terca|quarta|quinta|sexta/.test(text);
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
