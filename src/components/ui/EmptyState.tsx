import { SearchX } from "lucide-react";
import { Card, CardBody } from "./Card";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = "Nada encontrado",
  description = "Ajuste os filtros para visualizar outros dados."
}: EmptyStateProps) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 text-slate-600">
        <SearchX className="h-5 w-5 text-brand-600" aria-hidden />
        <div>
          <h2 className="font-bold text-slate-950">{title}</h2>
          <p className="text-sm">{description}</p>
        </div>
      </CardBody>
    </Card>
  );
}
