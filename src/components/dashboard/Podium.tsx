import { Medal } from "lucide-react";
import type { RankingItem } from "../../types";
import { Badge } from "../ui/Badge";
import { Card, CardBody, CardHeader } from "../ui/Card";

interface PodiumProps {
  ranking: RankingItem[];
}

const podiumStyles = ["bg-yellow-50 border-yellow-200", "bg-slate-50 border-slate-200", "bg-orange-50 border-orange-200"];

export function Podium({ ranking }: PodiumProps) {
  const top = ranking.slice(0, 3);
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <h2 className="text-lg font-black text-slate-950">Pódio</h2>
      </CardHeader>
      <CardBody className="grid gap-3 sm:grid-cols-3">
        {top.map((item, index) => (
          <div key={item.participante} className={`rounded-lg border p-4 ${podiumStyles[index]}`}>
            <div className="flex items-center justify-between gap-3">
              <Medal className="h-7 w-7 text-brand-600" aria-hidden />
              <Badge tone={index === 0 ? "gold" : index === 1 ? "silver" : "bronze"}>{item.posicao}º</Badge>
            </div>
            <h3 className="mt-4 text-base font-black text-slate-950">{item.participante}</h3>
            <p className="text-sm text-slate-600">
              {item.pontos} pontos · {item.cravadas} cravadas
            </p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
