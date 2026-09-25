import axios from "axios";
import { Platform } from "react-native";
import { Storage } from "../utils/Storage";
import Constants from "expo-constants";

/**
 * Production API: https://storynest.onrender.com
 * Override at build time with EXPO_PUBLIC_API_URL if needed.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv && !fromEnv.includes("localhost") && !fromEnv.includes("127.0.0.1")) {
    return fromEnv;
  }
  const extra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (extra) return extra.replace(/\/$/, "");

  if (__DEV__) {
    return Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";
  }
  return "https://storynest.onrender.com";
}

export const BASE_URL = resolveBaseUrl();
console.log("[API Client] Base URL:", BASE_URL);

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 45000, // Render free tier can cold-start slowly
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
