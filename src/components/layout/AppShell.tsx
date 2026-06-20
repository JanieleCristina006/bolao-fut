import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ClipboardList, CreditCard, FileText, LayoutDashboard, ListChecks, Trophy, Users } from "lucide-react";
import { InstallPwaPrompt } from "../pwa/InstallPwaPrompt";
import { APP_NAME } from "../../constants";
import { cn } from "../../utils/cn";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/jogos", label: "Jogos", icon: ListChecks },
  { to: "/importar-whatsapp", label: "Importar palpites", icon: ClipboardList },
  { to: "/participantes", label: "Participantes", icon: Users },
  { to: "/pagamentos", label: "Pagamentos", icon: CreditCard },
  { to: "/regulamento", label: "Regulamento", icon: FileText }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="pwa-safe-top sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white no-print">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4">
          <NavLink to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img src="/logo.jpg" alt="Futebol Inglês Brasil" className="h-10 w-10 shrink-0 rounded-lg object-cover shadow-lg ring-1 ring-white/10 sm:h-12 sm:w-12" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-black sm:text-xl">{APP_NAME}</h1>
              <p className="truncate text-xs font-semibold text-slate-300">Futebol Inglês Brasil</p>
            </div>
          </NavLink>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                    isActive ? "bg-brand-600 text-white" : "text-slate-200 hover:bg-white/10"
                  )
                }
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-8">{children}</main>

      <nav
        className="pwa-safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] lg:hidden no-print"
        aria-label="Navegação mobile"
      >
        <div className="grid grid-cols-7 gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[9px] font-bold transition min-[420px]:text-[10px]",
                  isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
                )
              }
              aria-label={item.label}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              <span className="hidden min-[420px]:inline">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <InstallPwaPrompt />
    </div>
  );
}
