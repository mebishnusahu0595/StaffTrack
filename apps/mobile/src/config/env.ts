import Constants from "expo-constants";
import { Platform } from "react-native";

type ExtraConfig = {
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? {}) as ExtraConfig;

const getApiBaseUrl = () => {
  return "http://160.250.205.122:3001";
};

export const API_BASE_URL = getApiBaseUrl();
