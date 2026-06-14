import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Card, CardBody } from "./Card";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Card>
      <CardBody className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 text-brand-600" aria-hidden />
          <div>
            <h2 className="font-bold text-slate-950">Não foi possível carregar</h2>
            <p className="text-sm text-slate-600">{message}</p>
          </div>
        </div>
        <Button onClick={onRetry}>Tentar novamente</Button>
      </CardBody>
    </Card>
  );
}
