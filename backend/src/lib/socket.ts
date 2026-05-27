import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { allowedOrigins } from "./cors";

let io: SocketIOServer | null = null;

export function initSocket(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });


  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error("Authentication error: Server configuration issue"));
      }
      
      jwt.verify(token, secret);
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join-company", (companyId: string) => {
      console.log(`Socket ${socket.id} joined company: ${companyId}`);
      void socket.join(`company:${companyId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    // Return a dummy object if IO is not initialized to prevent crashes
    // but log a warning.
    console.warn("Socket.io not initialized!");
    return {
      to: () => ({
        emit: () => {}
      }),
      emit: () => {}
    } as unknown as SocketIOServer;
  }
  return io;
}

export const SOCKET_EVENTS = {
  ATTENDANCE_UPDATE: "attendance-update",
  TASK_UPDATE: "task-update",
  LOCATION_UPDATE: "location-update",
  EXPENSE_UPDATE: "expense-update"
} as const;
