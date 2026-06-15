import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { CreditCard, FileText, LayoutDashboard, ListChecks, RotateCcw, Trophy, Upload, Users } from "lucide-react";
import { InstallPwaPrompt } from "../pwa/InstallPwaPrompt";
import { APP_NAME } from "../../constants";
import { api, DATA_SOURCE_CHANGE_EVENT, isImportedSpreadsheetActive, isSpreadsheetImportEnabled } from "../../services/api";
import { cn } from "../../utils/cn";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/jogos", label: "Jogos", icon: ListChecks },
  { to: "/participantes", label: "Participantes", icon: Users },
  { to: "/pagamentos", label: "Pagamentos", icon: CreditCard },
  { to: "/regulamento", label: "Regulamento", icon: FileText }
];

export function AppShell({ children }: { children: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [hasImportedSpreadsheet, setHasImportedSpreadsheet] = useState(isImportedSpreadsheetActive());
  const [canImportSpreadsheet, setCanImportSpreadsheet] = useState(isSpreadsheetImportEnabled());

  useEffect(() => {
    const syncDataSource = () => {
      setHasImportedSpreadsheet(isImportedSpreadsheetActive());
      setCanImportSpreadsheet(isSpreadsheetImportEnabled());
    };

    window.addEventListener(DATA_SOURCE_CHANGE_EVENT, syncDataSource);
    return () => window.removeEventListener(DATA_SOURCE_CHANGE_EVENT, syncDataSource);
  }, []);

  async function handleImportSpreadsheet(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!canImportSpreadsheet) {
      showToast("A fonte em tempo real já está ativa. A importação de Excel local está desativada.");
      return;
    }

    setIsImporting(true);
    try {
      const dashboard = await api.importarPlanilha(file);
      showToast(`Planilha importada: ${dashboard.resumo.totalParticipantes} participantes e ${dashboard.jogos.length} jogos.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível importar a planilha.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleClearImportedSpreadsheet() {
    api.limparPlanilhaImportada();
    showToast("Planilha padrão restaurada.");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="pwa-safe-top sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white no-print">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <NavLink to="/" className="flex min-w-0 items-center gap-3">
            <img src="/logo.jpg" alt="Futebol Inglês Brasil" className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-lg ring-1 ring-white/10" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black sm:text-xl">{APP_NAME}</h1>
              <p className="truncate text-xs font-semibold text-slate-300">Futebol Inglês Brasil</p>
            </div>
          </NavLink>
          <div className="flex shrink-0 items-center gap-2">
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
            {canImportSpreadsheet ? (
              <>
                <input
                  ref={inputRef}
                  className="hidden"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleImportSpreadsheet}
                />
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="secondary"
                    className="border-white/20 bg-white/10 px-3 text-white hover:bg-white/20 focus:ring-white/20 sm:px-4"
                    icon={<Upload className="h-4 w-4" aria-hidden />}
                    disabled={isImporting}
                    aria-label="Importar planilha"
                    onClick={() => inputRef.current?.click()}
                  >
                    <span className="hidden sm:inline">{isImporting ? "Importando..." : "Importar planilha"}</span>
                  </Button>
                  {hasImportedSpreadsheet ? (
                    <Button
                      variant="ghost"
                      className="min-h-10 px-3 text-white hover:bg-white/10 focus:ring-white/20"
                      icon={<RotateCcw className="h-4 w-4" aria-hidden />}
                      aria-label="Restaurar planilha padrão"
                      title="Restaurar planilha padrão"
                      onClick={handleClearImportedSpreadsheet}
                    >
                      <span className="hidden xl:inline">Usar padrão</span>
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">{children}</main>

      <nav
        className="pwa-safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] lg:hidden no-print"
        aria-label="Navegação mobile"
      >
        <div className="grid grid-cols-6 gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-bold transition",
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
