"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useSocket } from "@/hooks/useSocket";

export function SocketInitializer() {
  const { user } = useAuth();
  
  // Initialize socket when user is available
  useSocket(user?.companyId);

  return null;
}
