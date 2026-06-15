import { Medal } from "lucide-react";
import type { RankingItem } from "../../types";
import { Badge } from "../ui/Badge";
import { Card, CardBody, CardHeader } from "../ui/Card";

interface PodiumProps {
  ranking: RankingItem[];
}

const podiumStyles = [
  "border-yellow-200 bg-gradient-to-br from-yellow-50 to-white",
  "border-slate-200 bg-gradient-to-br from-slate-50 to-white",
  "border-orange-200 bg-gradient-to-br from-orange-50 to-white"
];

const medalStyles = ["text-yellow-600", "text-slate-500", "text-orange-600"];

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
              <Medal className={`h-7 w-7 ${medalStyles[index]}`} aria-hidden />
              <Badge tone={index === 0 ? "gold" : index === 1 ? "silver" : "bronze"}>#{item.posicao}</Badge>
            </div>
            <h3 className="mt-4 break-words text-base font-black text-slate-950 sm:truncate">{item.participante}</h3>
            <p className="text-sm text-slate-600">
              {item.pontos} pontos - {item.cravadas} cravadas
            </p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
