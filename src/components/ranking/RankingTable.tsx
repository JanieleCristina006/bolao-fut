import { Medal } from "lucide-react";
import type { RankingItem } from "../../types";
import { cn } from "../../utils/cn";
import { porcentagem } from "../../utils/formatadores";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface RankingTableProps {
  ranking: RankingItem[];
  destaque?: string;
}

function medalTone(posicao: number) {
  if (posicao === 1) return "gold";
  if (posicao === 2) return "silver";
  if (posicao === 3) return "bronze";
  return "gray";
}

export function RankingTable({ ranking, destaque }: RankingTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="px-4 py-3 font-bold">Posição</th>
              <th className="px-4 py-3 font-bold">Participante</th>
              <th className="px-4 py-3 font-bold">Pontos</th>
              <th className="px-4 py-3 font-bold">Cravadas</th>
              <th className="px-4 py-3 font-bold">Palpites</th>
              <th className="px-4 py-3 font-bold">Aproveitamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {ranking.map((item) => {
              const isDestaque = destaque && item.participante === destaque;
              return (
                <tr key={item.participante} className={cn(isDestaque ? "bg-brand-50" : "hover:bg-slate-50")}>
                  <td className="px-4 py-3">
                    <Badge tone={medalTone(item.posicao)}>
                      {item.posicao <= 3 && <Medal className="mr-1 h-3.5 w-3.5" aria-hidden />}
                      {item.posicao}º
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-950">{item.participante}</td>
                  <td className="px-4 py-3">
                    <Badge tone="dark">{item.pontos} pts</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="green">{item.cravadas}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.palpites}</td>
                  <td className="px-4 py-3 text-slate-700">{porcentagem(item.aproveitamento)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
