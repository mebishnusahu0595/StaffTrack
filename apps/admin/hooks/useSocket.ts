import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth";

type SocketConfig = {
  path: string;
  url: string;
};

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

    const { url, path } = resolveSocketConfig();
    const socket = io(url, {
      auth: { token },
      withCredentials: true,
      path
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

    socket.on("task-update", (eventData) => {
      console.log("WS Task Update:", eventData);
      
      const { type, data } = eventData || {};

      if (data && (type === "update" || type === "status-update")) {
        queryClient.setQueriesData({ queryKey: ["tasks"] }, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((t: any) => (t.id === data.id ? { ...t, ...data } : t));
        });
      } else if (data && type === "create") {
        queryClient.setQueriesData({ queryKey: ["tasks"] }, (old: any) => {
          if (!Array.isArray(old)) return [data];
          if (old.some((t: any) => t.id === data.id)) {
            return old.map((t: any) => (t.id === data.id ? { ...t, ...data } : t));
          }
          return [data, ...old];
        });
      } else if (data && type === "delete" && data.id) {
        queryClient.setQueriesData({ queryKey: ["tasks"] }, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.filter((t: any) => t.id !== data.id);
        });
      } else if (data && type === "bulk-delete" && Array.isArray(data.ids)) {
        queryClient.setQueriesData({ queryKey: ["tasks"] }, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.filter((t: any) => !data.ids.includes(t.id));
        });
      } else if (type === "delete-all") {
        queryClient.setQueriesData({ queryKey: ["tasks"] }, []);
      }

      void queryClient.invalidateQueries({ queryKey: ["tasks"], refetchType: "all" });
      void queryClient.refetchQueries({ queryKey: ["tasks"] });
    });

    socket.on("location-update", (data) => {
      console.log("WS Location Update:", data);
      // Refresh the live map pings for this user...
      void queryClient.invalidateQueries({ queryKey: ["location", data.userId] });
      // ...and the employee list itself, since each ping also updates the
      // user's isLocationOn flag and batteryLevel on the backend. Without this
      // the online dot and battery % stay frozen at whatever they were on load.
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    });

    socket.on("LOCATION_OFF_EVENT", (data) => {
      console.log("WS Location Off Event:", data);
      if (typeof window !== "undefined") {
        const event = new CustomEvent("location-off-alert", { detail: data });
        window.dispatchEvent(event);
      }
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

function resolveSocketConfig(): SocketConfig {
  const explicitSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (explicitSocketUrl) {
    return splitSocketUrl(explicitSocketUrl);
  }

  if (typeof window !== "undefined") {
    return {
      url: window.location.origin,
      path: "/socket.io"
    };
  }

  const fallbackUrl =
    process.env.NEXT_PUBLIC_API_TARGET ??
    process.env.API_BASE_URL ??
    "https://stafftrack.cloud";

  return splitSocketUrl(fallbackUrl);
}

function splitSocketUrl(rawUrl: string): SocketConfig {
  const trimmed = rawUrl.trim();
  const normalized = trimmed.replace(/\/+$/, "");
  const withoutApi = normalized.replace(/\/api$/, "");

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    const basePath = pathname.endsWith("/api") ? pathname.slice(0, -4) : pathname;

    return {
      url: `${parsed.origin}${basePath}`,
      path: `${basePath || ""}/socket.io`
    };
  } catch {
    return {
      url: withoutApi,
      path: "/socket.io"
    };
  }
}
