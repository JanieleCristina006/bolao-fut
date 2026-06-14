import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, Download, RefreshCw, Target, Trophy, Users, XCircle } from "lucide-react";
import { Podium } from "../components/dashboard/Podium";
import { StatCard } from "../components/dashboard/StatCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useDashboard } from "../hooks/useDashboard";
import { formatarData, formatarDataHora } from "../utils/formatadores";
import { gerarPdfRelatorioGeral } from "../utils/gerarPdfRelatorioGeral";

export function Dashboard() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState message={error ?? "Dados indisponíveis."} onRetry={refetch} />;

  const lider = data.ranking[0];
  const proximosJogos = data.jogos.filter((jogo) => jogo.status !== "finalizado").slice(0, 5);
  const ultimosResultados = data.jogos.filter((jogo) => jogo.status === "finalizado").slice(-5).reverse();

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section className="rounded-xl bg-slate-950 px-5 py-6 text-white shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-100">Portal do bolão</p>
            <h2 className="mt-2 text-2xl font-black sm:text-4xl">Bolão Futebol Inglês</h2>
            <p className="mt-2 text-sm text-slate-300">Última atualização: {formatarDataHora(data.ultimaAtualizacao)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={refetch}>
              Atualizar dados
            </Button>
            <Button variant="primary" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => gerarPdfRelatorioGeral(data)}>
              Relatório geral
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Líder atual" value={lider?.participante ?? "-"} icon={<Trophy className="h-6 w-6" aria-hidden />} />
        <StatCard label="Participantes" value={data.resumo.totalParticipantes} icon={<Users className="h-6 w-6" aria-hidden />} />
        <StatCard label="Finalizados" value={data.resumo.jogosFinalizados} icon={<CheckCircle2 className="h-6 w-6" aria-hidden />} />
        <StatCard label="Pendentes" value={data.resumo.jogosPendentes} icon={<CalendarClock className="h-6 w-6" aria-hidden />} />
        <StatCard label="Cravadas" value={data.resumo.totalCravadas} icon={<Target className="h-6 w-6" aria-hidden />} />
        <StatCard label="Pagamentos" value={data.resumo.pagamentosConfirmados} icon={<XCircle className="h-6 w-6" aria-hidden />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Podium ranking={data.ranking} />

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">Top 5</h2>
            <Link to="/ranking" className="text-sm font-bold text-brand-600 hover:text-brand-700">
              Ver ranking completo
            </Link>
          </CardHeader>
          <CardBody className="space-y-3">
            {data.ranking.slice(0, 5).map((item) => (
              <div key={item.participante} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <strong className="text-slate-950">{item.posicao}º {item.participante}</strong>
                  <p className="text-xs text-slate-500">{item.cravadas} cravadas</p>
                </div>
                <Badge tone="dark">{item.pontos} pts</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">Próximos jogos</h2>
            <Link to="/jogos" className="text-sm font-bold text-brand-600 hover:text-brand-700">
              Ver todos os palpites
            </Link>
          </CardHeader>
          <CardBody className="space-y-3">
            {proximosJogos.length === 0 ? (
              <EmptyState title="Sem jogos pendentes" description="Todos os jogos já possuem resultado." />
            ) : (
              proximosJogos.map((jogo) => (
                <div key={jogo.id} className="rounded-lg border border-slate-200 p-3">
                  <strong className="text-slate-950">{jogo.mandante} x {jogo.visitante}</strong>
                  <p className="text-sm text-slate-500">{formatarData(jogo.data)} às {jogo.horario} · {jogo.rodada}</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-black text-slate-950">Últimos resultados</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {ultimosResultados.map((jogo) => (
              <div key={jogo.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <strong className="text-slate-950">{jogo.abreviacao}</strong>
                  <p className="text-sm text-slate-500">{formatarData(jogo.data)}</p>
                </div>
                <Badge tone="green">{jogo.resultado}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
