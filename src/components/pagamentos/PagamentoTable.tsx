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
      <div className="overflow-x-auto">
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
