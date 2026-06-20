import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ClipboardList, CreditCard, FileText, LayoutDashboard, ListChecks, Trophy, Users } from "lucide-react";
import { InstallPwaPrompt } from "../pwa/InstallPwaPrompt";
import { APP_NAME } from "../../constants";
import { cn } from "../../utils/cn";

const navItems = [
  { to: "/", label: "Dashboard", mobileLabel: "Início", icon: LayoutDashboard },
  { to: "/ranking", label: "Ranking", mobileLabel: "Ranking", icon: Trophy },
  { to: "/jogos", label: "Jogos", mobileLabel: "Jogos", icon: ListChecks },
  { to: "/importar-whatsapp", label: "Importar palpites", mobileLabel: "Palpites", icon: ClipboardList },
  { to: "/participantes", label: "Participantes", mobileLabel: "Pessoas", icon: Users },
  { to: "/pagamentos", label: "Pagamentos", mobileLabel: "Pagto.", icon: CreditCard },
  { to: "/regulamento", label: "Regulamento", mobileLabel: "Regras", icon: FileText }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
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

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 pb-8 pt-4 sm:px-4 sm:pt-8">{children}</main>

      <footer className="border-t border-slate-800 bg-slate-950 pb-24 text-slate-300 no-print lg:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo.jpg" alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/10" />
              <div>
                <strong className="block text-base font-black text-white">{APP_NAME}</strong>
                <span className="text-sm text-slate-400">Futebol Inglês Brasil</span>
              </div>
            </Link>

            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold" aria-label="Links do rodapé">
              <Link to="/ranking" className="transition hover:text-white">Ranking</Link>
              <Link to="/jogos" className="transition hover:text-white">Jogos</Link>
              <Link to="/participantes" className="transition hover:text-white">Participantes</Link>
              <Link to="/regulamento" className="transition hover:text-white">Regulamento</Link>
            </nav>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:flex sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {APP_NAME}. Todos os direitos reservados.</p>
            <p className="mt-1 sm:mt-0">Feito para acompanhar cada palpite.</p>
          </div>
        </div>
      </footer>

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
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[9px] font-bold leading-none transition min-[360px]:text-[10px]",
                  isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
                )
              }
              aria-label={item.label}
              title={item.label}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              <span className="block max-w-full truncate">{item.mobileLabel}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <InstallPwaPrompt />
    </div>
  );
}
