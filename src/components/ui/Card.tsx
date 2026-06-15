import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white shadow-soft", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: CardProps) {
  return (
    <div className={cn("border-b border-slate-100 px-4 py-4 sm:px-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ children, className, ...props }: CardProps) {
  return (
    <div className={cn("p-4 sm:p-5", className)} {...props}>
      {children}
    </div>
  );
}
