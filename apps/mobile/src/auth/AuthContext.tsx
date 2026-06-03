import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { login as loginRequest, logout as logoutRequest, updatePushToken, fetchUserProfile, type User } from "../api";
import { setUnauthorizedHandler } from "../api/client";
import { registerForPushNotificationsAsync } from "../utils/notifications";
import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  setAuthTokens,
  storeUser
} from "./tokenStorage";


type JwtPayload = {
  sub?: string;
  role?: string;
  companyId?: string;
  companyName?: string;
  company?: {
    name?: string;
  };
  exp?: number;
  [key: string]: unknown;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  jwtPayload: JwtPayload | null;
  companyName: string | null;
};

type AuthContextValue = AuthState & {
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const initialState: AuthState = {
  user: null,
  accessToken: null,
  jwtPayload: null,
  companyName: null
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(initialState);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const applySession = useCallback((user: User, accessToken: string) => {
    const jwtPayload = decodeJwtPayload(accessToken);
    const companyName =
      readString(jwtPayload?.companyName) ??
      readString(jwtPayload?.company?.name) ??
      readString(jwtPayload?.company) ??
      readString(jwtPayload?.companyId) ??
      user.companyId;

    setState({
      user,
      accessToken,
      jwtPayload,
      companyName
    });
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();

    try {
      if (refreshToken) {
        await logoutRequest(refreshToken);
      }
    } catch {
      // Logout must clear local state even when the network request fails.
    } finally {
      await clearAuthStorage();
      setState(initialState);
      // Wipe all cached queries so the next user never sees the previous
      // user's tasks / leaves / reports / salary slips.
      queryClient.clear();
    }
  }, [queryClient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      // Drop any leftover cache from a previous session before the new one loads.
      queryClient.clear();
      const result = await loginRequest({ email, password });
      await setAuthTokens(result.accessToken, result.refreshToken);
      await storeUser(result.user);
      applySession(result.user, result.accessToken);
    },
    [applySession, queryClient]
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });

    return () => setUnauthorizedHandler(undefined);
  }, [signOut]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const [token, user] = await Promise.all([getAccessToken(), getStoredUser()]);

      if (mounted && token && user) {
        applySession(user, token);
        
        // Background refresh user profile
        try {
          const freshUser = await fetchUserProfile(user.id);
          if (mounted && freshUser) {
            await storeUser(freshUser);
            applySession(freshUser, token);
          }
        } catch (error) {
          console.warn("[AuthContext] Background user profile refresh failed:", error);
        }
      }

      if (mounted) {
        setIsBootstrapping(false);
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [applySession]);

  useEffect(() => {
    if (state.accessToken && state.user?.id) {
      const userId = state.user.id;
      void (async () => {
        try {
          const token = await registerForPushNotificationsAsync();
          if (token) {
            await updatePushToken(userId, token);
            console.log("[AuthContext] Push token updated successfully:", token);
          }
        } catch (error) {
          console.error("[AuthContext] Failed to register push token:", error);
        }
      })();
    }
  }, [state.accessToken, state.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isBootstrapping,
      isAuthenticated: Boolean(state.accessToken && state.user),
      signIn,
      signOut
    }),
    [isBootstrapping, signIn, signOut, state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const payload = token.split(".")[1];

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const input = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  let buffer = 0;
  let bits = 0;
  let output = "";

  for (const char of input) {
    const index = chars.indexOf(char);

    if (index === -1) {
      continue;
    }

    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  try {
    return decodeURIComponent(
      output
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
  } catch {
    return output;
  }
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
