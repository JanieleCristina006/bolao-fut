import { api } from "../services/api";
import type { RankingItem } from "../types";
import { useApiResource } from "./useApiResource";

export function useRanking() {
  return useApiResource<RankingItem[]>(api.getRanking);
}
