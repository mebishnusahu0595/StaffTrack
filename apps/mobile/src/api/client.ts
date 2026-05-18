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
  timeout: 60000
});

let unauthorizedHandler: (() => void) | undefined;
let refreshPromise: Promise<string | null> | null = null;

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
      originalRequest.url?.includes("/api/auth/login") ||
      originalRequest.url?.includes("/api/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const token = await refreshAccessToken();

    if (!token) {
      await clearAuthStorage();
      unauthorizedHandler?.();
      return Promise.reject(error);
    }

    originalRequest.headers = AxiosHeaders.from(originalRequest.headers);
    originalRequest.headers.set("Authorization", `Bearer ${token}`);
    return api(originalRequest);
  }
);

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<ApiEnvelope<RefreshResponse>>(
      `${API_BASE_URL}/api/auth/refresh`,
      { refreshToken },
      { timeout: 20000 }
    );
    const token = response.data.data?.accessToken;

    if (!token) {
      return null;
    }

    await setAccessToken(token);
    return token;
  } catch {
    return null;
  }
}
