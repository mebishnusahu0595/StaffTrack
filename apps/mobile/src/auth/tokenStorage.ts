import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { User } from "../api";

const ACCESS_TOKEN_KEY = "stafftrack.accessToken";
const REFRESH_TOKEN_KEY = "stafftrack.refreshToken";
const USER_KEY = "stafftrack.user";

export async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return readWebStorage(ACCESS_TOKEN_KEY);
  }

  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    writeWebStorage(ACCESS_TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return readWebStorage(REFRESH_TOKEN_KEY);
  }

  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  if (Platform.OS === "web") {
    writeWebStorage(ACCESS_TOKEN_KEY, accessToken);
    writeWebStorage(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function storeUser(user: User): Promise<void> {
  if (Platform.OS === "web") {
    writeWebStorage(USER_KEY, JSON.stringify(user));
    return;
  }

  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser(): Promise<User | null> {
  if (Platform.OS === "web") {
    return parseStoredUser(readWebStorage(USER_KEY));
  }

  const value = await SecureStore.getItemAsync(USER_KEY);

  return parseStoredUser(value);
}

export async function clearAuthStorage(): Promise<void> {
  if (Platform.OS === "web") {
    deleteWebStorage(ACCESS_TOKEN_KEY);
    deleteWebStorage(REFRESH_TOKEN_KEY);
    deleteWebStorage(USER_KEY);
    return;
  }

  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY)
  ]);
}

function parseStoredUser(value: string | null): User | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as User;
  } catch {
    return null;
  }
}

function readWebStorage(key: string): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(key);
}

function writeWebStorage(key: string, value: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, value);
  }
}

function deleteWebStorage(key: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }
}
