import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import type { Participante } from "../../types";
import { porcentagem } from "../../utils/formatadores";
import { Badge } from "../ui/Badge";
import { Card, CardBody } from "../ui/Card";

interface ParticipanteCardProps {
  participante: Participante;
}

export function ParticipanteCard({ participante }: ParticipanteCardProps) {
  const pagamentoTone = participante.pagamento === "pago" ? "green" : participante.pagamento === "isento" ? "blue" : "yellow";
  const pagamentoIcon =
    participante.pagamento === "pago" ? (
      <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden />
    ) : participante.pagamento === "isento" ? (
      <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
    ) : (
      <Clock className="mr-1 h-3.5 w-3.5" aria-hidden />
    );

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge tone={participante.posicao <= 3 ? "gold" : "gray"}>{participante.posicao}º lugar</Badge>
            <h2 className="mt-3 break-words text-lg font-black text-slate-950">{participante.nome}</h2>
            <p className="text-sm text-slate-500">{porcentagem(participante.aproveitamento)} de aproveitamento</p>
          </div>
          <Badge className="shrink-0" tone={pagamentoTone}>
            {pagamentoIcon}
            {participante.pagamento}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-100 p-2">
            <strong className="block text-lg text-slate-950">{participante.pontos}</strong>
            <span className="text-xs text-slate-500">pontos</span>
          </div>
          <div className="rounded-lg bg-slate-100 p-2">
            <strong className="block text-lg text-slate-950">{participante.cravadas}</strong>
            <span className="text-xs text-slate-500">cravadas</span>
          </div>
          <div className="rounded-lg bg-slate-100 p-2">
            <strong className="block text-lg text-slate-950">{participante.palpitesEnviados}</strong>
            <span className="text-xs text-slate-500">palpites</span>
          </div>
        </div>
        <Link
          to={`/participantes/${encodeURIComponent(participante.nome)}`}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
        >
          Ver detalhes
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </CardBody>
    </Card>
  );
}
