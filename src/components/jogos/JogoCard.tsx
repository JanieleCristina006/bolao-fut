import { ChevronDown, ChevronUp, Download, PencilLine, Save, Timer, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PONTUACAO_LABELS } from "../../constants";
import type { Jogo, Palpite, PontuacaoTipo } from "../../types";
import { cn } from "../../utils/cn";
import { formatarData } from "../../utils/formatadores";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { Spinner } from "../ui/Spinner";

interface JogoCardProps {
  jogo: Jogo;
  palpites: Palpite[];
  initiallyOpen?: boolean;
  canEditResult?: boolean;
  isSavingResult?: boolean;
  onPdf: (jogo: Jogo, palpites: Palpite[]) => void;
  onSaveResult?: (jogo: Jogo, resultado: string) => Promise<boolean>;
}

function tonePorTipo(tipo: PontuacaoTipo) {
  if (tipo === "exato") return "green";
  if (tipo === "vencedor") return "blue";
  if (tipo === "empate") return "yellow";
  if (tipo === "erro") return "red";
  return "gray";
}

function rowClass(tipo: PontuacaoTipo) {
  return {
    exato: "border-emerald-200 bg-emerald-50",
    vencedor: "border-blue-200 bg-blue-50",
    empate: "border-amber-200 bg-amber-50",
    erro: "border-slate-200 bg-slate-50",
    pendente: "border-slate-200 bg-slate-100"
  }[tipo];
}

export function JogoCard({
  jogo,
  palpites,
  initiallyOpen = false,
  canEditResult = false,
  isSavingResult = false,
  onPdf,
  onSaveResult
}: JogoCardProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [editingResult, setEditingResult] = useState(false);
  const [resultValue, setResultValue] = useState(jogo.resultado ?? "");
  const palpitesOrdenados = useMemo(
    () => [...palpites].sort((a, b) => a.participante.localeCompare(b.participante, "pt-BR")),
    [palpites]
  );

  async function salvarResultado() {
    if (!onSaveResult) return;
    const saved = await onSaveResult(jogo, resultValue);
    if (saved) setEditingResult(false);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
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
          <h2 className="mt-2 break-words text-xl font-black text-slate-950">
            {jogo.mandante} <span className="text-brand-600">x</span> {jogo.visitante}
          </h2>
          <p className="text-sm text-slate-500">
            {jogo.abreviacao} · Resultado: <strong className="text-slate-900">{jogo.resultado ?? "pendente"}</strong>
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
          <Button className="w-full sm:w-auto" variant="secondary" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => onPdf(jogo, palpitesOrdenados)}>
            PDF do jogo
          </Button>
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
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {palpitesOrdenados.map((palpite) => (
              <div key={`${palpite.jogoId}-${palpite.participante}`} className={cn("rounded-lg border p-3", rowClass(palpite.tipo))}>
                <div className="flex items-start justify-between gap-3">
                  <strong className="min-w-0 break-words text-sm text-slate-950">{palpite.participante}</strong>
                  <Badge className="shrink-0" tone={tonePorTipo(palpite.tipo)}>{palpite.pontos} pts</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  Palpite: <strong>{palpite.palpite}</strong>
                </p>
                <p className="text-xs font-semibold text-slate-500">{PONTUACAO_LABELS[palpite.tipo]}</p>
              </div>
            ))}
          </div>
        </CardBody>
      )}
    </Card>
  );
}
