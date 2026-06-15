import { Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./components/ui/Toast";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { ImportarPalpitesWhatsApp } from "./pages/ImportarPalpitesWhatsApp";
import { Jogos } from "./pages/Jogos";
import { Pagamentos } from "./pages/Pagamentos";
import { ParticipanteDetalhes } from "./pages/ParticipanteDetalhes";
import { Participantes } from "./pages/Participantes";
import { Ranking } from "./pages/Ranking";
import { Regulamento } from "./pages/Regulamento";

export default function App() {
  return (
    <ToastProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/jogos" element={<Jogos />} />
          <Route path="/importar-whatsapp" element={<ImportarPalpitesWhatsApp />} />
          <Route path="/participantes" element={<Participantes />} />
          <Route path="/participantes/:nome" element={<ParticipanteDetalhes />} />
          <Route path="/pagamentos" element={<Pagamentos />} />
          <Route path="/regulamento" element={<Regulamento />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </ToastProvider>
  );
}
