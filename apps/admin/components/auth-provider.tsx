"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { login as loginRequest, logout as logoutRequest } from "@/lib/api";
import { canAccessDashboard, getAccessToken, getSessionUserFromToken, getStoredUser } from "@/lib/auth";
import { ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE } from "@/lib/constants";
import type { LoginResponse, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  signIn: (input: { email: string; password: string }) => Promise<LoginResponse>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser
}: {
  children: React.ReactNode;
  initialUser: User | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(initialUser);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const cookieUser = getStoredUser() ?? getSessionUserFromToken(getAccessToken());
    setUser(cookieUser ?? initialUser);
    setIsBootstrapping(false);
  }, [initialUser]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    if (!canAccessDashboard(user) && pathname !== "/login" && pathname !== "/superadmin") {
      const redirectPath = pathname.startsWith("/superadmin") ? "/superadmin" : "/login";
      router.replace(redirectPath);
      return;
    }

    if (canAccessDashboard(user) && (pathname === "/login" || pathname === "/superadmin")) {
      if (user?.role === "SUPERADMIN") {
        router.replace("/superadmin/dashboard");
      } else {
        router.replace("/");
      }
    }
  }, [isBootstrapping, pathname, router, user]);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      const session = await loginRequest(input);

      setUser(session.user);
      if (session.user.role === "SUPERADMIN") {
        router.replace("/superadmin/dashboard");
      } else if (session.user.role === "ADMIN") {
        router.replace("/");
      } else {
        router.replace("/");
      }
      return session;
    },
    [router]
  );

  const signOut = useCallback(async () => {
    await logoutRequest().catch(() => undefined);
    
    // Clear all auth cookies
    document.cookie = `${USER_COOKIE}=; max-age=0; path=/`;
    document.cookie = `${ACCESS_COOKIE}=; max-age=0; path=/`;
    document.cookie = `${REFRESH_COOKIE}=; max-age=0; path=/`;

    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isBootstrapping,
      isAuthenticated: canAccessDashboard(user),
      signIn,
      signOut,
      setUser
    }),
    [isBootstrapping, signIn, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children as any}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
