import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

import { API_ORIGIN_URL } from "../config/env";
import { getAccessToken } from "../auth/tokenStorage";
import { useAuth } from "../auth/AuthContext";

/**
 * Live updates over WebSocket (socket.io).
 *
 * While the app is open this keeps attendance/tasks in sync in real time — most
 * importantly, the moment a manager/admin approves a late check-in the backend
 * emits `attendance-update`, we invalidate the attendance queries and the work
 * timer starts straight away (no pull-to-refresh needed).
 *
 * Note: a socket only delivers while the app is running/foregrounded. Anything
 * that happened while the app was closed is still picked up on reopen by the
 * 30s attendance poll + the local-notification poller.
 */
export function useRealtime() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !user?.companyId) return;

    let socket: Socket | null = null;
    let cancelled = false;

    void (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      socket = io(API_ORIGIN_URL, {
        auth: { token },
        transports: ["websocket"],
        path: "/socket.io"
      });

      socket.on("connect", () => {
        socket?.emit("join-company", user.companyId);
      });

      socket.on("attendance-update", () => {
        void queryClient.invalidateQueries({ queryKey: ["attendance"] });
        void queryClient.invalidateQueries({ queryKey: ["managerAttendanceByDate"] });
        void queryClient.invalidateQueries({ queryKey: ["managerPendingLateCheckIns"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      });

      socket.on("task-update", () => {
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      });
    })();

    return () => {
      cancelled = true;
      if (socket) socket.disconnect();
    };
  }, [isAuthenticated, user?.companyId, queryClient]);
}
