/**
 * useRiskStream — manages the live risk event WebSocket connection.
 *
 * Primary path: Socket.io connection to /risk namespace, authenticated via
 * bearer token passed in socket handshake auth.
 *
 * Degraded path: when the socket disconnects, a 30-second polling interval
 * takes over and fetches the current call list via GET /api/calls.
 *
 * Callers receive:
 *   { calls, latestAlert, isConnected, isPolling, lastUpdated }
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { CallScore, RiskAlert, RiskStreamState } from "@/types";

const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;
const API_URL = import.meta.env.VITE_API_URL as string | undefined;
const POLL_INTERVAL_MS = 30_000;

function upsertCall(calls: CallScore[], incoming: CallScore): CallScore[] {
  const idx = calls.findIndex((c) => c.callId === incoming.callId);
  if (idx === -1) return [incoming, ...calls];
  const updated = [...calls];
  updated[idx] = incoming;
  return updated;
}

async function fetchActiveCalls(token: string): Promise<CallScore[]> {
  const base = API_URL ?? "";
  const res = await fetch(`${base}/api/calls`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /api/calls failed: ${res.status}`);
  const body = (await res.json()) as { data: CallScore[] };
  return body.data;
}

export function useRiskStream(token: string | null): RiskStreamState {
  const [calls, setCalls] = useState<CallScore[]>([]);
  const [latestAlert, setLatestAlert] = useState<RiskAlert | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback((authToken: string) => {
    if (pollRef.current) return;
    setIsPolling(true);
    const run = async () => {
      try {
        const data = await fetchActiveCalls(authToken);
        setCalls(data);
        setLastUpdated(new Date());
      } catch {
        // Swallow — polling continues; the UI shows stale data with a warning
      }
    };
    void run();
    pollRef.current = setInterval(() => void run(), POLL_INTERVAL_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = io(WS_URL ?? "", {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2_000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      stopPolling();
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      startPolling(token);
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
      startPolling(token);
    });

    socket.on("callScore", (score: CallScore) => {
      setCalls((prev) => upsertCall(prev, score));
      setLastUpdated(new Date());
    });

    socket.on("riskAlert", (alert: RiskAlert) => {
      setLatestAlert(alert);
      setLastUpdated(new Date());
    });

    return () => {
      socket.disconnect();
      stopPolling();
    };
  }, [token, startPolling, stopPolling]);

  return { calls, latestAlert, isConnected, isPolling, lastUpdated };
}
