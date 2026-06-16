import { useCallback, useEffect, useRef, useState } from "react";
import { LIVE_REFRESH_MS } from "../constants";
import { DATA_SOURCE_CHANGE_EVENT, isLiveDataSourceActive } from "../services/api";

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
  const hasLoadedData = useRef(false);

  const carregar = useCallback(
    async (forceRefresh = false) => {
      const isInitialLoad = !hasLoadedData.current;
      if (isInitialLoad) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const resposta = await loader(forceRefresh);
        hasLoadedData.current = true;
        setData(resposta);
        setError(null);
      } catch (err) {
        if (isInitialLoad) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar os dados.");
        }
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        }
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!isLiveDataSourceActive()) return;
      if (document.visibilityState === "hidden") return;
      void carregar(true);
    }, LIVE_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [carregar]);

  return {
    data,
    isLoading,
    error,
    refetch: () => carregar(true)
  };
}
