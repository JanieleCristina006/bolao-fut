import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { ImportarPalpitesWhatsApp } from "./pages/ImportarPalpitesWhatsApp";
import { Jogos } from "./pages/Jogos";
import { Login } from "./pages/Login";
import { MeuPerfil } from "./pages/MeuPerfil";
import { Pagamentos } from "./pages/Pagamentos";
import { ParticipanteDetalhes } from "./pages/ParticipanteDetalhes";
import { Participantes } from "./pages/Participantes";
import { Ranking } from "./pages/Ranking";
import { Regulamento } from "./pages/Regulamento";

function LoginRoute() {
  const { session } = useAuth();
  if (session) return <Navigate to={session.role === "participant" ? "/me" : "/"} replace />;
  return <Login />;
}

function AuthenticatedArea() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;

  return (
    <AppShell>
      <Routes>
        {session.role === "admin" ? (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/jogos" element={<Jogos />} />
            <Route path="/importar-whatsapp" element={<ImportarPalpitesWhatsApp />} />
            <Route path="/participantes" element={<Participantes />} />
            <Route path="/participantes/:nome" element={<ParticipanteDetalhes />} />
            <Route path="/pagamentos" element={<Pagamentos />} />
            <Route path="/regulamento" element={<Regulamento />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Navigate to="/me" replace />} />
            <Route path="/me" element={<MeuPerfil />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/jogos" element={<Jogos />} />
            <Route path="/participantes" element={<Participantes />} />
            <Route path="/participantes/:nome" element={<ParticipanteDetalhes />} />
            <Route path="/regulamento" element={<Regulamento />} />
            <Route path="*" element={<Navigate to="/me" replace />} />
          </>
        )}
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/*" element={<AuthenticatedArea />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
