import { AlertTriangle, CheckCircle2, EyeOff, Trash2, Undo2 } from "lucide-react";
import { useMemo } from "react";
import type { Jogo, Participante } from "../../types";
import type { DecisaoImportacaoPalpite, ImportacaoPalpiteItem, ResultadoImportacaoPalpites, StatusImportacaoPalpite } from "../../types/importacaoPalpites";
import { cn } from "../../utils/cn";
import { formatarData } from "../../utils/formatadores";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

interface PreviaImportacaoPalpitesProps {
  resultado: ResultadoImportacaoPalpites;
  participantes: Participante[];
  jogos: Jogo[];
  onItemChange: (id: string, patch: Partial<ImportacaoPalpiteItem>) => void;
  onToggleIncluir: (id: string) => void;
}

const statusMeta: Record<StatusImportacaoPalpite, { label: string; tone: "red" | "green" | "blue" | "yellow" | "gray" | "dark" }> = {
  valido: { label: "Válido", tone: "green" },
  "palpite-existente": { label: "Já existe", tone: "blue" },
  "participante-nao-encontrado": { label: "Participante não encontrado", tone: "red" },
  "jogo-nao-encontrado": { label: "Jogo não encontrado", tone: "red" },
  "celula-nao-encontrada": { label: "Célula não encontrada", tone: "red" },
  "times-invertidos": { label: "Times invertidos", tone: "yellow" },
  duplicado: { label: "Duplicado", tone: "yellow" },
  "nao-enviou": { label: "Não enviou", tone: "gray" },
  "formato-invalido": { label: "Formato inválido", tone: "red" },
  removido: { label: "Removido", tone: "dark" }
};

function jogoLabel(jogo: Jogo): string {
  const data = formatarData(jogo.data);
  const cabecalho = "cabecalhoPlanilha" in jogo ? String(jogo.cabecalhoPlanilha) : jogo.abreviacao;
  return `${cabecalho} · ${data === "-" ? jogo.dia : data}`;
}

function rowClass(item: ImportacaoPalpiteItem): string {
  if (!item.incluir && item.status !== "nao-enviou") return "bg-slate-50 text-slate-500";
  if (item.status === "valido") return "bg-emerald-50/60";
  if (item.status === "palpite-existente") return "bg-blue-50/60";
  if (item.status === "duplicado" || item.status === "times-invertidos") return "bg-amber-50/70";
  if (item.status === "nao-enviou") return "bg-slate-50";
  if (!item.valido) return "bg-red-50/70";
  return "";
}

function temPalpiteAtual(item: ImportacaoPalpiteItem): boolean {
  return Boolean(item.palpiteAtual || item.classificadoAtual);
}

export function PreviaImportacaoPalpites({
  resultado,
  participantes,
  jogos,
  onItemChange,
  onToggleIncluir
}: PreviaImportacaoPalpitesProps) {
  const participantesOrdenados = useMemo(() => [...participantes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [participantes]);
  const jogosOrdenados = useMemo(
    () => [...jogos].sort((a, b) => `${a.data}-${a.mandante}`.localeCompare(`${b.data}-${b.mandante}`, "pt-BR")),
    [jogos]
  );

  function alterarPlacar(item: ImportacaoPalpiteItem, campo: "golsCasa" | "golsFora", valor: string) {
    const numero = valor === "" ? null : Number(valor);
    const golsCasa = campo === "golsCasa" ? numero : item.golsCasa;
    const golsFora = campo === "golsFora" ? numero : item.golsFora;
    onItemChange(item.id, {
      [campo]: numero,
      placar: golsCasa !== null && golsFora !== null ? `${golsCasa}x${golsFora}` : ""
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Pré-visualização</h3>
            <p className="text-sm text-slate-500">Confira participantes, jogos, placares e decisões antes de gravar na planilha.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[28rem]">
            <Badge tone="green">Válidos: {resultado.resumo.validos}</Badge>
            <Badge tone="blue">Importáveis: {resultado.resumo.importaveis}</Badge>
            <Badge tone="yellow">Duplicados: {resultado.resumo.duplicados}</Badge>
            <Badge tone="gray">Não enviados: {resultado.resumo.naoEnviados}</Badge>
          </div>
        </div>
        {resultado.erros.length > 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {resultado.erros.map((erro) => (
              <p key={erro}>{erro}</p>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Participante</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Jogo</th>
                <th className="px-3 py-2">Palpite</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Decisão</th>
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {resultado.itens.map((item) => {
                const meta = statusMeta[item.status];
                const isDisabled = item.status === "nao-enviou" || item.status === "removido";
                return (
                  <tr key={item.id} className={cn("align-top shadow-sm", rowClass(item))}>
                    <td className="rounded-l-lg border-y border-l border-slate-200 px-3 py-3">
                      <Select
                        value={item.participanteOficial ?? ""}
                        disabled={isDisabled}
                        onChange={(event) => {
                          const nome = event.target.value;
                          onItemChange(item.id, {
                            participanteOficial: nome || undefined,
                            participanteTexto: nome || item.participanteTexto,
                            participanteValido: Boolean(nome)
                          });
                        }}
                      >
                        <option value="">Selecione</option>
                        {participantesOrdenados.map((participante) => (
                          <option key={participante.nome} value={participante.nome}>
                            {participante.nome}
                          </option>
                        ))}
                      </Select>
                      {item.participanteTexto !== item.participanteOficial ? (
                        <p className="mt-1 text-xs text-slate-500">Texto: {item.participanteTexto}</p>
                      ) : null}
                    </td>
                    <td className="border-y border-slate-200 px-3 py-3 font-semibold text-slate-700">{item.data ?? "-"}</td>
                    <td className="border-y border-slate-200 px-3 py-3">
                      <Select
                        value={item.jogoId ?? ""}
                        disabled={isDisabled}
                        onChange={(event) => {
                          const jogo = jogos.find((opcao) => opcao.id === event.target.value);
                          onItemChange(item.id, {
                            jogoId: jogo?.id,
                            jogoTexto: jogo ? `${jogo.mandante} x ${jogo.visitante}` : item.jogoTexto,
                            mandanteOficial: jogo?.mandante,
                            visitanteOficial: jogo?.visitante,
                            cabecalhoPlanilha: jogo && "cabecalhoPlanilha" in jogo ? String(jogo.cabecalhoPlanilha) : jogo?.abreviacao,
                            timeCasa: jogo?.mandante ?? item.timeCasa,
                            timeFora: jogo?.visitante ?? item.timeFora
                          });
                        }}
                      >
                        <option value="">Selecione o jogo</option>
                        {jogosOrdenados.map((jogo) => (
                          <option key={jogo.id} value={jogo.id}>
                            {jogoLabel(jogo)}
                          </option>
                        ))}
                      </Select>
                      <p className="mt-1 text-xs text-slate-500">Lido: {item.timeCasa && item.timeFora ? `${item.timeCasa} x ${item.timeFora}` : item.jogoTexto}</p>
                      {item.cabecalhoPlanilha || item.celulaPlanilha ? (
                        <p className="mt-1 text-xs font-semibold text-brand-700">
                          Planilha: {item.cabecalhoPlanilha ?? item.jogoTexto}
                          {item.celulaPlanilha ? ` · ${item.celulaPlanilha}` : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="border-y border-slate-200 px-3 py-3">
                      {item.status === "nao-enviou" ? (
                        <span className="font-bold text-slate-500">—</span>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-[4.5rem_4.5rem] gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={99}
                              value={item.golsCasa ?? ""}
                              disabled={isDisabled}
                              aria-label="Gols do mandante"
                              onChange={(event) => alterarPlacar(item, "golsCasa", event.target.value)}
                            />
                            <Input
                              type="number"
                              min={0}
                              max={99}
                              value={item.golsFora ?? ""}
                              disabled={isDisabled}
                              aria-label="Gols do visitante"
                              onChange={(event) => alterarPlacar(item, "golsFora", event.target.value)}
                            />
                          </div>
                          <Input
                            value={item.classificado ?? ""}
                            disabled={isDisabled}
                            aria-label="Classificado"
                            placeholder="Classificado"
                            onChange={(event) => onItemChange(item.id, { classificado: event.target.value })}
                          />
                        </div>
                      )}
                      {temPalpiteAtual(item) ? (
                        <p className="mt-1 text-xs font-semibold text-blue-700">
                          Atual: {item.palpiteAtual || "-"} / {item.classificadoAtual || "-"} → Novo: {item.placar || "-"} / {item.classificado || "-"}
                        </p>
                      ) : null}
                    </td>
                    <td className="border-y border-slate-200 px-3 py-3">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {[...item.erros, ...item.avisos].map((mensagem) => (
                          <p key={mensagem} className="flex gap-1">
                            {item.erros.includes(mensagem) ? (
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
                            ) : (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                            )}
                            <span>{mensagem}</span>
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="border-y border-slate-200 px-3 py-3">
                      {item.status === "nao-enviou" ? (
                        <span className="text-xs font-semibold text-slate-500">Não altera a planilha</span>
                      ) : temPalpiteAtual(item) ? (
                        <Select
                          value={item.decisao}
                          disabled={!item.incluir}
                          onChange={(event) => onItemChange(item.id, { decisao: event.target.value as DecisaoImportacaoPalpite })}
                        >
                          <option value="manter">Manter atual</option>
                          <option value="substituir">Substituir pelo novo</option>
                          <option value="ignorar">Ignorar item</option>
                        </Select>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700">Inserir novo palpite</span>
                      )}
                      {item.duplicado && item.usarNaImportacao ? (
                        <p className="mt-1 text-xs font-bold text-amber-700">Último palpite selecionado</p>
                      ) : null}
                    </td>
                    <td className="rounded-r-lg border-y border-r border-slate-200 px-3 py-3 text-right">
                      {item.status !== "nao-enviou" ? (
                        <Button
                          variant={item.incluir ? "ghost" : "secondary"}
                          className="min-h-9 px-3"
                          icon={item.incluir ? <Trash2 className="h-4 w-4" aria-hidden /> : <Undo2 className="h-4 w-4" aria-hidden />}
                          onClick={() => onToggleIncluir(item.id)}
                        >
                          {item.incluir ? "Remover" : "Restaurar"}
                        </Button>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-slate-500">
                          <EyeOff className="h-4 w-4" aria-hidden />
                          vazio
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {resultado.linhasIgnoradas.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-black text-slate-800">Linhas ignoradas</h4>
            <div className="mt-2 max-h-40 overflow-auto text-sm text-slate-600">
              {resultado.linhasIgnoradas.map((linha, index) => (
                <p key={`${linha}-${index}`}>{linha}</p>
              ))}
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
