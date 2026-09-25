import axios from "axios";
import { Platform } from "react-native";
import { Storage } from "../utils/Storage";
import Constants from "expo-constants";

/**
 * Production APK must set EXPO_PUBLIC_API_URL at build time (EAS env).
 * localhost only works on emulators, never on a real phone.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv && !fromEnv.includes("localhost") && !fromEnv.includes("127.0.0.1")) {
    return fromEnv;
  }
  // Extra / app.json config if present
  const extra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (extra) return extra.replace(/\/$/, "");

  // Dev fallback only
  if (__DEV__) {
    return Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";
  }
  // Release without env: still prefer a non-crash path; login will show network errors
  return fromEnv || "https://api.storynest.app";
}

export const BASE_URL = resolveBaseUrl();
console.log("[API Client] Base URL:", BASE_URL);

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await Storage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.log("[API Client] Token fetch failed:", (e as any).message);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await Storage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = res.data;

        await Storage.setItem("accessToken", accessToken);
        await Storage.setItem("refreshToken", newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (err) {
        await Storage.removeItem("accessToken");
        await Storage.removeItem("refreshToken");
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
