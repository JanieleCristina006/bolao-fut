import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "./Button";

interface ToastMessage {
  id: number;
  text: string;
}

interface ToastContextValue {
  showToast: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string) => {
    const id = Date.now();
    setMessages((current) => [...current, { id, text }]);
    window.setTimeout(() => {
      setMessages((current) => current.filter((message) => message.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {messages.map((message) => (
          <div key={message.id} className="flex items-center gap-3 rounded-lg bg-slate-950 p-3 text-sm text-white shadow-soft">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden />
            <p className="flex-1">{message.text}</p>
            <Button
              variant="ghost"
              className="min-h-8 px-2 text-white hover:bg-white/10"
              aria-label="Fechar aviso"
              onClick={() => setMessages((current) => current.filter((item) => item.id !== message.id))}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return context;
}
