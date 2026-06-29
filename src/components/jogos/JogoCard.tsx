import { ChevronDown, ChevronUp, Download, PencilLine, Save, Search, Timer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PONTUACAO_LABELS } from "../../constants";
import type { Jogo, Palpite, PontuacaoTipo } from "../../types";
import { cn } from "../../utils/cn";
import { formatarData, normalizarTexto } from "../../utils/formatadores";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Spinner } from "../ui/Spinner";

type FormatoDownload = "pdf" | "imagem";
const PALPITES_PAGE_SIZE = 8;

interface JogoCardProps {
  jogo: Jogo;
  palpites: Palpite[];
  initiallyOpen?: boolean;
  canEditResult?: boolean;
  isSavingResult?: boolean;
  onDownload: (jogo: Jogo, palpites: Palpite[], formato: FormatoDownload) => void;
  onSaveResult?: (jogo: Jogo, resultado: string) => Promise<boolean>;
}

function tonePorTipo(tipo: PontuacaoTipo) {
  if (tipo === "exato") return "green";
  if (tipo === "vencedor") return "blue";
  if (tipo === "empate") return "yellow";
  if (tipo === "classificado") return "yellow";
  if (tipo === "erro") return "red";
  return "gray";
}

function rowClass(tipo: PontuacaoTipo) {
  return {
    exato: "border-emerald-200 bg-emerald-50 max-lg:border-white/15 max-lg:bg-zinc-100/10",
    vencedor: "border-blue-200 bg-blue-50 max-lg:border-cyan-300/30 max-lg:bg-cyan-300/10",
    empate: "border-amber-200 bg-amber-50 max-lg:border-amber-300/35 max-lg:bg-amber-300/10",
    classificado: "border-yellow-200 bg-yellow-50 max-lg:border-yellow-300/35 max-lg:bg-yellow-300/10",
    erro: "border-slate-200 bg-slate-50 max-lg:border-white/10 max-lg:bg-white/5",
    pendente: "border-slate-200 bg-slate-100 max-lg:border-white/10 max-lg:bg-white/[0.08]"
  }[tipo];
}

export function JogoCard({
  jogo,
  palpites,
  initiallyOpen = false,
  canEditResult = false,
  isSavingResult = false,
  onDownload,
  onSaveResult
}: JogoCardProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [editingResult, setEditingResult] = useState(false);
  const [resultValue, setResultValue] = useState(jogo.resultado ?? "");
  const [formatoDownload, setFormatoDownload] = useState<FormatoDownload>("pdf");
  const [buscaParticipante, setBuscaParticipante] = useState("");
  const [palpitesPage, setPalpitesPage] = useState(1);
  const palpitesOrdenados = useMemo(
    () => [...palpites].sort((a, b) => a.participante.localeCompare(b.participante, "pt-BR")),
    [palpites]
  );
  const palpitesVisiveis = useMemo(() => {
    const termo = normalizarTexto(buscaParticipante);
    if (!termo) return palpitesOrdenados;
    return palpitesOrdenados.filter((palpite) => normalizarTexto(palpite.participante).includes(termo));
  }, [buscaParticipante, palpitesOrdenados]);
  const totalPalpitesPages = Math.max(1, Math.ceil(palpitesVisiveis.length / PALPITES_PAGE_SIZE));
  const palpitesDaPagina = palpitesVisiveis.slice((palpitesPage - 1) * PALPITES_PAGE_SIZE, palpitesPage * PALPITES_PAGE_SIZE);

  useEffect(() => {
    setPalpitesPage(1);
  }, [buscaParticipante, jogo.id, palpitesOrdenados.length]);

  useEffect(() => {
    if (palpitesPage > totalPalpitesPages) setPalpitesPage(totalPalpitesPages);
  }, [palpitesPage, totalPalpitesPages]);

  async function salvarResultado() {
    if (!onSaveResult) return;
    const saved = await onSaveResult(jogo, resultValue);
    if (saved) setEditingResult(false);
  }

  return (
    <Card className="overflow-hidden max-lg:border-white/10 max-lg:bg-[#1b1b1b] max-lg:shadow-[0_16px_34px_rgba(0,0,0,0.32)]">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 max-lg:text-zinc-100/65">
            <Badge tone={jogo.status === "finalizado" ? "green" : "gray"}>{jogo.status}</Badge>
            <span>{jogo.rodada}</span>
            <span>·</span>
            <span>{jogo.dia}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Timer className="h-4 w-4" aria-hidden />
              {formatarData(jogo.data)} às {jogo.horario}
            </span>
          </div>
          <h2 className="mt-2 break-words text-xl font-black text-slate-950 max-lg:text-white">
            {jogo.mandante} <span className="text-brand-600">x</span> {jogo.visitante}
          </h2>
          <p className="text-sm text-slate-500 max-lg:text-zinc-100/65">
            {jogo.abreviacao} · Resultado: <strong className="text-slate-900 max-lg:text-zinc-100">{jogo.resultado ?? "pendente"}</strong>
            {jogo.fase === "mata-mata" ? (
              <>
                {" "}
                · Classificado: <strong className="text-slate-900 max-lg:text-zinc-100">{jogo.classificado ?? "pendente"}</strong>
              </>
            ) : null}
          </p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap lg:justify-end">
          {canEditResult ? (
            editingResult ? (
              <div className="flex w-full gap-2 sm:w-auto">
                <Input
                  className="w-28"
                  value={resultValue}
                  onChange={(event) => setResultValue(event.target.value)}
                  placeholder="2x1"
                  aria-label={`Resultado de ${jogo.mandante} x ${jogo.visitante}`}
                  disabled={isSavingResult}
                />
                <Button
                  aria-label="Salvar resultado"
                  title="Salvar resultado"
                  icon={isSavingResult ? <Spinner className="h-4 w-4" label="Salvando" /> : <Save className="h-4 w-4" aria-hidden />}
                  disabled={isSavingResult || !resultValue.trim()}
                  onClick={() => void salvarResultado()}
                >
                  Salvar
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Cancelar edição"
                  title="Cancelar edição"
                  disabled={isSavingResult}
                  onClick={() => {
                    setResultValue(jogo.resultado ?? "");
                    setEditingResult(false);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <Button
                className="w-full sm:w-auto"
                variant="secondary"
                icon={<PencilLine className="h-4 w-4" aria-hidden />}
                onClick={() => {
                  setResultValue(jogo.resultado ?? "");
                  setEditingResult(true);
                }}
              >
                {jogo.resultado ? "Editar resultado" : "Adicionar resultado"}
              </Button>
            )
          ) : null}
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 sm:w-auto">
            <Select
              className="min-w-0 sm:w-36"
              value={formatoDownload}
              onChange={(event) => setFormatoDownload(event.target.value as FormatoDownload)}
              aria-label={`Formato para baixar ${jogo.mandante} x ${jogo.visitante}`}
            >
              <option value="pdf">PDF</option>
              <option value="imagem">Imagem (PNG)</option>
            </Select>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" aria-hidden />}
              onClick={() => onDownload(jogo, palpitesOrdenados, formatoDownload)}
            >
              Baixar
            </Button>
          </div>
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            icon={open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
          >
            {open ? "Recolher" : "Expandir"}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardBody className="space-y-4">
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center max-lg:border-white/10 max-lg:bg-white/5">
            <label className="relative min-w-0">
              <span className="sr-only">Buscar participante neste jogo</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                className="pl-9"
                value={buscaParticipante}
                onChange={(event) => setBuscaParticipante(event.target.value)}
                placeholder="Buscar participante neste jogo"
              />
            </label>
            <span className="text-sm font-semibold text-slate-500 max-lg:text-zinc-100/70">
              {palpitesVisiveis.length} de {palpitesOrdenados.length} palpites
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {palpitesDaPagina.map((palpite) => (
              <div key={`${palpite.jogoId}-${palpite.participante}`} className={cn("rounded-lg border p-3", rowClass(palpite.tipo))}>
                <div className="flex items-start justify-between gap-3">
                  <strong className="min-w-0 break-words text-sm text-slate-950 max-lg:text-white">{palpite.participante}</strong>
                  <Badge className="shrink-0" tone={tonePorTipo(palpite.tipo)}>{palpite.pontos} pts</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-700 max-lg:text-zinc-100/80">
                  Palpite 90m: <strong>{palpite.palpite || "-"}</strong>
                </p>
                {jogo.fase === "mata-mata" ? (
                  <p className="text-sm text-slate-700 max-lg:text-zinc-100/80">
                    Classificado: <strong>{palpite.classificado || "-"}</strong>
                    {palpite.bonusClassificado ? <span className="font-semibold"> (+{palpite.bonusClassificado})</span> : null}
                  </p>
                ) : null}
                <p className="text-xs font-semibold text-slate-500 max-lg:text-zinc-100/60">{PONTUACAO_LABELS[palpite.tipo]}</p>
              </div>
            ))}
          </div>
          {palpitesVisiveis.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm font-semibold text-slate-500 max-lg:border-white/10 max-lg:bg-white/5 max-lg:text-zinc-100/70">
              Nenhum participante encontrado neste jogo.
            </div>
          ) : null}
          {palpitesVisiveis.length > PALPITES_PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2 max-lg:border-white/10 max-lg:bg-white/5">
              <Button
                variant="ghost"
                className="min-h-9 px-3 max-lg:text-zinc-100"
                disabled={palpitesPage === 1}
                onClick={() => setPalpitesPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm font-black text-slate-700 max-lg:text-zinc-100">
                {palpitesPage}/{totalPalpitesPages}
              </span>
              <Button
                variant="ghost"
                className="min-h-9 px-3 max-lg:text-zinc-100"
                disabled={palpitesPage === totalPalpitesPages}
                onClick={() => setPalpitesPage((current) => Math.min(totalPalpitesPages, current + 1))}
              >
                Próxima
              </Button>
            </div>
          ) : null}
        </CardBody>
      )}
    </Card>
  );
}

