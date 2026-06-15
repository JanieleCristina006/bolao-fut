import type { SelectHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 sm:min-h-10 sm:text-sm",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
