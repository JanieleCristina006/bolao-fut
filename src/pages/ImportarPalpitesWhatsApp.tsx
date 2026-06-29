import { ClipboardPaste, Eraser, RefreshCcw, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { PreviaImportacaoPalpites } from "../components/importacao/PreviaImportacaoPalpites";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { useDashboard } from "../hooks/useDashboard";
import { api, isAdminWritesEnabled } from "../services/api";
import type {
  EstruturaImportacaoPalpites,
  ImportacaoPalpiteItem,
  ImportarPalpiteEmLoteItem,
  ImportarPalpitesEmLoteResponse,
  ResultadoImportacaoPalpites,
  StatusImportacaoPalpite
} from "../types/importacaoPalpites";
import { normalizarTexto } from "../utils/formatadores";
import { processarPalpitesWhatsApp } from "../utils/processarPalpitesWhatsApp";

const exemploPlaceholder = `JOGO DIA 15/06 - SEGUNDA - HOJEEE

Meus palpites (Nome do participante)

Brasil 3 x 1 Japão (Brasil)
Alemanha 3 x 0 Paraguai (Alemanha)
Holanda 0 x 1 Marrocos (Marrocos)`;

function temPalpiteAtual(item: ImportacaoPalpiteItem): boolean {
  return Boolean(item.palpiteAtual || item.classificadoAtual);
}

function statusEditado(item: ImportacaoPalpiteItem): StatusImportacaoPalpite {
  if (!item.incluir) return "removido";
  if (!item.participanteOficial) return "participante-nao-encontrado";
  if (!item.jogoId) return "jogo-nao-encontrado";
  if (!item.celulaPlanilha) return "celula-nao-encontrada";
  if (item.golsCasa === null || item.golsFora === null || item.golsCasa < 0 || item.golsFora < 0) return "formato-invalido";
  if (item.duplicado) return "duplicado";
  if (temPalpiteAtual(item)) return "palpite-existente";
  return "valido";
}

function revalidarItem(item: ImportacaoPalpiteItem): ImportacaoPalpiteItem {
  if (item.status === "nao-enviou") return item;

  const status = statusEditado(item);
  const erros: string[] = [];
  if (status === "participante-nao-encontrado") erros.push("Selecione um participante cadastrado.");
  if (status === "jogo-nao-encontrado") erros.push("Selecione um jogo cadastrado.");
  if (status === "celula-nao-encontrada") erros.push("A planilha não informou a célula deste participante para o jogo selecionado.");
  if (status === "formato-invalido") erros.push("Informe um placar válido.");

  const valido = erros.length === 0 && status !== "removido";
  return {
    ...item,
    status,
    erros,
    valido,
    importavel: valido && item.usarNaImportacao,
    decisao: temPalpiteAtual(item) ? item.decisao : "substituir"
  };
}

function montarResumo(resultado: ResultadoImportacaoPalpites): ResultadoImportacaoPalpites {
  const itens = resultado.itens;
  return {
    ...resultado,
    participantes: resultado.participantes.map((participante) => ({
      ...participante,
      jogos: itens.filter((item) => item.participanteTexto === participante.participante)
    })),
    resumo: {
      total: itens.length,
      validos: itens.filter((item) => item.valido).length,
      importaveis: itens.filter((item) => item.importavel && item.incluir && item.usarNaImportacao).length,
      invalidos: itens.filter((item) => !item.valido && item.status !== "nao-enviou" && item.status !== "removido").length,
      duplicados: itens.filter((item) => item.duplicado).length,
      naoEnviados: itens.filter((item) => item.status === "nao-enviou").length,
      comPalpiteExistente: itens.filter(temPalpiteAtual).length
    }
  };
}

function itemPodeSerEnviado(item: ImportacaoPalpiteItem): item is ImportacaoPalpiteItem & {
  participanteOficial: string;
  jogoId: string;
  celulaPlanilha: string;
  golsCasa: number;
  golsFora: number;
} {
  if (!item.incluir || !item.importavel || !item.usarNaImportacao) return false;
  if (item.status === "nao-enviou" || item.status === "removido") return false;
  if (temPalpiteAtual(item) && item.decisao !== "substituir") return false;
  return Boolean(item.participanteOficial && item.jogoId && item.celulaPlanilha && item.golsCasa !== null && item.golsFora !== null);
}

function encontrarAlvo(
  estrutura: EstruturaImportacaoPalpites,
  participante: string | undefined,
  jogoId: string | undefined
) {
  if (!participante || !jogoId) return undefined;
  const participanteKey = normalizarTexto(participante);
  return estrutura.alvos.find(
    (alvo) => alvo.jogoId === jogoId && normalizarTexto(alvo.participante) === participanteKey
  );
}

function aplicarEstrutura(
  resultado: ResultadoImportacaoPalpites,
  estrutura: EstruturaImportacaoPalpites
): ResultadoImportacaoPalpites {
  const itens = resultado.itens.map((item) => {
    if (item.status === "nao-enviou" || item.status === "removido") return item;
    const alvo = encontrarAlvo(estrutura, item.participanteOficial, item.jogoId);
    if (!item.valido) {
      return { ...item, celulaPlanilha: alvo?.celula, cabecalhoPlanilha: alvo?.cabecalho };
    }
    if (!alvo) {
      return {
        ...item,
        status: "celula-nao-encontrada" as const,
        valido: false,
        importavel: false,
        incluir: false,
        erros: [...item.erros, "Célula não encontrada na estrutura atual da planilha."]
      };
    }
    return {
      ...item,
      celulaPlanilha: alvo.celula,
      cabecalhoPlanilha: alvo.cabecalho,
      palpiteAtual: alvo.palpiteAtual || item.palpiteAtual,
      classificadoAtual: alvo.classificadoAtual || item.classificadoAtual
    };
  });

  return montarResumo({ ...resultado, itens });
}

export function ImportarPalpitesWhatsApp() {
  const { data, isLoading, error, refetch } = useDashboard();
  const { showToast } = useToast();
  const adminWritesEnabled = isAdminWritesEnabled();
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<ResultadoImportacaoPalpites | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importacaoConcluida, setImportacaoConcluida] = useState<ImportarPalpitesEmLoteResponse | null>(null);
  const [estrutura, setEstrutura] = useState<EstruturaImportacaoPalpites | null>(null);
  const [adminToken] = useState(window.sessionStorage.getItem("bolao-admin-token") ?? "");

  const palpitesParaEnviar = useMemo<ImportarPalpiteEmLoteItem[]>(() => {
    if (!resultado) return [];
    return resultado.itens.filter(itemPodeSerEnviado).map((item) => ({
      participante: item.participanteOficial,
      jogoId: item.jogoId,
      timeCasa: item.mandanteOficial ?? item.timeCasa,
      timeFora: item.visitanteOficial ?? item.timeFora,
      cabecalho: item.cabecalhoPlanilha,
      celula: item.celulaPlanilha,
      golsCasa: item.golsCasa,
      golsFora: item.golsFora,
      classificado: item.classificado || null,
      decisao: item.decisao
    }));
  }, [resultado]);

  async function processarTexto() {
    if (!data) return;
    setIsProcessing(true);
    try {
      const estruturaAtual = adminWritesEnabled
        ? await api.getEstruturaImportacao()
        : {
            participantes: data.participantes,
            jogos: data.jogos.map((jogo) => ({ ...jogo, cabecalhoPlanilha: jogo.abreviacao, celulaCabecalho: "" })),
            palpites: data.palpites,
            alvos: [],
            atualizadoEm: new Date().toISOString()
          };
      const processado = processarPalpitesWhatsApp(texto, {
        participantes: estruturaAtual.participantes,
        jogos: estruturaAtual.jogos,
        palpitesExistentes: estruturaAtual.palpites
      });
      setEstrutura(estruturaAtual);
      setResultado(adminWritesEnabled ? aplicarEstrutura(processado, estruturaAtual) : processado);
      setImportacaoConcluida(null);
      if (processado.erros.length > 0) {
        showToast(processado.erros[0]);
      } else {
        showToast(`${processado.resumo.total} itens encontrados. Confira a prévia antes de importar.`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível consultar a estrutura atual da planilha.");
    } finally {
      setIsProcessing(false);
    }
  }

  function limparTudo() {
    setTexto("");
    setResultado(null);
    setEstrutura(null);
    setImportacaoConcluida(null);
  }

  function limparCamposImportacao() {
    setTexto("");
    setResultado(null);
    setEstrutura(null);
  }

  function atualizarItem(id: string, patch: Partial<ImportacaoPalpiteItem>) {
    setResultado((current) => {
      if (!current) return current;
      const itens = current.itens.map((item) => {
        if (item.id !== id) return item;
        const alterado = { ...item, ...patch };
        const alvo = estrutura ? encontrarAlvo(estrutura, alterado.participanteOficial, alterado.jogoId) : undefined;
        const next = revalidarItem({
          ...alterado,
          celulaPlanilha: alvo?.celula,
          cabecalhoPlanilha: alvo?.cabecalho
        });
        if (temPalpiteAtual(next) && next.decisao === "ignorar") {
          return { ...next, incluir: false, status: "removido" as const, valido: false, importavel: false };
        }
        return next;
      });
      return montarResumo({ ...current, itens });
    });
  }

  function toggleIncluir(id: string) {
    setResultado((current) => {
      if (!current) return current;
      const itens = current.itens.map((item) => (item.id === id ? revalidarItem({ ...item, incluir: !item.incluir }) : item));
      return montarResumo({ ...current, itens });
    });
  }

  async function confirmarImportacao() {
    if (!resultado) return;
    if (!adminWritesEnabled) {
      showToast("A importação em lote exige a integração ativa com o Google Apps Script.");
      return;
    }
    if (!adminToken) {
      showToast("Informe o token administrativo antes de importar.");
      return;
    }
    if (palpitesParaEnviar.length === 0) {
      showToast("Nenhum item válido selecionado para importar.");
      return;
    }

    const temDuplicados = resultado.itens.some((item) => item.duplicado && item.incluir && item.usarNaImportacao);
    if (temDuplicados && !window.confirm("Há palpites duplicados. Confirmar usando os itens marcados como últimos?")) return;

    const temSubstituicoes = resultado.itens.some((item) => temPalpiteAtual(item) && item.decisao === "substituir" && item.incluir);
    if (temSubstituicoes && !window.confirm("Há palpites existentes que serão substituídos. Confirmar importação?")) return;

    setIsImporting(true);
    try {
      const resposta = await api.importarPalpitesEmLote({
        adminToken,
        data: resultado.participantes.find((participante) => participante.data)?.data ?? null,
        palpites: palpitesParaEnviar
      });
      await refetch();
      const totalImportado = resposta.importados + resposta.atualizados;
      if (resposta.erros.length === 0 || totalImportado > 0) {
        showToast(resposta.erros.length === 0 ? `${totalImportado} palpites importados com sucesso!` : resposta.message);
        limparCamposImportacao();
        setImportacaoConcluida(null);
      } else {
        setImportacaoConcluida(resposta);
        showToast(resposta.message);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível importar os palpites.");
    } finally {
      setIsImporting(false);
    }
  }

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState message={error ?? "Dados indisponíveis para importação."} onRetry={refetch} />;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Importar palpites do WhatsApp</h2>
          <p className="text-sm text-slate-500">Cole as mensagens, processe, confira a prévia e confirme a gravação em lote na planilha.</p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap lg:justify-end">
          <Button variant="secondary" icon={<RefreshCcw className="h-4 w-4" aria-hidden />} onClick={() => void refetch()}>
            Recarregar dados
          </Button>
        </div>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
            <label className="space-y-2">
              <span className="text-sm font-bold text-slate-700">Mensagens copiadas do WhatsApp</span>
              <textarea
                className="min-h-72 w-full rounded-lg border border-slate-200 bg-white p-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100 sm:text-sm"
                value={texto}
                placeholder={exemploPlaceholder}
                onChange={(event) => setTexto(event.target.value)}
              />
            </label>
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                {adminWritesEnabled
                  ? "A confirmação será validada novamente pelo Google Apps Script antes de gravar."
                  : "Escrita desativada nesta fonte de dados. Use a API do Google Apps Script para importar."}
              </div>
              <div className="grid gap-2">
                <Button
                  icon={isProcessing ? <Spinner className="h-4 w-4" label="Processando" /> : <ClipboardPaste className="h-4 w-4" aria-hidden />}
                  disabled={isProcessing || !texto.trim()}
                  onClick={() => void processarTexto()}
                >
                  {isProcessing ? "Processando..." : "Processar palpites"}
                </Button>
                <Button variant="secondary" icon={<Eraser className="h-4 w-4" aria-hidden />} onClick={limparTudo}>
                  Limpar texto
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {resultado ? (
        <>
          <PreviaImportacaoPalpites
            resultado={resultado}
            participantes={estrutura?.participantes ?? data.participantes}
            jogos={estrutura?.jogos ?? data.jogos}
            onItemChange={atualizarItem}
            onToggleIncluir={toggleIncluir}
          />

          <div className="sticky bottom-16 z-20 rounded-lg border border-slate-200 bg-white p-4 shadow-soft lg:bottom-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-slate-600">
                <strong className="text-slate-950">{palpitesParaEnviar.length}</strong> palpites serão gravados agora.
                {resultado.resumo.comPalpiteExistente > 0 ? ` ${resultado.resumo.comPalpiteExistente} itens têm palpite atual para conferir.` : ""}
              </div>
              <Button
                className="w-full lg:w-auto"
                icon={isImporting ? <Spinner className="h-4 w-4" label="Importando" /> : <Send className="h-4 w-4" aria-hidden />}
                disabled={isImporting || palpitesParaEnviar.length === 0 || !adminWritesEnabled}
                onClick={() => void confirmarImportacao()}
              >
                {isImporting ? "Importando..." : "Confirmar importação"}
              </Button>
            </div>
          </div>

          {importacaoConcluida ? (
            <Card>
              <CardBody className="space-y-3">
                <h3 className="font-black text-slate-950">Resultado da gravação</h3>
                <p className="text-sm text-slate-600">{importacaoConcluida.message}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {importacaoConcluida.detalhes.map((detalhe, index) => (
                    <div
                      key={`${detalhe.participante}-${detalhe.jogo}-${index}`}
                      className={detalhe.status === "erro" ? "rounded-lg border border-red-200 bg-red-50 p-3 text-sm" : "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"}
                    >
                      <strong className="block text-slate-950">{detalhe.participante} — {detalhe.jogo}</strong>
                      <span className="text-slate-600">
                        {detalhe.erro ?? `${detalhe.novo ?? "Palpite"} gravado${detalhe.celula ? ` em ${detalhe.celula}` : ""}.`}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
