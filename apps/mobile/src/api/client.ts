import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  setAccessToken
} from "../auth/tokenStorage";
import { API_BASE_URL } from "../config/env";

type RetriableRequest = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};

type RefreshResponse = {
  accessToken: string;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000
});

let unauthorizedHandler: (() => void) | undefined;

export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();

  if (token) {
    config.headers = AxiosHeaders.from(config.headers);
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});


api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const status = error.response?.status;
    const data = error.response?.data;

    // Extract server-side error message if available
    if (data && (data.message || data.error)) {
      error.message = data.message || data.error || error.message;
    }

    const originalRequest = error.config as RetriableRequest | undefined;

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const refreshResult = await refreshAccessToken();

    if (!refreshResult.token) {
      if (refreshResult.isOffline) {
        // Device is offline or network unreachable — do NOT log out or wipe credentials
        return Promise.reject(error);
      }

      await clearAuthStorage();
      unauthorizedHandler?.();
      return Promise.reject(error);
    }

    originalRequest.headers = AxiosHeaders.from(originalRequest.headers);
    originalRequest.headers.set("Authorization", `Bearer ${refreshResult.token}`);
    return api(originalRequest);
  }
);

type RefreshResult = {
  token: string | null;
  isOffline?: boolean;
};

let refreshPromise: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function performRefresh(): Promise<RefreshResult> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return { token: null, isOffline: false };
  }

  try {
    const response = await axios.post<ApiEnvelope<RefreshResponse>>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 20000 }
    );
    const token = response.data.data?.accessToken;

    if (!token) {
      return { token: null, isOffline: false };
    }

    await setAccessToken(token);
    return { token, isOffline: false };
  } catch (err: any) {
    const status = err.response?.status;
    const isNetworkError =
      !err.response ||
      err.code === "ERR_NETWORK" ||
      err.code === "ECONNABORTED" ||
      err.message?.toLowerCase().includes("network error") ||
      err.message?.toLowerCase().includes("timeout");

    if (isNetworkError && status !== 401 && status !== 403) {
      console.warn("[API] Token refresh skipped: device is offline or network unreachable.");
      return { token: null, isOffline: true };
    }

    return { token: null, isOffline: false };
  }
}
