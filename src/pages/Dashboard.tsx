import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, CreditCard, Download, KeyRound, RefreshCw, Smartphone, Target, Trophy, UserPlus, Users, X } from "lucide-react";
import { Podium } from "../components/dashboard/Podium";
import { StatCard } from "../components/dashboard/StatCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { useDashboard } from "../hooks/useDashboard";
import { isPwaInstalled, openPwaInstallPrompt, PWA_INSTALL_STATE_CHANGE_EVENT } from "../pwa";
import { api, isAdminWritesEnabled } from "../services/api";
import { formatarData, formatarDataHora } from "../utils/formatadores";
import { gerarPdfRelatorioGeral } from "../utils/gerarPdfRelatorioGeral";

export function Dashboard() {
  const { data, isLoading, error, refetch } = useDashboard();
  const { showToast } = useToast();
  const [isAppInstalled, setIsAppInstalled] = useState(isPwaInstalled);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [participantName, setParticipantName] = useState("");
  const [adminToken, setAdminToken] = useState(window.sessionStorage.getItem("bolao-admin-token") ?? "");
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const adminWritesEnabled = isAdminWritesEnabled();

  useEffect(() => {
    const syncPwaState = () => setIsAppInstalled(isPwaInstalled());
    window.addEventListener(PWA_INSTALL_STATE_CHANGE_EVENT, syncPwaState);
    window.addEventListener("appinstalled", syncPwaState);
    return () => {
      window.removeEventListener(PWA_INSTALL_STATE_CHANGE_EVENT, syncPwaState);
      window.removeEventListener("appinstalled", syncPwaState);
    };
  }, []);

  async function handleAddParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nome = participantName.trim().replace(/\s+/g, " ");
    if (!nome) {
      showToast("Informe o nome do participante.");
      return;
    }
    if (!adminToken) {
      showToast("Informe o token administrativo.");
      return;
    }
    if (data?.participantes.some((participante) => participante.nome.localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0)) {
      showToast("Esse participante já está cadastrado.");
      return;
    }
    if (!window.confirm(`Adicionar ${nome} em todos os jogos, no Ranking e em Pagamentos?`)) return;

    setIsAddingParticipant(true);
    try {
      const resposta = await api.adicionarParticipante({ nome, adminToken });
      showToast(resposta.message);
      setParticipantName("");
      setShowAddParticipant(false);
      await refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível adicionar o participante.");
    } finally {
      setIsAddingParticipant(false);
    }
  }

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState message={error ?? "Dados indisponíveis."} onRetry={refetch} />;

  const lider = data.ranking[0];
  const proximosJogos = data.jogos.filter((jogo) => jogo.status !== "finalizado").slice(0, 5);
  const ultimosResultados = data.jogos.filter((jogo) => jogo.status === "finalizado").slice(-5).reverse();

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section
        className="overflow-hidden rounded-lg bg-slate-950 bg-cover bg-center px-5 py-6 text-white shadow-soft sm:px-6 sm:py-8"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(2, 6, 23, 0.94), rgba(2, 6, 23, 0.68), rgba(2, 6, 23, 0.2)), url('/banner.jpg')"
        }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-wide text-brand-100">Portal do bolão</p>
            <h2 className="mt-2 text-2xl font-black sm:text-4xl">Bolão Futebol Inglês</h2>
            <p className="mt-2 text-sm text-slate-200">Última atualização: {formatarDataHora(data.ultimaAtualizacao)}</p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Button className="w-full sm:w-auto" variant="secondary" icon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={refetch}>
              Atualizar dados
            </Button>
            {adminWritesEnabled ? (
              <Button
                className="w-full sm:w-auto"
                variant="secondary"
                icon={<UserPlus className="h-4 w-4" aria-hidden />}
                onClick={() => setShowAddParticipant((current) => !current)}
              >
                Novo participante
              </Button>
            ) : null}
            {!isAppInstalled ? (
              <Button
                variant="secondary"
                className="w-full border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 focus:ring-brand-100 sm:w-auto"
                icon={<Smartphone className="h-4 w-4" aria-hidden />}
                onClick={openPwaInstallPrompt}
              >
                Baixar app
              </Button>
            ) : null}
            <Button className="w-full sm:w-auto" variant="primary" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => gerarPdfRelatorioGeral(data)}>
              Relatório geral
            </Button>
          </div>
        </div>
      </section>

      {showAddParticipant ? (
        <Card className="border-brand-200">
          <CardHeader className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Adicionar novo participante</h2>
              <p className="text-sm text-slate-500">O nome será incluído em todos os jogos, no Ranking e em Pagamentos.</p>
            </div>
            <Button variant="ghost" className="min-h-9 px-2" aria-label="Fechar" onClick={() => setShowAddParticipant(false)}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </CardHeader>
          <CardBody>
            <form className="grid gap-3 md:grid-cols-[1fr_18rem_auto]" onSubmit={(event) => void handleAddParticipant(event)}>
              <Input
                value={participantName}
                onChange={(event) => setParticipantName(event.target.value)}
                placeholder="Nome completo do participante"
                aria-label="Nome do participante"
                disabled={isAddingParticipant}
              />
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  className="pl-9"
                  type="password"
                  value={adminToken}
                  onChange={(event) => {
                    setAdminToken(event.target.value);
                    window.sessionStorage.setItem("bolao-admin-token", event.target.value);
                  }}
                  placeholder="Token administrativo"
                  aria-label="Token administrativo"
                  disabled={isAddingParticipant}
                />
              </div>
              <Button
                type="submit"
                icon={isAddingParticipant ? <Spinner className="h-4 w-4" label="Adicionando" /> : <UserPlus className="h-4 w-4" aria-hidden />}
                disabled={isAddingParticipant || !participantName.trim() || !adminToken}
              >
                {isAddingParticipant ? "Adicionando..." : "Adicionar"}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard tone="gold" label="Líder atual" value={lider?.participante ?? "-"} icon={<Trophy className="h-6 w-6" aria-hidden />} />
        <StatCard tone="blue" label="Participantes" value={data.resumo.totalParticipantes} icon={<Users className="h-6 w-6" aria-hidden />} />
        <StatCard tone="emerald" label="Finalizados" value={data.resumo.jogosFinalizados} icon={<CheckCircle2 className="h-6 w-6" aria-hidden />} />
        <StatCard tone="amber" label="Pendentes" value={data.resumo.jogosPendentes} icon={<CalendarClock className="h-6 w-6" aria-hidden />} />
        <StatCard tone="violet" label="Cravadas" value={data.resumo.totalCravadas} icon={<Target className="h-6 w-6" aria-hidden />} />
        <StatCard
          tone="rose"
          label="Pagamentos"
          value={`${data.resumo.pagamentosConfirmados} pagos · ${data.resumo.pagamentosIsentos ?? 0} isento${data.resumo.pagamentosIsentos === 1 ? "" : "s"}`}
          icon={<CreditCard className="h-6 w-6" aria-hidden />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Podium ranking={data.ranking} />

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black text-slate-950">Top 5</h2>
            <Link to="/ranking" className="text-sm font-bold text-brand-600 hover:text-brand-700">
              Ver ranking completo
            </Link>
          </CardHeader>
          <CardBody className="space-y-3">
            {data.ranking.slice(0, 5).map((item, index) => (
              <div
                key={item.participante}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-gradient-to-r from-slate-50 to-white p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-slate-950">
                      #{item.posicao} {item.participante}
                    </strong>
                    <p className="text-xs text-slate-500">{item.cravadas} cravadas</p>
                  </div>
                </div>
                <Badge tone="dark">{item.pontos} pts</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                <div key={jogo.id} className="rounded-lg border border-slate-200 bg-white p-3 transition hover:border-brand-100 hover:bg-brand-50/30">
                  <strong className="text-slate-950">
                    {jogo.mandante} x {jogo.visitante}
                  </strong>
                  <p className="text-sm text-slate-500">
                    {formatarData(jogo.data)} às {jogo.horario} - {jogo.rodada}
                  </p>
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
              <div key={jogo.id} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="min-w-0 flex-1">
                  <strong className="block break-words leading-snug text-slate-950">
                    {jogo.mandante} x {jogo.visitante}
                  </strong>
                  <p className="text-sm text-slate-500">{formatarData(jogo.data)}</p>
                </div>
                <div className="shrink-0">
                  <Badge tone="green">{jogo.resultado}</Badge>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
