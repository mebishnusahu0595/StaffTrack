import Constants from "expo-constants";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

type ExtraConfig = {
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? {}) as ExtraConfig;
const DEFAULT_API_BASE_URL = "https://stafftrack.cloud";

const getApiBaseUrl = () => {
  const configuredUrl =
    getEnv("EXPO_PUBLIC_API_BASE_URL") ?? getEnv("API_BASE_URL") ?? extra.apiBaseUrl ?? DEFAULT_API_BASE_URL;

  return normalizeApiOrigin(configuredUrl);
};

function getEnv(name: string) {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

function normalizeApiOrigin(url: string) {
  return url.trim().replace(/\/+$/, "").replace(/\/api$/, "");
}

export const API_BASE_URL = getApiBaseUrl();
