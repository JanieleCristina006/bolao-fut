import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AdminSession = {
  role: "admin";
  adminToken: string;
};

type ParticipantSession = {
  role: "participant";
  participanteNome: string;
};

export type AuthSession = AdminSession | ParticipantSession;

interface AuthContextValue {
  session: AuthSession | null;
  signInAdmin: (adminToken: string) => void;
  signInParticipant: (participanteNome: string) => void;
  signOut: () => void;
}

const AUTH_SESSION_KEY = "bolao-auth-session";
const ADMIN_TOKEN_KEY = "bolao-admin-token";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (parsed.role === "admin" && typeof parsed.adminToken === "string" && parsed.adminToken.trim()) {
      window.sessionStorage.setItem(ADMIN_TOKEN_KEY, parsed.adminToken);
      return { role: "admin", adminToken: parsed.adminToken };
    }
    if (parsed.role === "participant" && typeof parsed.participanteNome === "string" && parsed.participanteNome.trim()) {
      return { role: "participant", participanteNome: parsed.participanteNome };
    }
  } catch {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
  }

  const legacyAdminToken = window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (legacyAdminToken?.trim()) {
    return { role: "admin", adminToken: legacyAdminToken };
  }

  return null;
}

function storeSession(session: AuthSession): void {
  window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      signInAdmin: (adminToken: string) => {
        const token = adminToken.trim();
        const nextSession: AuthSession = { role: "admin", adminToken: token };
        window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
        storeSession(nextSession);
        setSession(nextSession);
      },
      signInParticipant: (participanteNome: string) => {
        const nextSession: AuthSession = { role: "participant", participanteNome };
        window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        storeSession(nextSession);
        setSession(nextSession);
      },
      signOut: () => {
        window.sessionStorage.removeItem(AUTH_SESSION_KEY);
        window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setSession(null);
      }
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
