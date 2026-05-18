import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth";

// In production, this should come from an environment variable
const SOCKET_URL = "http://localhost:4000";

export function useSocket(companyId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!companyId) return;

    // Connect to Socket.io with auth token
    const token = getAccessToken();
    if (!token) {
      console.log("No auth token found, skipping socket connection");
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to WebSocket");
      socket.emit("join-company", companyId);
    });

    // Handle events
    socket.on("attendance-update", (data) => {
      console.log("WS Attendance Update:", data);
      // Invalidate attendance-related queries
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    });

    socket.on("task-update", (data) => {
      console.log("WS Task Update:", data);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    });

    socket.on("location-update", (data) => {
      console.log("WS Location Update:", data);
      // Optimistically update location if we had a live map
      void queryClient.invalidateQueries({ queryKey: ["location", data.userId] });
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from WebSocket");
    });

    return () => {
      socket.disconnect();
    };
  }, [companyId, queryClient]);

  return socketRef.current;
}
