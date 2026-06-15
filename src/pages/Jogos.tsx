import { useEffect, useMemo, useState } from "react";
import { Download, Printer, RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
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
import { filtrarJogos, type FiltrosJogos } from "../utils/filtros";
import { normalizarTexto } from "../utils/formatadores";
import { gerarPdfPalpitesDeJogo, gerarPdfPalpitesFiltrados, gerarPdfPalpitesParticipante } from "../utils/gerarPdfPalpites";

const PAGE_SIZE_JOGOS = 4;

function palpiteBateTipo(palpite: Palpite, tipo: FiltrosJogos["tipo"]): boolean {
  if (tipo === "todos") return true;
  if (tipo === "pontuado") return palpite.pontos > 0;
  return palpite.tipo === tipo;
}

export function Jogos() {
  const { data, isLoading, error, refetch } = useJogos();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtros, setFiltros] = useState<FiltrosJogos>({
    participante: searchParams.get("participante") ?? "",
    dia: searchParams.get("dia") ?? "",
    rodada: searchParams.get("rodada") ?? "",
    jogo: searchParams.get("jogo") ?? "",
    selecao: searchParams.get("selecao") ?? "",
    status: searchParams.get("status") ?? "todos",
    resultado: searchParams.get("resultado") ?? "todos",
    tipo: (searchParams.get("tipo") as FiltrosJogos["tipo"]) ?? "todos"
  });
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const participanteDebounced = useDebounce(filtros.participante);
  const jogoDebounced = useDebounce(filtros.jogo);
  const selecaoDebounced = useDebounce(filtros.selecao);

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

  const jogos = data?.jogos ?? [];
  const palpites = data?.palpites ?? [];
  const dias = Array.from(new Set(jogos.map((jogo) => jogo.dia)));
  const rodadas = Array.from(new Set(jogos.map((jogo) => jogo.rodada)));

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

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState message={error ?? "Jogos indisponíveis."} onRetry={refetch} />;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Jogos e palpites</h2>
          <p className="text-sm text-slate-500">Pontuação calculada no frontend a partir do resultado oficial.</p>
        </div>
        <div className="grid gap-2 no-print sm:flex sm:flex-wrap lg:justify-end">
          <Button className="w-full sm:w-auto" variant="secondary" icon={<Printer className="h-4 w-4" aria-hidden />} onClick={() => window.print()}>
            Imprimir palpites
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            icon={<Download className="h-4 w-4" aria-hidden />}
            disabled={!participanteDebounced}
            onClick={() => gerarPdfPalpitesParticipante(participanteDebounced, jogosFiltrados, palpitesFiltrados)}
          >
            PDF participante
          </Button>
          <Button className="w-full sm:w-auto" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => gerarPdfPalpitesFiltrados(jogosFiltrados, palpitesFiltrados)}>
            PDF filtrado
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft no-print md:grid-cols-3 xl:grid-cols-5">
        <Input value={filtros.participante} onChange={(event) => setFiltros((current) => ({ ...current, participante: event.target.value }))} placeholder="Buscar participante" />
        <Input value={filtros.jogo} onChange={(event) => setFiltros((current) => ({ ...current, jogo: event.target.value }))} placeholder="Filtrar por jogo" />
        <Input value={filtros.selecao} onChange={(event) => setFiltros((current) => ({ ...current, selecao: event.target.value }))} placeholder="Filtrar por seleção" />
        <Select value={filtros.dia} onChange={(event) => setFiltros((current) => ({ ...current, dia: event.target.value }))}>
          <option value="">Todos os dias</option>
          {dias.map((dia) => (
            <option key={dia} value={dia}>
              {dia}
            </option>
          ))}
        </Select>
        <Select value={filtros.rodada} onChange={(event) => setFiltros((current) => ({ ...current, rodada: event.target.value }))}>
          <option value="">Todas as rodadas</option>
          {rodadas.map((rodada) => (
            <option key={rodada} value={rodada}>
              {rodada}
            </option>
          ))}
        </Select>
        <Select value={filtros.status} onChange={(event) => setFiltros((current) => ({ ...current, status: event.target.value }))}>
          <option value="todos">Todos os status</option>
          <option value="agendado">Agendado</option>
          <option value="andamento">Em andamento</option>
          <option value="finalizado">Finalizado</option>
        </Select>
        <Select value={filtros.resultado} onChange={(event) => setFiltros((current) => ({ ...current, resultado: event.target.value }))}>
          <option value="todos">Com e sem resultado</option>
          <option value="com">Somente com resultado</option>
          <option value="sem">Somente sem resultado</option>
        </Select>
        <Select value={filtros.tipo} onChange={(event) => setFiltros((current) => ({ ...current, tipo: event.target.value as FiltrosJogos["tipo"] }))}>
          <option value="todos">Todos os palpites</option>
          <option value="exato">Somente cravados</option>
          <option value="pontuado">Somente pontuados</option>
          <option value="erro">Somente errados</option>
          <option value="pendente">Aguardando resultado</option>
        </Select>
        <Button
          variant="ghost"
          className="w-full"
          icon={<RotateCcw className="h-4 w-4" aria-hidden />}
          onClick={() => setFiltros({ participante: "", dia: "", rodada: "", jogo: "", selecao: "", status: "todos", resultado: "todos", tipo: "todos" })}
        >
          Limpar filtros
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
              onPdf={(item: Jogo, itens: Palpite[]) => gerarPdfPalpitesDeJogo(item, itens)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
