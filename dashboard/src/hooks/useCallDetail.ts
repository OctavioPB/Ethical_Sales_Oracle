import { useEffect, useState } from "react";
import type { CallDetail } from "@/types";

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

interface UseCallDetailResult {
  detail: CallDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCallDetail(
  callId: string | null,
  token: string | null,
): UseCallDetailResult {
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!callId || !token) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const base = API_URL ?? "";
    fetch(`${base}/api/calls/${encodeURIComponent(callId)}/detail`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<CallDetail>;
      })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [callId, token, tick]);

  return {
    detail,
    isLoading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}
