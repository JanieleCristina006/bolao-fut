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
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center text-sm text-slate-500 sm:text-left">
        Página {page} de {totalPages}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          icon={<ChevronLeft className="h-4 w-4" aria-hidden />}
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        />
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          icon={<ChevronRight className="h-4 w-4" aria-hidden />}
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Próxima página"
        />
      </div>
    </div>
  );
}
