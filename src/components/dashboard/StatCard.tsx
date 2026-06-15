import type { ReactNode } from "react";
import { Card, CardBody } from "../ui/Card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: "gold" | "blue" | "emerald" | "amber" | "violet" | "rose";
}

const toneStyles: Record<NonNullable<StatCardProps["tone"]>, { card: string; icon: string; value: string }> = {
  gold: {
    card: "border-yellow-200 bg-gradient-to-br from-white to-yellow-50",
    icon: "bg-yellow-100 text-yellow-700 ring-yellow-200",
    value: "text-yellow-950"
  },
  blue: {
    card: "border-blue-200 bg-gradient-to-br from-white to-blue-50",
    icon: "bg-blue-100 text-blue-700 ring-blue-200",
    value: "text-blue-950"
  },
  emerald: {
    card: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50",
    icon: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    value: "text-emerald-950"
  },
  amber: {
    card: "border-amber-200 bg-gradient-to-br from-white to-amber-50",
    icon: "bg-amber-100 text-amber-700 ring-amber-200",
    value: "text-amber-950"
  },
  violet: {
    card: "border-violet-200 bg-gradient-to-br from-white to-violet-50",
    icon: "bg-violet-100 text-violet-700 ring-violet-200",
    value: "text-violet-950"
  },
  rose: {
    card: "border-rose-200 bg-gradient-to-br from-white to-rose-50",
    icon: "bg-rose-100 text-rose-700 ring-rose-200",
    value: "text-rose-950"
  }
};

export function StatCard({ label, value, icon, tone = "rose" }: StatCardProps) {
  const styles = toneStyles[tone];

  return (
    <Card className={styles.card}>
      <CardBody className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <strong className={`mt-1 block break-words text-xl font-black sm:text-2xl ${styles.value}`}>{value}</strong>
        </div>
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1 ${styles.icon}`}>{icon}</span>
      </CardBody>
    </Card>
  );
}
