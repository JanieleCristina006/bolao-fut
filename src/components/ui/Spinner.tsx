import { cn } from "../../utils/cn";

interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label = "Carregando" }: SpinnerProps) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent",
        className
      )}
      role="status"
      aria-label={label}
    />
  );
}
