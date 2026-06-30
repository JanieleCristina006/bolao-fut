import { useCallback } from "react";
import { api } from "../services/api";
import type { Jogo, Palpite, Participante } from "../types";
import { useApiResource } from "./useApiResource";

export function useJogos() {
  const loader = useCallback(async (forceRefresh = false) => {
    const [jogos, palpites, participantes] = await Promise.all([
      api.getJogos(forceRefresh),
      api.getPalpites(forceRefresh),
      api.getParticipantes(forceRefresh)
    ]);
    return { jogos, palpites, participantes };
  }, []);

  return useApiResource<{ jogos: Jogo[]; palpites: Palpite[]; participantes: Participante[] }>(loader);
}
