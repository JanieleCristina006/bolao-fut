import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500">
        Página {page} de {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          icon={<ChevronLeft className="h-4 w-4" aria-hidden />}
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        />
        <Button
          variant="secondary"
          icon={<ChevronRight className="h-4 w-4" aria-hidden />}
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Próxima página"
        />
      </div>
    </div>
  );
}
