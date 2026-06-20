import { useEffect, useMemo, useState } from "react";
import { Download, Printer, RefreshCw, RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { RankingTable } from "../components/ranking/RankingTable";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { Pagination } from "../components/ui/Pagination";
import { Select } from "../components/ui/Select";
import { PAGE_SIZE } from "../constants";
import { useDebounce } from "../hooks/useDebounce";
import { useRanking } from "../hooks/useRanking";
import type { RankingItem } from "../types";
import { filtrarRanking } from "../utils/filtros";
import { normalizarTexto } from "../utils/formatadores";
import { gerarImagemRanking } from "../utils/gerarImagemRelatorios";
import { gerarPdfRanking } from "../utils/gerarPdfRanking";

type RankingSort = "posicao" | "nome" | "pontos" | "cravadas";

function ordenarRanking(lista: RankingItem[], sort: RankingSort): RankingItem[] {
  return [...lista].sort((a, b) => {
    if (sort === "nome") return a.participante.localeCompare(b.participante, "pt-BR");
    if (sort === "pontos") return b.pontos - a.pontos || b.cravadas - a.cravadas || a.ordemOriginal - b.ordemOriginal;
    if (sort === "cravadas") return b.cravadas - a.cravadas || b.pontos - a.pontos || a.ordemOriginal - b.ordemOriginal;
    return a.posicao - b.posicao;
  });
}

export function Ranking() {
  const { data, isLoading, error, refetch } = useRanking();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get("busca") ?? "");
  const [faixa, setFaixa] = useState(searchParams.get("faixa") ?? "todos");
  const [sort, setSort] = useState<RankingSort>((searchParams.get("sort") as RankingSort) ?? "posicao");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const buscaDebounced = useDebounce(busca);

  useEffect(() => {
    const params = new URLSearchParams();
    if (buscaDebounced) params.set("busca", buscaDebounced);
    if (faixa !== "todos") params.set("faixa", faixa);
    if (sort !== "posicao") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    setSearchParams(params, { replace: true });
  }, [buscaDebounced, faixa, page, setSearchParams, sort]);

  const filtrado = useMemo(() => ordenarRanking(filtrarRanking(data ?? [], buscaDebounced, faixa), sort), [buscaDebounced, data, faixa, sort]);
  const totalPages = Math.max(1, Math.ceil(filtrado.length / PAGE_SIZE));
  const paginaAtual = filtrado.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const destaque = data?.find((item) => normalizarTexto(item.participante) === normalizarTexto(buscaDebounced))?.participante;

  useEffect(() => {
    setPage(1);
  }, [buscaDebounced, faixa, sort]);

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState message={error ?? "Ranking indisponível."} onRetry={refetch} />;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Ranking</h2>
          <p className="text-sm text-slate-500">Desempate por cravadas e ordem original da planilha.</p>
        </div>
        <div className="grid gap-2 no-print sm:flex sm:flex-wrap lg:justify-end">
          <Button className="w-full sm:w-auto" variant="secondary" icon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={refetch}>
            Atualizar
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" icon={<Printer className="h-4 w-4" aria-hidden />} onClick={() => window.print()}>
            Imprimir ranking
          </Button>
          <Button className="w-full sm:w-auto" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => gerarPdfRanking(filtrado)}>
            Baixar ranking em PDF
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => gerarImagemRanking(filtrado)}>
            Baixar ranking em PNG
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft no-print md:grid-cols-4">
        <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar participante" />
        <Select value={faixa} onChange={(event) => setFaixa(event.target.value)}>
          <option value="todos">Todas as posições</option>
          <option value="top3">Top 3</option>
          <option value="top5">Top 5</option>
          <option value="top10">Top 10</option>
          <option value="11mais">11º em diante</option>
        </Select>
        <Select value={sort} onChange={(event) => setSort(event.target.value as RankingSort)}>
          <option value="posicao">Ordenar por posição</option>
          <option value="nome">Ordenar por nome</option>
          <option value="pontos">Ordenar por pontos</option>
          <option value="cravadas">Ordenar por cravadas</option>
        </Select>
        <Button
          variant="ghost"
          className="w-full"
          icon={<RotateCcw className="h-4 w-4" aria-hidden />}
          onClick={() => {
            setBusca("");
            setFaixa("todos");
            setSort("posicao");
            setPage(1);
          }}
        >
          Limpar filtros
        </Button>
      </div>

      {paginaAtual.length === 0 ? <EmptyState /> : <RankingTable ranking={paginaAtual} destaque={destaque} />}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
