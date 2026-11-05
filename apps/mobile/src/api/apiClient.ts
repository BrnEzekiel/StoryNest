import axios from "axios";
import { Platform } from "react-native";
import { Storage } from "../utils/Storage";
import { isDefinitiveRefreshFailure, markInconclusive } from "../utils/session";
import Constants from "expo-constants";

/** Production API (Render): https://storynest-qzwm.onrender.com */
const PRODUCTION_API = "https://storynest-qzwm.onrender.com";

function resolveBaseUrl(): string {
  // 1. Standard Expo env (Expo Go, dev clients, EAS secrets).
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }
  // 2. Gradle-baked URL (Gradle never forwards shell env to Metro, so the
  //    bundle task bakes scripts/write-build-env.js output through this file).
  try {
    const generated = require("./buildEnv").BUILD_API_URL as string | undefined;
    if (generated) return generated.replace(/\/$/, "");
  } catch {}
  const extra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (extra) return extra.replace(/\/$/, "");

  if (__DEV__) {
    return Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";
  }
  return PRODUCTION_API;
}

export const BASE_URL = resolveBaseUrl();
console.log("[API Client] Base URL:", BASE_URL);

const apiClient = axios.create({
  baseURL: BASE_URL,
  // Fail fast so screens fall back to cached data instead of hanging;
  // slow operations (uploads, translation) pass their own longer timeout.
  timeout: 20000,
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

    // Surface server rate-limit backoff to callers (screens show a friendly note).
    if (error.response?.status === 429) {
      const header = error.response.headers?.["retry-after"];
      const secs = header ? parseInt(Array.isArray(header) ? header[0] : header, 10) : NaN;
      error.retryAfterMs = Number.isFinite(secs) ? secs * 1000 : 60_000;
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = await Storage.getItem("refreshToken");
      if (!refreshToken) {
        // Nothing to recover with: the session is definitively dead.
        await Storage.removeItem("accessToken");
        return Promise.reject(error);
      }
      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = res.data;

        await Storage.setItem("accessToken", accessToken);
        await Storage.setItem("refreshToken", newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (err: any) {
        // Only wipe the session when the server definitively rejects the
        // refresh token. Anything else (timeout, offline, sleepy server)
        // keeps the tokens AND flags the surfaced 401 as inconclusive, so
        // the auth gate keeps the local snapshot instead of signing out.
        if (isDefinitiveRefreshFailure(err)) {
          await Storage.removeItem("accessToken");
          await Storage.removeItem("refreshToken");
        } else {
          markInconclusive(error);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
