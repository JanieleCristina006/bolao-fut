import { api } from "../services/api";
import type { Participante } from "../types";
import { useApiResource } from "./useApiResource";

export function useParticipantes() {
  return useApiResource<Participante[]>(api.getParticipantes);
}
