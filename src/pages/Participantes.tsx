import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ParticipanteCard } from "../components/participantes/ParticipanteCard";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { Pagination } from "../components/ui/Pagination";
import { Select } from "../components/ui/Select";
import { useToast } from "../components/ui/Toast";
import { PAGE_SIZE } from "../constants";
import { useDebounce } from "../hooks/useDebounce";
import { useParticipantes } from "../hooks/useParticipantes";
import { api, isAdminWritesEnabled } from "../services/api";
import type { Participante } from "../types";
import { filtrarParticipantes } from "../utils/filtros";

type ParticipanteSort = "classificacao" | "alfabetica" | "pontos";

function ordenarParticipantes(lista: Participante[], sort: ParticipanteSort): Participante[] {
  return [...lista].sort((a, b) => {
    if (sort === "alfabetica") return a.nome.localeCompare(b.nome, "pt-BR");
    if (sort === "pontos") return b.pontos - a.pontos || a.posicao - b.posicao;
    return a.posicao - b.posicao;
  });
}

export function Participantes() {
  const { data, isLoading, error, refetch } = useParticipantes();
  const { session } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get("busca") ?? "");
  const [pagamento, setPagamento] = useState(searchParams.get("pagamento") ?? "todos");
  const [sort, setSort] = useState<ParticipanteSort>((searchParams.get("sort") as ParticipanteSort) ?? "classificacao");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const [removingParticipant, setRemovingParticipant] = useState<string | null>(null);
  const buscaDebounced = useDebounce(busca);
  const adminToken = session?.role === "admin" ? session.adminToken : "";
  const canRemoveParticipant = Boolean(adminToken) && isAdminWritesEnabled();

  useEffect(() => {
    const params = new URLSearchParams();
    if (buscaDebounced) params.set("busca", buscaDebounced);
    if (pagamento !== "todos") params.set("pagamento", pagamento);
    if (sort !== "classificacao") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    setSearchParams(params, { replace: true });
  }, [buscaDebounced, page, pagamento, setSearchParams, sort]);

  useEffect(() => {
    setPage(1);
  }, [buscaDebounced, pagamento, sort]);

  const filtrado = useMemo(
    () => ordenarParticipantes(filtrarParticipantes(data ?? [], buscaDebounced, pagamento), sort),
    [buscaDebounced, data, pagamento, sort]
  );
  const totalPages = Math.max(1, Math.ceil(filtrado.length / PAGE_SIZE));
  const paginaAtual = filtrado.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function removerParticipante(participante: Participante) {
    if (!adminToken) {
      showToast("Informe o token administrativo.");
      return;
    }
    if (!window.confirm(`Remover ${participante.nome} dos jogos, do Ranking e de Pagamentos?`)) return;

    setRemovingParticipant(participante.nome);
    try {
      const resposta = await api.removerParticipante({ nome: participante.nome, adminToken });
      showToast(resposta.message);
      await refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Nao foi possivel remover o participante.");
    } finally {
      setRemovingParticipant(null);
    }
  }

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState message={error ?? "Participantes indisponíveis."} onRetry={refetch} />;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div>
        <h2 className="text-2xl font-black text-slate-950">Participantes</h2>
        <p className="text-sm text-slate-500">Cards com classificação, palpites, cravadas e pagamento.</p>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft no-print md:grid-cols-4">
        <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome" />
        <Select value={pagamento} onChange={(event) => setPagamento(event.target.value)}>
          <option value="todos">Todos os pagamentos</option>
          <option value="pago">Pagos</option>
          <option value="isento">Isentos</option>
          <option value="pendente">Pendentes</option>
        </Select>
        <Select value={sort} onChange={(event) => setSort(event.target.value as ParticipanteSort)}>
          <option value="classificacao">Ordenar por classificação</option>
          <option value="alfabetica">Ordenar alfabeticamente</option>
          <option value="pontos">Ordenar por pontos</option>
        </Select>
        <Button
          variant="ghost"
          className="w-full"
          icon={<RotateCcw className="h-4 w-4" aria-hidden />}
          onClick={() => {
            setBusca("");
            setPagamento("todos");
            setSort("classificacao");
          }}
        >
          Limpar filtros
        </Button>
      </div>

      {paginaAtual.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginaAtual.map((participante) => (
            <ParticipanteCard
              key={participante.nome}
              participante={participante}
              canRemove={canRemoveParticipant}
              isRemoving={removingParticipant === participante.nome}
              onRemove={(item) => void removerParticipante(item)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
