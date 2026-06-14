import type { ReactNode } from "react";
import { Card, CardBody } from "../ui/Card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
}

export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <Card>
      <CardBody className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <strong className="mt-1 block text-2xl font-black text-slate-950">{value}</strong>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
      </CardBody>
    </Card>
  );
}
