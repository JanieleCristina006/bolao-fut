import { useCallback, useEffect, useState } from "react";
import { DATA_SOURCE_CHANGE_EVENT } from "../services/api";

interface ApiResourceState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApiResource<T>(loader: (forceRefresh?: boolean) => Promise<T>): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const resposta = await loader(forceRefresh);
        setData(resposta);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar os dados.");
      } finally {
        setIsLoading(false);
      }
    },
    [loader]
  );

  useEffect(() => {
    void carregar(false);
  }, [carregar]);

  useEffect(() => {
    const handleDataSourceChange = () => {
      void carregar(true);
    };

    window.addEventListener(DATA_SOURCE_CHANGE_EVENT, handleDataSourceChange);
    return () => window.removeEventListener(DATA_SOURCE_CHANGE_EVENT, handleDataSourceChange);
  }, [carregar]);

  return {
    data,
    isLoading,
    error,
    refetch: () => carregar(true)
  };
}
