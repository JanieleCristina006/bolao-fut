interface AuthApiResponse {
  ok: boolean;
  message?: string;
  participante?: string;
}

interface ParticipantAuthStatus extends AuthApiResponse {
  hasPin: boolean;
}

const AUTH_API_URL = ((import.meta.env.VITE_AUTH_API_URL as string | undefined) || "/api/auth").trim();

async function postAuth<T extends AuthApiResponse>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(AUTH_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const json = (await response.json()) as T;
  if (!response.ok || json.ok === false) {
    throw new Error(json.message || `Erro ${response.status}.`);
  }
  return json;
}

export const authApi = {
  getParticipantStatus: (participante: string) =>
    postAuth<ParticipantAuthStatus>({ action: "status", participante }),
  setupParticipantPin: (participante: string, pin: string) =>
    postAuth<AuthApiResponse>({ action: "setupPin", participante, pin }),
  loginParticipant: (participante: string, pin: string) =>
    postAuth<AuthApiResponse>({ action: "login", participante, pin })
};
