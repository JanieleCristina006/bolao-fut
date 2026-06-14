import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type BadgeTone = "red" | "green" | "blue" | "yellow" | "gray" | "dark" | "gold" | "silver" | "bronze";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

const tones: Record<BadgeTone, string> = {
  red: "bg-red-100 text-red-700",
  green: "bg-emerald-100 text-emerald-700",
  blue: "bg-blue-100 text-blue-700",
  yellow: "bg-amber-100 text-amber-800",
  gray: "bg-slate-100 text-slate-700",
  dark: "bg-slate-950 text-white",
  gold: "bg-yellow-100 text-yellow-800",
  silver: "bg-slate-200 text-slate-700",
  bronze: "bg-orange-100 text-orange-800"
};

export function Badge({ children, className, tone = "gray", ...props }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold", tones[tone], className)} {...props}>
      {children}
    </span>
  );
}
