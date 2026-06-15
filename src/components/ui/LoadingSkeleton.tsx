import { cn } from "../../utils/cn";
import { Spinner } from "./Spinner";

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({ rows = 4, className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)} aria-label="Carregando">
      <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 shadow-soft">
        <Spinner className="text-brand-600" />
        <span>Carregando informações...</span>
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-200" />
      ))}
    </div>
  );
}
