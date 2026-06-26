import { useCallback, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, CreditCard, Download, RefreshCw, RotateCcw, Search, Target, Trophy, TrendingUp } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { Select } from "../components/ui/Select";
import { PONTUACAO_LABELS } from "../constants";
import { useApiResource } from "../hooks/useApiResource";
import { api } from "../services/api";
import type { DashboardData, Jogo, Palpite, ParticipanteDetalhe } from "../types";
import { formatarData, formatarDataHora, normalizarTexto, porcentagem } from "../utils/formatadores";
import { gerarImagemParticipante } from "../utils/gerarImagemRelatorios";
import { gerarPdfParticipante } from "../utils/gerarPdfParticipante";

function pagamentoTone(pagamento: ParticipanteDetalhe["pagamento"]): "green" | "blue" | "yellow" {
  if (pagamento === "pago") return "green";
  if (pagamento === "isento") return "blue";
  return "yellow";
}

function pontuacaoTone(palpite: Palpite | undefined): "gray" | "gold" | "green" | "blue" {
  if (!palpite) return "gray";
  if (palpite.tipo === "exato") return "gold";
  if (palpite.pontos > 0) return "green";
  if (palpite.tipo === "pendente") return "blue";
  return "gray";
}

type FiltroPontuacao = "todos" | "com-palpite" | "sem-palpite" | "pontuou" | "cravada" | "zerou" | "pendente";

export function MeuPerfil() {
  const { session } = useAuth();
  const participanteNome = session?.role === "participant" ? session.participanteNome : "";
  const [buscaPalpite, setBuscaPalpite] = useState("");
  const [statusJogo, setStatusJogo] = useState("todos");
  const [filtroPontuacao, setFiltroPontuacao] = useState<FiltroPontuacao>("todos");

  const loader = useCallback(
    async (forceRefresh = false) => {
      const [participante, dashboard] = await Promise.all([
        api.getParticipante(participanteNome, forceRefresh),
        api.getDashboard(forceRefresh)
      ]);
      return { participante, dashboard };
    },
    [participanteNome]
  );

  const { data, isLoading, error, refetch } = useApiResource<{ participante: ParticipanteDetalhe; dashboard: DashboardData }>(loader);

  const jogosComPalpite = useMemo(() => {
    if (!data) return [];
    return data.dashboard.jogos.map((jogo) => ({
      jogo,
      palpite: data.participante.palpites.find((item) => item.jogoId === jogo.id)
    }));
  }, [data]);

  const palpitesFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaPalpite);

    return jogosComPalpite.filter(({ jogo, palpite }) => {
      const textoJogo = normalizarTexto(`${jogo.mandante} ${jogo.visitante} ${jogo.abreviacao} ${jogo.rodada} ${jogo.dia}`);
      const bateBusca = !termo || textoJogo.includes(termo);
      const bateStatus = statusJogo === "todos" || jogo.status === statusJogo;
      const batePontuacao =
        filtroPontuacao === "todos" ||
        (filtroPontuacao === "com-palpite" && Boolean(palpite)) ||
        (filtroPontuacao === "sem-palpite" && !palpite) ||
        (filtroPontuacao === "pontuou" && Boolean(palpite && palpite.pontos > 0)) ||
        (filtroPontuacao === "cravada" && palpite?.tipo === "exato") ||
        (filtroPontuacao === "zerou" && Boolean(palpite && palpite.tipo === "erro")) ||
        (filtroPontuacao === "pendente" && Boolean(palpite && palpite.tipo === "pendente"));

      return bateBusca && bateStatus && batePontuacao;
    });
  }, [buscaPalpite, filtroPontuacao, jogosComPalpite, statusJogo]);

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState message={error ?? "Perfil indisponível."} onRetry={refetch} />;

  const { participante, dashboard } = data;
  const lider = dashboard.ranking[0];
  const diferencaLider = lider ? Math.max(0, lider.pontos - participante.pontos) : 0;
  const palpitesPontuados = participante.palpites.filter((palpite) => palpite.pontos > 0).length;
  const palpitesPendentes = participante.palpites.filter((palpite) => palpite.tipo === "pendente").length;
  const proximosJogos = jogosComPalpite.filter(({ jogo }) => jogo.status !== "finalizado").slice(0, 5);

  const pagamentoDescricao =
    participante.pagamento === "isento"
      ? "Sem cobrança de PIX"
      : participante.pagamento === "pago"
        ? `PIX confirmado em ${formatarData(participante.dataPix)}`
        : `PIX pendente${participante.dataPix ? ` desde ${formatarData(participante.dataPix)}` : ""}`;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section
        className="overflow-hidden rounded-lg bg-slate-950 bg-cover bg-center px-5 py-6 text-white shadow-soft sm:px-6 sm:py-8"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(2, 6, 23, 0.95), rgba(15, 23, 42, 0.76), rgba(15, 23, 42, 0.32)), url('/banner.jpg')"
        }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-wide text-brand-100">Meu perfil</p>
            <h2 className="mt-2 text-2xl font-black sm:text-4xl">{participante.nome}</h2>
            <p className="mt-2 text-sm text-slate-200">Última atualização: {formatarDataHora(dashboard.ultimaAtualizacao)}</p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Button className="w-full sm:w-auto" variant="secondary" icon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={refetch}>
              Atualizar
            </Button>
            <Button className="w-full sm:w-auto" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => gerarPdfParticipante(participante, dashboard.jogos)}>
              Baixar PDF
            </Button>
            <Button className="w-full sm:w-auto" variant="secondary" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => gerarImagemParticipante(participante, dashboard.jogos)}>
              Baixar PNG
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardBody>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Trophy className="h-4 w-4 text-brand-600" aria-hidden />
              Posição
            </p>
            <strong className="mt-1 block text-2xl font-black text-slate-950">{participante.posicao}º</strong>
            <span className="text-xs font-semibold text-slate-500">de {dashboard.ranking.length} participantes</span>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <TrendingUp className="h-4 w-4 text-brand-600" aria-hidden />
              Pontos
            </p>
            <strong className="mt-1 block text-2xl font-black text-slate-950">{participante.pontos}</strong>
            <span className="text-xs font-semibold text-slate-500">{diferencaLider === 0 ? "Líder ou empatado na ponta" : `${diferencaLider} pts do líder`}</span>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Target className="h-4 w-4 text-brand-600" aria-hidden />
              Cravadas
            </p>
            <strong className="mt-1 block text-2xl font-black text-slate-950">{participante.cravadas}</strong>
            <span className="text-xs font-semibold text-slate-500">{participante.acertos} acertos no total</span>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-brand-600" aria-hidden />
              Palpites
            </p>
            <strong className="mt-1 block text-2xl font-black text-slate-950">{participante.palpitesEnviados}</strong>
            <span className="text-xs font-semibold text-slate-500">{palpitesPontuados} pontuaram</span>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <CalendarClock className="h-4 w-4 text-brand-600" aria-hidden />
              Aproveitamento
            </p>
            <strong className="mt-1 block text-2xl font-black text-slate-950">{porcentagem(participante.aproveitamento)}</strong>
            <span className="text-xs font-semibold text-slate-500">{palpitesPendentes} aguardando resultado</span>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <CreditCard className="h-4 w-4 text-brand-600" aria-hidden />
              Pagamento
            </p>
            <div className="mt-2">
              <Badge tone={pagamentoTone(participante.pagamento)}>{participante.pagamento}</Badge>
            </div>
            <span className="mt-2 block text-xs font-semibold text-slate-500">{pagamentoDescricao}</span>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-black text-slate-950">Situação no bolão</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Líder atual</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <strong className="min-w-0 truncate text-slate-950">{lider?.participante ?? "-"}</strong>
                <Badge tone="dark">{lider?.pontos ?? 0} pts</Badge>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Seu desempenho</p>
              <p className="mt-2 text-sm text-slate-700">
                {participante.cravadas} cravadas, {participante.acertos} acertos e {porcentagem(participante.aproveitamento)} de aproveitamento.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Pendências</p>
              <p className="mt-2 text-sm text-slate-700">
                {participante.jogosSemPalpite.length === 0
                  ? "Todos os jogos cadastrados têm palpite."
                  : `${participante.jogosSemPalpite.length} jogo${participante.jogosSemPalpite.length === 1 ? "" : "s"} sem palpite.`}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-black text-slate-950">Próximos jogos</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {proximosJogos.length === 0 ? (
              <EmptyState title="Sem jogos pendentes" description="Todos os jogos cadastrados já têm resultado." />
            ) : (
              proximosJogos.map(({ jogo, palpite }) => (
                <div key={jogo.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <strong className="block break-words text-slate-950">{jogo.mandante} x {jogo.visitante}</strong>
                    <span className="text-sm text-slate-500">
                      {formatarData(jogo.data)} às {jogo.horario} - {jogo.rodada}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={palpite ? "blue" : "yellow"}>{palpite?.palpite ?? "sem palpite"}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Meus palpites</h2>
            <p className="text-sm text-slate-500">
              {palpitesFiltrados.length} de {jogosComPalpite.length} jogos
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]">
            <label className="relative min-w-0">
              <span className="sr-only">Buscar jogo</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                className="pl-9"
                value={buscaPalpite}
                onChange={(event) => setBuscaPalpite(event.target.value)}
                placeholder="Buscar por time, jogo ou rodada"
              />
            </label>
            <Select value={statusJogo} onChange={(event) => setStatusJogo(event.target.value)}>
              <option value="todos">Todos os jogos</option>
              <option value="agendado">Agendados</option>
              <option value="andamento">Em andamento</option>
              <option value="finalizado">Finalizados</option>
            </Select>
            <Select value={filtroPontuacao} onChange={(event) => setFiltroPontuacao(event.target.value as FiltroPontuacao)}>
              <option value="todos">Todos os palpites</option>
              <option value="com-palpite">Com palpite</option>
              <option value="sem-palpite">Sem palpite</option>
              <option value="pontuou">Pontuou</option>
              <option value="cravada">Cravada</option>
              <option value="zerou">Zerou</option>
              <option value="pendente">Aguardando</option>
            </Select>
            <Button
              variant="ghost"
              className="w-full"
              icon={<RotateCcw className="h-4 w-4" aria-hidden />}
              onClick={() => {
                setBuscaPalpite("");
                setStatusJogo("todos");
                setFiltroPontuacao("todos");
              }}
            >
              Limpar
            </Button>
          </div>

          {palpitesFiltrados.length === 0 ? (
            <EmptyState title="Nenhum jogo encontrado" description="Tente limpar os filtros ou buscar por outro time." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {palpitesFiltrados.map(({ jogo, palpite }) => (
                <article key={jogo.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        <Badge tone={jogo.status === "finalizado" ? "green" : "gray"}>{jogo.status}</Badge>
                        <span>{jogo.rodada}</span>
                        <span>{jogo.dia}</span>
                      </div>
                      <h3 className="mt-2 break-words text-lg font-black text-slate-950">
                        {jogo.mandante} <span className="text-brand-600">x</span> {jogo.visitante}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {formatarData(jogo.data)} {jogo.horario} - {jogo.abreviacao}
                      </p>
                    </div>
                    <Badge className="shrink-0" tone={pontuacaoTone(palpite)}>{palpite?.pontos ?? 0} pts</Badge>
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-100 p-3">
                      <dt className="text-xs font-semibold text-slate-500">Resultado</dt>
                      <dd className="mt-1 font-bold text-slate-950">{jogo.resultado ?? "pendente"}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-3">
                      <dt className="text-xs font-semibold text-slate-500">Meu palpite</dt>
                      <dd className="mt-1 font-bold text-slate-950">{palpite?.palpite ?? "-"}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-3">
                      <dt className="text-xs font-semibold text-slate-500">Status</dt>
                      <dd className="mt-1">
                        <Badge tone={pontuacaoTone(palpite)}>{palpite ? PONTUACAO_LABELS[palpite.tipo] : "Sem palpite"}</Badge>
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {participante.jogosSemPalpite.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-black text-slate-950">Jogos sem palpite</h2>
          </CardHeader>
          <CardBody className="grid gap-2 md:grid-cols-2">
            {participante.jogosSemPalpite.map((jogo: Jogo) => (
              <div key={jogo.id} className="rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">
                {jogo.abreviacao} - {formatarData(jogo.data)}
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
