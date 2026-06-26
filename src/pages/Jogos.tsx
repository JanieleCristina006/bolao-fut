import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, Filter, Printer, RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { JogoCard } from "../components/jogos/JogoCard";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { Pagination } from "../components/ui/Pagination";
import { Select } from "../components/ui/Select";
import { useDebounce } from "../hooks/useDebounce";
import { useJogos } from "../hooks/useJogos";
import type { Jogo, Palpite } from "../types";
import { api, isAdminWritesEnabled } from "../services/api";
import { useToast } from "../components/ui/Toast";
import { filtrarJogos, type FiltrosJogos } from "../utils/filtros";
import { normalizarTexto } from "../utils/formatadores";
import { gerarImagemPalpitesDeJogo } from "../utils/gerarImagemPalpites";
import { gerarZipImagensPalpitesFiltrados } from "../utils/gerarImagemRelatorios";
import { gerarPdfPalpitesDeJogo, gerarPdfPalpitesFiltrados } from "../utils/gerarPdfPalpites";

const PAGE_SIZE_JOGOS = 4;
type FormatoDownload = "pdf" | "imagem";

function dataLocalIso(data = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function obterDiaAtual(jogos: Jogo[]): string {
  const hoje = dataLocalIso();
  return jogos.find((jogo) => jogo.data.slice(0, 10) === hoje)?.dia ?? "";
}

function palpiteBateTipo(palpite: Palpite, tipo: FiltrosJogos["tipo"]): boolean {
  if (tipo === "todos") return true;
  if (tipo === "pontuado") return palpite.pontos > 0;
  return palpite.tipo === tipo;
}

export function Jogos() {
  const { data, isLoading, error, refetch } = useJogos();
  const { session } = useAuth();
  const { showToast } = useToast();
  const adminWritesEnabled = isAdminWritesEnabled();
  const isParticipant = session?.role === "participant";
  const canEditResults = session?.role === "admin" && adminWritesEnabled;
  const [searchParams, setSearchParams] = useSearchParams();
  const [savingResultId, setSavingResultId] = useState<string | null>(null);
  const [adminToken] = useState(window.sessionStorage.getItem("bolao-admin-token") ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [diaAtualAplicado, setDiaAtualAplicado] = useState(Boolean(searchParams.get("dia")));
  const [filtros, setFiltros] = useState<FiltrosJogos>({
    participante: searchParams.get("participante") ?? "",
    dia: searchParams.get("dia") ?? "",
    rodada: "",
    jogo: searchParams.get("jogo") ?? "",
    selecao: searchParams.get("selecao") ?? "",
    status: "todos",
    resultado: "todos",
    tipo: "todos"
  });
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const participanteDebounced = useDebounce(filtros.participante);
  const jogoDebounced = useDebounce(filtros.jogo);
  const selecaoDebounced = useDebounce(filtros.selecao);
  const jogos = data?.jogos ?? [];
  const palpites = data?.palpites ?? [];
  const dias = Array.from(new Set(jogos.map((jogo) => jogo.dia)));
  const diaAtual = obterDiaAtual(jogos);

  const filtrosDebounced = useMemo(
    () => ({ ...filtros, participante: participanteDebounced, jogo: jogoDebounced, selecao: selecaoDebounced }),
    [filtros, jogoDebounced, participanteDebounced, selecaoDebounced]
  );

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filtrosDebounced).forEach(([key, value]) => {
      if (value && value !== "todos") params.set(key, value);
    });
    if (page > 1) params.set("page", String(page));
    setSearchParams(params, { replace: true });
  }, [filtrosDebounced, page, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [participanteDebounced, jogoDebounced, selecaoDebounced, filtros.dia, filtros.rodada, filtros.status, filtros.resultado, filtros.tipo]);

  useEffect(() => {
    if (diaAtualAplicado || !diaAtual || searchParams.has("dia")) return;
    setFiltros((current) => (current.dia ? current : { ...current, dia: diaAtual }));
    setDiaAtualAplicado(true);
  }, [diaAtual, diaAtualAplicado, searchParams]);

  const palpitesFiltrados = useMemo(() => {
    const termo = normalizarTexto(participanteDebounced);
    return palpites.filter((palpite) => {
      const bateParticipante = !termo || normalizarTexto(palpite.participante).includes(termo);
      return bateParticipante && palpiteBateTipo(palpite, filtros.tipo);
    });
  }, [filtros.tipo, palpites, participanteDebounced]);

  const jogosFiltrados = useMemo(() => {
    const idsComPalpite = new Set(palpitesFiltrados.map((palpite) => palpite.jogoId));
    const base = filtrarJogos(jogos, filtrosDebounced, (jogo) => idsComPalpite.has(jogo.id));
    if (filtros.tipo === "todos" && !participanteDebounced) return base;
    return base.filter((jogo) => idsComPalpite.has(jogo.id));
  }, [filtros.tipo, filtrosDebounced, jogos, palpitesFiltrados, participanteDebounced]);

  const totalPages = Math.max(1, Math.ceil(jogosFiltrados.length / PAGE_SIZE_JOGOS));
  const paginaAtual = jogosFiltrados.slice((page - 1) * PAGE_SIZE_JOGOS, page * PAGE_SIZE_JOGOS);

  async function salvarResultado(jogo: Jogo, resultadoTexto: string): Promise<boolean> {
    const resultado = resultadoTexto.trim().toLowerCase().replace(/\s+/g, "");
    if (!/^\d{1,2}x\d{1,2}$/.test(resultado)) {
      showToast("Informe o resultado no formato 2x1.");
      return false;
    }

    if (!adminToken) {
      showToast("Informe o token administrativo na página Jogos.");
      return false;
    }
    if (!window.confirm(`Confirmar resultado ${resultado} para ${jogo.mandante} x ${jogo.visitante}?`)) return false;

    setSavingResultId(jogo.id);
    try {
      const resposta = await api.atualizarResultado({ jogoId: jogo.id, resultado, adminToken });
      await refetch();
      showToast(resposta.message);
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível salvar o resultado.");
      return false;
    } finally {
      setSavingResultId(null);
    }
  }

  function limparFiltros() {
    setFiltros({
      participante: "",
      dia: diaAtual,
      rodada: "",
      jogo: "",
      selecao: "",
      status: "todos",
      resultado: "todos",
      tipo: "todos"
    });
  }

  function dadosFiltradosParaDownload() {
    const termoParticipante = normalizarTexto(filtros.participante);
    const palpitesDoDownload = palpites.filter((palpite) => {
      const bateParticipante = !termoParticipante || normalizarTexto(palpite.participante).includes(termoParticipante);
      return bateParticipante && palpiteBateTipo(palpite, filtros.tipo);
    });
    const idsComPalpite = new Set(palpitesDoDownload.map((palpite) => palpite.jogoId));
    const jogosDoDownload = filtrarJogos(jogos, filtros, (jogo) => idsComPalpite.has(jogo.id));

    return {
      jogos: filtros.tipo === "todos" && !termoParticipante
        ? jogosDoDownload
        : jogosDoDownload.filter((jogo) => idsComPalpite.has(jogo.id)),
      palpites: palpitesDoDownload
    };
  }

  function baixarFiltradosEmPdf() {
    const dados = dadosFiltradosParaDownload();
    gerarPdfPalpitesFiltrados(dados.jogos, dados.palpites);
  }

  async function baixarFiltradosEmPng() {
    const dados = dadosFiltradosParaDownload();
    try {
      await gerarZipImagensPalpitesFiltrados(dados.jogos, dados.palpites);
    } catch {
      showToast("Não foi possível gerar o ZIP com as imagens.");
    }
  }

  function baixarJogo(jogo: Jogo, itens: Palpite[], formato: FormatoDownload) {
    if (formato === "imagem") {
      gerarImagemPalpitesDeJogo(jogo, itens);
      return;
    }
    gerarPdfPalpitesDeJogo(jogo, itens);
  }

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState message={error ?? "Jogos indisponíveis."} onRetry={refetch} />;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950 max-lg:text-white">Jogos e palpites</h2>
          <p className="text-sm text-slate-500 max-lg:text-zinc-100/65">Pontuação calculada no frontend a partir do resultado oficial.</p>
        </div>
        <div className="grid gap-2 no-print sm:flex sm:flex-wrap sm:items-end lg:justify-end">
          {!isParticipant ? (
            <Button className="w-full sm:w-auto" variant="secondary" icon={<Printer className="h-4 w-4" aria-hidden />} onClick={() => window.print()}>
              Imprimir palpites
            </Button>
          ) : null}
          <Button className="w-full sm:w-auto" icon={<Download className="h-4 w-4" aria-hidden />} onClick={baixarFiltradosEmPdf}>
            PDF filtrado
          </Button>
          {!isParticipant ? (
            <Button className="w-full sm:w-auto" variant="secondary" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => void baixarFiltradosEmPng()}>
              ZIP com PNGs
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 no-print md:hidden">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-3 text-sm font-semibold text-zinc-100 shadow-sm transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-white/15"
          aria-expanded={mobileFiltersOpen}
          aria-controls="filtros-jogos"
          onClick={() => setMobileFiltersOpen((current) => !current)}
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-200" aria-hidden />
            {mobileFiltersOpen ? "Ocultar filtros" : "Abrir filtros"}
          </span>
          {mobileFiltersOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      <div
        id="filtros-jogos"
        className={`${mobileFiltersOpen ? "grid" : "hidden"} grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft no-print md:grid md:grid-cols-3 xl:grid-cols-5 max-lg:border-white/10 max-lg:bg-[#1b1b1b]`}
      >
        <label className="col-span-2 min-w-0 space-y-1 md:col-span-1">
          <span className="text-xs font-semibold text-slate-500 max-lg:text-zinc-100/65">Jogo</span>
          <Input value={filtros.jogo} onChange={(event) => setFiltros((current) => ({ ...current, jogo: event.target.value }))} placeholder="Filtrar por jogo" />
        </label>

        <label className="min-w-0 space-y-1">
          <span className="text-xs font-semibold text-slate-500 max-lg:text-zinc-100/65">Dia</span>
          <Select className="min-w-0" value={filtros.dia} onChange={(event) => setFiltros((current) => ({ ...current, dia: event.target.value }))}>
            <option value="">Todos os dias</option>
            {dias.map((dia) => (
              <option key={dia} value={dia}>
                {dia}
              </option>
            ))}
          </Select>
        </label>

        <label className="min-w-0 space-y-1">
          <span className="text-xs font-semibold text-slate-500 max-lg:text-zinc-100/65">Seleção</span>
          <Input value={filtros.selecao} onChange={(event) => setFiltros((current) => ({ ...current, selecao: event.target.value }))} placeholder="Filtrar seleção" />
        </label>

        <Button variant="ghost" className="w-full self-end max-lg:text-zinc-100" icon={<RotateCcw className="h-4 w-4" aria-hidden />} onClick={limparFiltros}>
          Limpar filtros
        </Button>

        <Button className="w-full self-end md:hidden" onClick={() => setMobileFiltersOpen(false)}>
          Aplicar filtros
        </Button>

      </div>

      {paginaAtual.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {paginaAtual.map((jogo) => (
            <JogoCard
              key={jogo.id}
              jogo={jogo}
              palpites={palpitesFiltrados.filter((palpite) => palpite.jogoId === jogo.id)}
              canEditResult={canEditResults}
              isSavingResult={savingResultId === jogo.id}
              onSaveResult={salvarResultado}
              onDownload={baixarJogo}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

