import type { Pagamento } from "../../types";
import { formatarData, formatarMoeda } from "../../utils/formatadores";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface PagamentoTableProps {
  pagamentos: Pagamento[];
  canEdit: boolean;
  onToggle: (pagamento: Pagamento) => void;
}

export function PagamentoTable({ pagamentos, canEdit, onToggle }: PagamentoTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-slate-100 bg-white md:hidden">
        {pagamentos.map((pagamento) => (
          <article key={pagamento.participante} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-base font-black text-slate-950">{pagamento.participante}</h3>
                <p className="mt-1 text-sm text-slate-500">PIX: {pagamento.pago ? "Sim" : "Não"}</p>
              </div>
              <Badge className="shrink-0" tone={pagamento.pago ? "green" : "yellow"}>{pagamento.situacao}</Badge>
            </div>

            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-100 p-3">
                <dt className="text-xs font-semibold text-slate-500">Data</dt>
                <dd className="mt-1 font-bold text-slate-950">{formatarData(pagamento.dataPagamento)}</dd>
              </div>
              <div className="rounded-lg bg-slate-100 p-3">
                <dt className="text-xs font-semibold text-slate-500">Valor</dt>
                <dd className="mt-1 font-bold text-slate-950">{formatarMoeda(pagamento.valor)}</dd>
              </div>
            </dl>

            <Button className="w-full no-print" variant="secondary" disabled={!canEdit} onClick={() => onToggle(pagamento)}>
              Marcar {pagamento.pago ? "pendente" : "pago"}
            </Button>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="px-4 py-3 font-bold">Participante</th>
              <th className="px-4 py-3 font-bold">Pagou o PIX?</th>
              <th className="px-4 py-3 font-bold">Data</th>
              <th className="px-4 py-3 font-bold">Valor</th>
              <th className="px-4 py-3 font-bold">Situação</th>
              <th className="px-4 py-3 font-bold no-print">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pagamentos.map((pagamento) => (
              <tr key={pagamento.participante} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-950">{pagamento.participante}</td>
                <td className="px-4 py-3">{pagamento.pago ? "Sim" : "Não"}</td>
                <td className="px-4 py-3">{formatarData(pagamento.dataPagamento)}</td>
                <td className="px-4 py-3">{formatarMoeda(pagamento.valor)}</td>
                <td className="px-4 py-3">
                  <Badge tone={pagamento.pago ? "green" : "yellow"}>{pagamento.situacao}</Badge>
                </td>
                <td className="px-4 py-3 no-print">
                  <Button variant="secondary" disabled={!canEdit} onClick={() => onToggle(pagamento)}>
                    Marcar {pagamento.pago ? "pendente" : "pago"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
