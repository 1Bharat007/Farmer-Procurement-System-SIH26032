/**
 * Resilient WebSocket Hook for Live Queue Updates with Exponential Backoff & REST Resync.
 * Smart India Hackathon 2026 - Problem Statement 26032
 */

import * as React from "react";

export type WebSocketStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

interface UseQueueWebSocketOptions {
  centreId?: number | string | null;
  onMessage?: (data: any) => void;
  onResync?: () => Promise<void> | void;
  enabled?: boolean;
}

export function useQueueWebSocket({
  centreId,
  onMessage,
  onResync,
  enabled = true,
}: UseQueueWebSocketOptions) {
  const [status, setStatus] = React.useState<WebSocketStatus>("disconnected");
  const [reconnectAttempts, setReconnectAttempts] = React.useState(0);

  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isExplicitCloseRef = React.useRef(false);
  const hadConnectedRef = React.useRef(false);

  // Keep references to latest callbacks to avoid stale closures
  const onMessageRef = React.useRef(onMessage);
  onMessageRef.current = onMessage;
  const onResyncRef = React.useRef(onResync);
  onResyncRef.current = onResync;

  const connect = React.useCallback(() => {
    if (!centreId || !enabled || typeof window === "undefined") {
      setStatus("disconnected");
      return;
    }

    // Determine WebSocket endpoint
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const defaultHost = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host;
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    let wsHost = defaultHost;

    if (rawApiUrl) {
      try {
        const parsed = new URL(rawApiUrl);
        wsHost = parsed.host;
      } catch {
        wsHost = defaultHost;
      }
    }

    const wsUrl = `${protocol}//${wsHost}/ws/queue/${centreId}/`;

    setStatus((prev) => (hadConnectedRef.current ? "reconnecting" : "connecting"));
    isExplicitCloseRef.current = false;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setStatus("connected");
        setReconnectAttempts(0);

        // If we were previously connected and just reconnected, trigger REST state resync
        if (hadConnectedRef.current && onResyncRef.current) {
          try {
            onResyncRef.current();
          } catch (e) {
            console.warn("[WS RESYNC ERROR]", e);
          }
        }
        hadConnectedRef.current = true;

        // Periodic heartbeat ping to keep connection warm across venue Wi-Fi NATs
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "pong") return;
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch {
          // Ignore non-JSON or ping responses
        }
      };

      socket.onerror = (err) => {
        console.warn("[WS ERROR] Socket encountered an error:", err);
      };

      socket.onclose = (event) => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (isExplicitCloseRef.current) {
          setStatus("disconnected");
          return;
        }

        setStatus("reconnecting");
        setReconnectAttempts((prev) => {
          const nextAttempt = prev + 1;
          // Exponential backoff: 1s -> 1.5s -> 2.25s -> max 30s
          const delay = Math.min(1000 * Math.pow(1.5, prev), 30000);

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);

          return nextAttempt;
        });
      };
    } catch (err) {
      console.warn("[WS CONNECTION INIT ERROR]", err);
      setStatus("disconnected");
    }
  }, [centreId, enabled]);

  React.useEffect(() => {
    hadConnectedRef.current = false;
    connect();

    return () => {
      isExplicitCloseRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("disconnected");
    };
  }, [connect]);

  const manualResync = React.useCallback(() => {
    if (onResyncRef.current) {
      onResyncRef.current();
    }
  }, []);

  return {
    status,
    isConnected: status === "connected",
    isReconnecting: status === "reconnecting",
    reconnectAttempts,
    manualResync,
  };
}
