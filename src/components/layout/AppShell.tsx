import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ClipboardList, CreditCard, FileText, LayoutDashboard, ListChecks, LogOut, ShieldCheck, Trophy, UserRound, Users } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { InstallPwaPrompt } from "../pwa/InstallPwaPrompt";
import { APP_NAME } from "../../constants";
import { cn } from "../../utils/cn";

const adminNavItems = [
  { to: "/", label: "Dashboard", mobileLabel: "Início", icon: LayoutDashboard },
  { to: "/ranking", label: "Ranking", mobileLabel: "Ranking", icon: Trophy },
  { to: "/jogos", label: "Jogos", mobileLabel: "Jogos", icon: ListChecks },
  { to: "/importar-whatsapp", label: "Importar palpites", mobileLabel: "Palpites", icon: ClipboardList },
  { to: "/participantes", label: "Participantes", mobileLabel: "Pessoas", icon: Users },
  { to: "/pagamentos", label: "Pagamentos", mobileLabel: "Pagto.", icon: CreditCard },
  { to: "/regulamento", label: "Regulamento", mobileLabel: "Regras", icon: FileText }
];

const participantNavItems = [
  { to: "/me", label: "Meu perfil", mobileLabel: "Perfil", icon: UserRound },
  { to: "/ranking", label: "Ranking", mobileLabel: "Ranking", icon: Trophy },
  { to: "/jogos", label: "Jogos", mobileLabel: "Jogos", icon: ListChecks },
  { to: "/regulamento", label: "Regulamento", mobileLabel: "Regras", icon: FileText }
];

export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const isParticipant = session?.role === "participant";
  const navItems = isParticipant ? participantNavItems : adminNavItems;
  const homeTo = isParticipant ? "/me" : "/";
  const mobileGridClass = isParticipant ? "grid-cols-4" : "grid-cols-7";
  const accessLabel = session?.role === "admin" ? "Admin" : session?.participanteNome ?? "Participante";
  const AccessIcon = session?.role === "admin" ? ShieldCheck : UserRound;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 max-lg:bg-[#121212]">
      <header className="pwa-safe-top sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white no-print max-lg:border-white/10 max-lg:bg-[#121212]/95 max-lg:backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4 max-lg:px-4">
          <NavLink to={homeTo} className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img src="/logo.jpg" alt="Futebol Inglês Brasil" className="h-10 w-10 shrink-0 rounded-lg object-cover shadow-lg ring-1 ring-white/10 sm:h-12 sm:w-12 max-lg:rounded-full max-lg:ring-white/20" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-black sm:text-xl max-lg:text-sm">{APP_NAME}</h1>
              <p className="truncate text-xs font-semibold text-slate-300 max-lg:text-zinc-100/80">{accessLabel}</p>
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
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-48 items-center gap-2 truncate rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 md:inline-flex">
              <AccessIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{accessLabel}</span>
            </span>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-white/10 max-lg:rounded-full max-lg:bg-white/10 max-lg:text-zinc-100"
              aria-label="Sair"
              title="Sair"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 pb-8 pt-4 sm:px-4 sm:pt-8 max-lg:px-4 max-lg:pb-28 max-lg:pt-4">{children}</main>

      <footer className="hidden border-t border-slate-800 bg-slate-950 pb-24 text-slate-300 no-print lg:block lg:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link to={homeTo} className="flex items-center gap-3">
              <img src="/logo.jpg" alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/10" />
              <div>
                <strong className="block text-base font-black text-white">{APP_NAME}</strong>
                <span className="text-sm text-slate-400">Futebol Inglês Brasil</span>
              </div>
            </Link>

            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold" aria-label="Links do rodapé">
              {navItems.map((item) => (
                <Link key={item.to} to={item.to} className="transition hover:text-white">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:flex sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {APP_NAME}. Todos os direitos reservados.</p>
            <p className="mt-1 sm:mt-0">Feito para acompanhar cada palpite.</p>
          </div>
        </div>
      </footer>

      <nav
        className="pwa-safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#121212]/95 px-3 py-3 shadow-[0_-18px_44px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:hidden no-print"
        aria-label="Navegação mobile"
      >
        <div className={cn("grid gap-1", mobileGridClass)}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[9px] font-bold leading-none transition min-[360px]:text-[10px]",
                  isActive ? "bg-zinc-100 text-[#121212] shadow-[0_10px_28px_rgba(0,0,0,0.32)]" : "text-zinc-100/65 hover:bg-white/10 hover:text-white"
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

