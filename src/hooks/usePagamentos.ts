import { api } from "../services/api";
import type { Pagamento } from "../types";
import { useApiResource } from "./useApiResource";

export function usePagamentos() {
  return useApiResource<Pagamento[]>(api.getPagamentos);
}
