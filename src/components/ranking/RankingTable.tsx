import { Medal, Pencil } from "lucide-react";
import type { RankingItem } from "../../types";
import { cn } from "../../utils/cn";
import { porcentagem } from "../../utils/formatadores";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Spinner } from "../ui/Spinner";

interface RankingTableProps {
  ranking: RankingItem[];
  destaque?: string;
  canEditPoints?: boolean;
  savingParticipant?: string | null;
  onEditPoints?: (item: RankingItem) => void;
}

function medalTone(posicao: number) {
  if (posicao === 1) return "gold";
  if (posicao === 2) return "silver";
  if (posicao === 3) return "bronze";
  return "gray";
}

export function RankingTable({ ranking, destaque, canEditPoints = false, savingParticipant, onEditPoints }: RankingTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-slate-100 bg-white md:hidden">
        {ranking.map((item) => {
          const isDestaque = destaque && item.participante === destaque;
          const isSaving = savingParticipant === item.participante;
          return (
            <article key={item.participante} className={cn("space-y-3 p-4", isDestaque ? "bg-brand-50" : undefined)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge tone={medalTone(item.posicao)}>
                    {item.posicao <= 3 && <Medal className="mr-1 h-3.5 w-3.5" aria-hidden />}
                    {item.posicao}º
                  </Badge>
                  <h3 className="mt-2 break-words text-base font-black text-slate-950">{item.participante}</h3>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="dark">{item.pontos} pts</Badge>
                  {canEditPoints ? (
                    <Button
                      className="min-h-9 w-9 px-0"
                      variant="secondary"
                      aria-label={`Editar pontos de ${item.participante}`}
                      title="Editar pontos"
                      disabled={isSaving}
                      icon={isSaving ? <Spinner className="h-4 w-4" label="Salvando" /> : <Pencil className="h-4 w-4" aria-hidden />}
                      onClick={() => onEditPoints?.(item)}
                    />
                  ) : null}
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-100 p-2">
                  <dt className="text-[11px] font-semibold text-slate-500">Cravadas</dt>
                  <dd className="font-black text-slate-950">{item.cravadas}</dd>
                </div>
                <div className="rounded-lg bg-slate-100 p-2">
                  <dt className="text-[11px] font-semibold text-slate-500">Palpites</dt>
                  <dd className="font-black text-slate-950">{item.palpites}</dd>
                </div>
                <div className="rounded-lg bg-slate-100 p-2">
                  <dt className="text-[11px] font-semibold text-slate-500">Aproveit.</dt>
                  <dd className="font-black text-slate-950">{porcentagem(item.aproveitamento)}</dd>
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
              <th className="px-4 py-3 font-bold">Posição</th>
              <th className="px-4 py-3 font-bold">Participante</th>
              <th className="px-4 py-3 font-bold">Pontos</th>
              <th className="px-4 py-3 font-bold">Cravadas</th>
              <th className="px-4 py-3 font-bold">Palpites</th>
              <th className="px-4 py-3 font-bold">Aproveitamento</th>
              {canEditPoints ? <th className="px-4 py-3 font-bold no-print">Acao</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {ranking.map((item) => {
              const isDestaque = destaque && item.participante === destaque;
              const isSaving = savingParticipant === item.participante;
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
                  {canEditPoints ? (
                    <td className="px-4 py-3 no-print">
                      <Button
                        className="min-h-9 w-9 px-0"
                        variant="secondary"
                        aria-label={`Editar pontos de ${item.participante}`}
                        title="Editar pontos"
                        disabled={isSaving}
                        icon={isSaving ? <Spinner className="h-4 w-4" label="Salvando" /> : <Pencil className="h-4 w-4" aria-hidden />}
                        onClick={() => onEditPoints?.(item)}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
