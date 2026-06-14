import { useCallback } from "react";
import { api } from "../services/api";
import type { Jogo, Palpite } from "../types";
import { useApiResource } from "./useApiResource";

export function useJogos() {
  const loader = useCallback(async (forceRefresh = false) => {
    const [jogos, palpites] = await Promise.all([api.getJogos(forceRefresh), api.getPalpites(forceRefresh)]);
    return { jogos, palpites };
  }, []);

  return useApiResource<{ jogos: Jogo[]; palpites: Palpite[] }>(loader);
}
