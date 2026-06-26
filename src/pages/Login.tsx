import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useToast } from "../components/ui/Toast";
import { APP_NAME } from "../constants";
import { useParticipantes } from "../hooks/useParticipantes";
import { authApi } from "../services/auth";
import { cn } from "../utils/cn";
import { normalizarTexto } from "../utils/formatadores";

type LoginMode = "choice" | "participant" | "admin";
type ParticipantAuthStep = "name" | "setupPin" | "loginPin";

function PasswordToggle({
  visible,
  onToggle,
  label
}: {
  visible: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
      aria-label={label}
      onClick={onToggle}
    >
      {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
    </button>
  );
}

export function Login() {
  const navigate = useNavigate();
  const { signInAdmin, signInParticipant } = useAuth();
  const { showToast } = useToast();
  const { data: participantes, isLoading, error, refetch } = useParticipantes();
  const [mode, setMode] = useState<LoginMode>("choice");
  const [nome, setNome] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [participantStep, setParticipantStep] = useState<ParticipantAuthStep>("name");
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showAdminToken, setShowAdminToken] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showPinConfirm, setShowPinConfirm] = useState(false);
  const [isCheckingParticipant, setIsCheckingParticipant] = useState(false);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

  const nomesParticipantes = useMemo(
    () => [...(participantes ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((participante) => participante.nome),
    [participantes]
  );

  function handleAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = adminToken.trim();
    if (!token) {
      showToast("Informe o token administrativo.");
      return;
    }

    signInAdmin(token);
    navigate("/", { replace: true });
  }

  async function handleParticipantNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nomeDigitado = nome.trim().replace(/\s+/g, " ");
    if (!nomeDigitado) {
      showToast("Informe o nome do participante.");
      return;
    }

    const participante = participantes?.find((item) => normalizarTexto(item.nome) === normalizarTexto(nomeDigitado));
    if (!participante) {
      showToast("Nome não encontrado na planilha. Confira como está cadastrado.");
      return;
    }

    setIsCheckingParticipant(true);
    try {
      const status = await authApi.getParticipantStatus(participante.nome);
      setSelectedParticipant(status.participante || participante.nome);
      setPin("");
      setPinConfirm("");
      setParticipantStep(status.hasPin ? "loginPin" : "setupPin");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível consultar o login.");
    } finally {
      setIsCheckingParticipant(false);
    }
  }

  async function handleParticipantPinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      showToast("A senha deve ter 6 dígitos.");
      return;
    }
    if (participantStep === "setupPin" && pin !== pinConfirm) {
      showToast("As senhas não conferem.");
      return;
    }

    setIsSubmittingPin(true);
    try {
      if (participantStep === "setupPin") {
        await authApi.setupParticipantPin(selectedParticipant, pin);
      } else {
        await authApi.loginParticipant(selectedParticipant, pin);
      }
      signInParticipant(selectedParticipant);
      navigate("/me", { replace: true });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setIsSubmittingPin(false);
    }
  }

  function resetParticipantFlow() {
    setParticipantStep("name");
    setSelectedParticipant("");
    setPin("");
    setPinConfirm("");
    setShowPin(false);
    setShowPinConfirm(false);
  }

  return (
    <main className="min-h-screen bg-[#121212] text-white">
      <section
        className="flex min-h-screen items-center justify-center bg-cover bg-center px-4 py-8 sm:px-6"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(18, 18, 18, 0.94), rgba(18, 18, 18, 0.88), rgba(18, 18, 18, 0.98)), url('/banner.jpg')"
        }}
      >
        <div className="w-full max-w-md">
          <div className="mb-7 flex flex-col items-center text-center">
            <img src="/logo.jpg" alt="Futebol Inglês Brasil" className="h-20 w-20 rounded-3xl object-cover shadow-soft ring-1 ring-white/20" />
            <h1 className="mt-4 text-2xl font-black">{APP_NAME}</h1>
            <p className="text-sm font-semibold text-zinc-100/65">Futebol Inglês Brasil</p>
          </div>

          {mode === "choice" ? (
            <div className="space-y-3">
              <button
                type="button"
                className={cn(
                  "flex min-h-24 w-full items-center gap-4 rounded-3xl border border-white/10 bg-white/10 p-4 text-left shadow-[0_16px_34px_rgba(0,0,0,0.28)] transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-white/15"
                )}
                onClick={() => setMode("admin")}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#121212]">
                  <ShieldCheck className="h-6 w-6" aria-hidden />
                </span>
                <span className="min-w-0">
                  <strong className="block text-lg font-black">Admin</strong>
            
                </span>
              </button>

              <button
                type="button"
                className={cn(
                  "flex min-h-24 w-full items-center gap-4 rounded-3xl border border-white/10 bg-[#1b1b1b] p-4 text-left text-white shadow-[0_16px_34px_rgba(0,0,0,0.32)] transition hover:bg-[#242424] focus:outline-none focus:ring-4 focus:ring-white/15"
                )}
                onClick={() => {
                  resetParticipantFlow();
                  setMode("participant");
                }}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-[#121212]">
                  <UserRound className="h-6 w-6" aria-hidden />
                </span>
                <span className="min-w-0">
                  <strong className="block text-lg font-black">Participante</strong>
                 
                </span>
              </button>
            </div>
          ) : (
            <Card className="!overflow-hidden !border-white/10 !bg-[#1b1b1b] !shadow-[0_18px_44px_rgba(0,0,0,0.36)]">
              <CardBody className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    className="min-h-10 px-3 !text-zinc-100 hover:!bg-white/10"
                    icon={<ArrowLeft className="h-4 w-4" aria-hidden />}
                    onClick={() => {
                      resetParticipantFlow();
                      setMode("choice");
                    }}
                  >
                    Voltar
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-10 px-3 !text-zinc-100 hover:!bg-white/10"
                    onClick={() => {
                      resetParticipantFlow();
                      setMode(mode === "participant" ? "admin" : "participant");
                    }}
                  >
                    {mode === "participant" ? "Entrar como admin" : "Sou participante"}
                  </Button>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-[#121212]">
                    {mode === "participant" ? <UserRound className="h-6 w-6" aria-hidden /> : <KeyRound className="h-6 w-6" aria-hidden />}
                  </span>
                  <div>
                    <h2 className="text-2xl font-black text-white">{mode === "participant" ? "Participante" : "Admin"}</h2>
                    <p className="text-sm font-semibold text-zinc-100/65">
                      {mode === "participant"
                        ? participantStep === "name"
                          ? "Selecione seu nome cadastrado."
                          : selectedParticipant
                        : "Informe o token de acesso."}
                    </p>
                  </div>
                </div>

                {mode === "participant" ? (
                  <>
                    {participantStep === "name" ? (
                      <>
                        {isLoading ? <LoadingSkeleton rows={3} /> : null}
                        {error ? <ErrorState message={error} onRetry={refetch} /> : null}
                        {!isLoading && !error ? (
                          <form className="space-y-4" onSubmit={handleParticipantNameSubmit}>
                            <label className="space-y-2">
                              <span className="text-sm font-bold text-zinc-100/75">Nome do participante</span>
                              <Input
                                className="!border-white/10 !bg-[#121212] !text-white placeholder:!text-zinc-500 focus:!border-zinc-400 focus:!ring-white/10"
                                value={nome}
                                list="participantes-login"
                                onChange={(event) => setNome(event.target.value)}
                                placeholder="Digite ou selecione seu nome"
                                autoComplete="name"
                                disabled={isCheckingParticipant}
                              />
                              <datalist id="participantes-login">
                                {nomesParticipantes.map((nomeParticipante) => (
                                  <option key={nomeParticipante} value={nomeParticipante} />
                                ))}
                              </datalist>
                            </label>
                            <Button
                            className="w-full !bg-zinc-100 !text-[#121212] hover:!bg-white disabled:!bg-zinc-700 disabled:!text-zinc-300 disabled:!opacity-100"
                              type="submit"
                              icon={<LogIn className="h-4 w-4" aria-hidden />}
                              disabled={!nome.trim() || isCheckingParticipant}
                            >
                              {isCheckingParticipant ? "Verificando..." : "Continuar"}
                            </Button>
                          </form>
                        ) : null}
                      </>
                    ) : (
                      <form className="space-y-4" onSubmit={handleParticipantPinSubmit}>
                        <label className="space-y-2">
                          <span className="text-sm font-bold text-zinc-100/75">
                            {participantStep === "setupPin" ? "Cadastre uma senha de 6 dígitos" : "Digite sua senha de 6 dígitos"}
                          </span>
                          <span className="relative block">
                            <Input
                              className="!border-white/10 !bg-[#121212] !pr-12 !text-white placeholder:!text-zinc-500 focus:!border-zinc-400 focus:!ring-white/10"
                              type={showPin ? "text" : "password"}
                              inputMode="numeric"
                              maxLength={6}
                              value={pin}
                              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                              placeholder="000000"
                              autoComplete="one-time-code"
                              disabled={isSubmittingPin}
                            />
                            <PasswordToggle visible={showPin} onToggle={() => setShowPin((current) => !current)} label={showPin ? "Ocultar senha" : "Mostrar senha"} />
                          </span>
                        </label>

                        {participantStep === "setupPin" ? (
                          <label className="space-y-2">
                            <span className="text-sm font-bold text-zinc-100/75">Confirmar senha</span>
                            <span className="relative block">
                              <Input
                                className="!border-white/10 !bg-[#121212] !pr-12 !text-white placeholder:!text-zinc-500 focus:!border-zinc-400 focus:!ring-white/10"
                                type={showPinConfirm ? "text" : "password"}
                                inputMode="numeric"
                                maxLength={6}
                                value={pinConfirm}
                                onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="000000"
                                autoComplete="one-time-code"
                                disabled={isSubmittingPin}
                              />
                              <PasswordToggle
                                visible={showPinConfirm}
                                onToggle={() => setShowPinConfirm((current) => !current)}
                                label={showPinConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                              />
                            </span>
                          </label>
                        ) : null}

                        <div className="grid gap-2">
                          <Button
                            className="w-full !bg-zinc-100 !text-[#121212] hover:!bg-white disabled:!bg-zinc-700 disabled:!text-zinc-300 disabled:!opacity-100"
                            type="submit"
                            icon={<LogIn className="h-4 w-4" aria-hidden />}
                            disabled={pin.length !== 6 || (participantStep === "setupPin" && pinConfirm.length !== 6) || isSubmittingPin}
                          >
                            {isSubmittingPin ? "Entrando..." : participantStep === "setupPin" ? "Cadastrar e entrar" : "Entrar"}
                          </Button>
                          <Button variant="ghost" className="w-full !text-zinc-100 hover:!bg-white/10" onClick={resetParticipantFlow}>
                            Trocar participante
                          </Button>
                        </div>
                      </form>
                    )}
                  </>
                ) : (
                  <form className="space-y-4" onSubmit={handleAdminSubmit}>
                    <label className="space-y-2">
                      <span className="text-sm font-bold text-zinc-100/75">Token de acesso</span>
                      <span className="relative block">
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                        <Input
                          className="!border-white/10 !bg-[#121212] !pl-9 !pr-12 !text-white placeholder:!text-zinc-500 focus:!border-zinc-400 focus:!ring-white/10"
                          type={showAdminToken ? "text" : "password"}
                          value={adminToken}
                          onChange={(event) => setAdminToken(event.target.value)}
                          placeholder="Token administrativo"
                          autoComplete="current-password"
                        />
                        <PasswordToggle
                          visible={showAdminToken}
                          onToggle={() => setShowAdminToken((current) => !current)}
                          label={showAdminToken ? "Ocultar token" : "Mostrar token"}
                        />
                      </span>
                    </label>
                    <Button className="w-full !bg-zinc-100 !text-[#121212] hover:!bg-white disabled:!bg-zinc-700 disabled:!text-zinc-300 disabled:!opacity-100" type="submit" icon={<LogIn className="h-4 w-4" aria-hidden />} disabled={!adminToken.trim()}>
                      Entrar no painel admin
                    </Button>
                  </form>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}

