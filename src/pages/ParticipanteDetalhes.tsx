import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { api } from "../services/api";
import type { Jogo, ParticipanteDetalhe } from "../types";
import { formatarData, porcentagem } from "../utils/formatadores";
import { gerarImagemParticipante } from "../utils/gerarImagemRelatorios";
import { gerarPdfParticipante } from "../utils/gerarPdfParticipante";
import { useApiResource } from "../hooks/useApiResource";

export function ParticipanteDetalhes() {
  const { nome = "" } = useParams();
  const nomeDecodificado = decodeURIComponent(nome);

  const loader = useCallback(
    async (forceRefresh = false) => {
      const [participante, jogos] = await Promise.all([api.getParticipante(nomeDecodificado, forceRefresh), api.getJogos(forceRefresh)]);
      return { participante, jogos };
    },
    [nomeDecodificado]
  );

  const { data, isLoading, error, refetch } = useApiResource<{ participante: ParticipanteDetalhe; jogos: Jogo[] }>(loader);

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState message={error ?? "Participante indisponível."} onRetry={refetch} />;

  const { participante, jogos } = data;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to="/participantes" className="inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar
          </Link>
          <h2 className="mt-3 text-2xl font-black text-slate-950">{participante.nome}</h2>
          <p className="text-sm text-slate-500">Histórico completo de palpites e pagamento.</p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Button className="w-full sm:w-auto" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => gerarPdfParticipante(participante, jogos)}>
            Baixar relatório em PDF
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => gerarImagemParticipante(participante, jogos)}>
            Baixar relatório em PNG
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Posição", `${participante.posicao}º`],
          ["Pontos", participante.pontos],
          ["Cravadas", participante.cravadas],
          ["Acertos", participante.acertos],
          ["Aproveitamento", porcentagem(participante.aproveitamento)]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardBody>
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <strong className="mt-1 block text-2xl font-black text-slate-950">{value}</strong>
            </CardBody>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-black text-slate-950">Pagamento</h2>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center gap-3">
          <Badge tone={participante.pagamento === "pago" ? "green" : participante.pagamento === "isento" ? "blue" : "yellow"}>
            {participante.pagamento}
          </Badge>
          <span className="text-sm text-slate-600">
            {participante.pagamento === "isento" ? "Sem cobrança de PIX" : `Data do PIX: ${formatarData(participante.dataPix)}`}
          </span>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <h2 className="text-lg font-black text-slate-950">Histórico de palpites</h2>
        </CardHeader>
        <div className="divide-y divide-slate-100 bg-white md:hidden">
          {jogos.map((jogo) => {
            const palpite = participante.palpites.find((item) => item.jogoId === jogo.id);
            return (
              <article key={jogo.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">{jogo.abreviacao}</h3>
                    <p className="text-sm text-slate-500">
                      {formatarData(jogo.data)} {jogo.horario}
                    </p>
                  </div>
                  <Badge tone={palpite && palpite.pontos > 0 ? "green" : "gray"}>{palpite?.pontos ?? 0} pts</Badge>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-100 p-3">
                    <dt className="text-xs font-semibold text-slate-500">Resultado</dt>
                    <dd className="mt-1 font-bold text-slate-950">
                      {jogo.fase === "mata-mata" ? `${jogo.resultado ?? "pendente"} / ${jogo.classificado ?? "pendente"}` : (jogo.resultado ?? "pendente")}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-3">
                    <dt className="text-xs font-semibold text-slate-500">Palpite</dt>
                    <dd className="mt-1 font-bold text-slate-950">
                      {jogo.fase === "mata-mata"
                        ? `${palpite?.palpite ?? "-"} / ${palpite?.classificado ?? "-"}`
                        : (palpite?.palpite ?? "-")}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="px-4 py-3">Jogo</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Resultado</th>
                <th className="px-4 py-3">Palpite</th>
                <th className="px-4 py-3">Pontuação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {jogos.map((jogo) => {
                const palpite = participante.palpites.find((item) => item.jogoId === jogo.id);
                return (
                  <tr key={jogo.id}>
                    <td className="px-4 py-3 font-bold text-slate-950">{jogo.abreviacao}</td>
                    <td className="px-4 py-3">
                      {formatarData(jogo.data)} {jogo.horario}
                    </td>
                    <td className="px-4 py-3">
                      {jogo.fase === "mata-mata" ? `${jogo.resultado ?? "pendente"} / ${jogo.classificado ?? "pendente"}` : (jogo.resultado ?? "pendente")}
                    </td>
                    <td className="px-4 py-3">
                      {jogo.fase === "mata-mata" ? `${palpite?.palpite ?? "-"} / ${palpite?.classificado ?? "-"}` : (palpite?.palpite ?? "-")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={palpite && palpite.pontos > 0 ? "green" : "gray"}>{palpite?.pontos ?? 0} pts</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {participante.jogosSemPalpite.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-black text-slate-950">Jogos ainda sem palpite</h2>
          </CardHeader>
          <CardBody className="grid gap-2 md:grid-cols-2">
            {participante.jogosSemPalpite.map((jogo) => (
              <div key={jogo.id} className="rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">
                {jogo.abreviacao} · {formatarData(jogo.data)}
              </div>
            ))}
          </CardBody>
        </Card>
      ) : (
        <EmptyState title="Todos os jogos têm palpite" description="Não há pendências para este participante." />
      )}
    </div>
  );
}
