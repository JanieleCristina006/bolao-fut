import { ClipboardPaste, Eraser, KeyRound, RefreshCcw, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { PreviaImportacaoPalpites } from "../components/importacao/PreviaImportacaoPalpites";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { useDashboard } from "../hooks/useDashboard";
import { api, isAdminWritesEnabled } from "../services/api";
import type { ImportacaoPalpiteItem, ImportarPalpiteEmLoteItem, ResultadoImportacaoPalpites, StatusImportacaoPalpite } from "../types/importacaoPalpites";
import { processarPalpitesWhatsApp } from "../utils/processarPalpitesWhatsApp";

const exemploPlaceholder = `JOGO DIA 15/06 - SEGUNDA - HOJEEE

Meus palpites (Nome do participante)

Espanha 2x1 Cabo Verde
Bélgica 1 x 0 Egito
Arábia Saudita 2 a 2 Uruguai`;

function statusEditado(item: ImportacaoPalpiteItem): StatusImportacaoPalpite {
  if (!item.incluir) return "removido";
  if (!item.participanteOficial) return "participante-nao-encontrado";
  if (!item.jogoId) return "jogo-nao-encontrado";
  if (item.golsCasa === null || item.golsFora === null || item.golsCasa < 0 || item.golsFora < 0) return "formato-invalido";
  if (item.duplicado) return "duplicado";
  if (item.palpiteAtual) return "palpite-existente";
  return "valido";
}

function revalidarItem(item: ImportacaoPalpiteItem): ImportacaoPalpiteItem {
  if (item.status === "nao-enviou") return item;

  const status = statusEditado(item);
  const erros: string[] = [];
  if (status === "participante-nao-encontrado") erros.push("Selecione um participante cadastrado.");
  if (status === "jogo-nao-encontrado") erros.push("Selecione um jogo cadastrado.");
  if (status === "formato-invalido") erros.push("Informe um placar válido.");

  const valido = erros.length === 0 && status !== "removido";
  return {
    ...item,
    status,
    erros,
    valido,
    importavel: valido && item.usarNaImportacao,
    decisao: item.palpiteAtual ? item.decisao : "substituir"
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
      comPalpiteExistente: itens.filter((item) => Boolean(item.palpiteAtual)).length
    }
  };
}

function itemPodeSerEnviado(item: ImportacaoPalpiteItem): item is ImportacaoPalpiteItem & {
  participanteOficial: string;
  jogoId: string;
  golsCasa: number;
  golsFora: number;
} {
  if (!item.incluir || !item.importavel || !item.usarNaImportacao) return false;
  if (item.status === "nao-enviou" || item.status === "removido") return false;
  if (item.palpiteAtual && item.decisao !== "substituir") return false;
  return Boolean(item.participanteOficial && item.jogoId && item.golsCasa !== null && item.golsFora !== null);
}

export function ImportarPalpitesWhatsApp() {
  const { data, isLoading, error, refetch } = useDashboard();
  const { showToast } = useToast();
  const adminWritesEnabled = isAdminWritesEnabled();
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<ResultadoImportacaoPalpites | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [adminToken, setAdminToken] = useState(window.sessionStorage.getItem("bolao-admin-token") ?? "");

  const palpitesParaEnviar = useMemo<ImportarPalpiteEmLoteItem[]>(() => {
    if (!resultado) return [];
    return resultado.itens.filter(itemPodeSerEnviado).map((item) => ({
      participante: item.participanteOficial,
      jogoId: item.jogoId,
      timeCasa: item.mandanteOficial ?? item.timeCasa,
      timeFora: item.visitanteOficial ?? item.timeFora,
      golsCasa: item.golsCasa,
      golsFora: item.golsFora,
      decisao: item.decisao
    }));
  }, [resultado]);

  function processarTexto() {
    if (!data) return;
    setIsProcessing(true);
    try {
      const processado = processarPalpitesWhatsApp(texto, {
        participantes: data.participantes,
        jogos: data.jogos,
        palpitesExistentes: data.palpites
      });
      setResultado(processado);
      if (processado.erros.length > 0) {
        showToast(processado.erros[0]);
      } else {
        showToast(`${processado.resumo.total} itens encontrados. Confira a prévia antes de importar.`);
      }
    } finally {
      setIsProcessing(false);
    }
  }

  function limparTudo() {
    setTexto("");
    setResultado(null);
  }

  function atualizarItem(id: string, patch: Partial<ImportacaoPalpiteItem>) {
    setResultado((current) => {
      if (!current) return current;
      const itens = current.itens.map((item) => {
        if (item.id !== id) return item;
        const next = revalidarItem({ ...item, ...patch });
        if (next.palpiteAtual && next.decisao === "ignorar") {
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
      showToast("A importação em lote exige Google Apps Script ativo. O modo Excel/mock é somente leitura.");
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

    const temSubstituicoes = resultado.itens.some((item) => item.palpiteAtual && item.decisao === "substituir" && item.incluir);
    if (temSubstituicoes && !window.confirm("Há palpites existentes que serão substituídos. Confirmar importação?")) return;

    setIsImporting(true);
    try {
      const resposta = await api.importarPalpitesEmLote({
        adminToken,
        data: resultado.participantes.find((participante) => participante.data)?.data ?? null,
        palpites: palpitesParaEnviar
      });
      showToast(resposta.message);
      await refetch();
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
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <KeyRound className="h-4 w-4 text-brand-600" aria-hidden />
                  Token administrativo
                </span>
                <Input
                  type="password"
                  value={adminToken}
                  onChange={(event) => {
                    setAdminToken(event.target.value);
                    window.sessionStorage.setItem("bolao-admin-token", event.target.value);
                  }}
                  placeholder="Token administrativo"
                />
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                {adminWritesEnabled
                  ? "A confirmação será validada novamente pelo Google Apps Script antes de gravar."
                  : "Escrita desativada nesta fonte de dados. Use a API do Google Apps Script para importar."}
              </div>
              <div className="grid gap-2">
                <Button
                  icon={isProcessing ? <Spinner className="h-4 w-4" label="Processando" /> : <ClipboardPaste className="h-4 w-4" aria-hidden />}
                  disabled={isProcessing || !texto.trim()}
                  onClick={processarTexto}
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
            participantes={data.participantes}
            jogos={data.jogos}
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
        </>
      ) : null}
    </div>
  );
}
