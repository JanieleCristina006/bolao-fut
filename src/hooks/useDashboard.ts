import { api } from "../services/api";
import type { DashboardData } from "../types";
import { useApiResource } from "./useApiResource";

export function useDashboard() {
  return useApiResource<DashboardData>(api.getDashboard);
}
