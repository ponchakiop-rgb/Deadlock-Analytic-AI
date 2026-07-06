"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

let globalSocket: Socket | null = null;

export function useSocket() {
  const [socketId, setSocketId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io({
        path: "/api/socketio",
        transports: ["polling", "websocket"],
      });
    }

    socketRef.current = globalSocket;

    const onConnect = () => {
      setConnected(true);
      setSocketId(globalSocket?.id ?? null);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    if (globalSocket.connected) {
      setConnected(true);
      setSocketId(globalSocket.id ?? null);
    }

    globalSocket.on("connect", onConnect);
    globalSocket.on("disconnect", onDisconnect);

    return () => {
      globalSocket?.off("connect", onConnect);
      globalSocket?.off("disconnect", onDisconnect);
    };
  }, []);

  return { socket: socketRef.current ?? globalSocket, socketId, connected };
}
