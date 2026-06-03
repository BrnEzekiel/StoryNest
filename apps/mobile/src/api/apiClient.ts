import axios from "axios";
import { Platform } from "react-native";
import { Storage } from "../utils/Storage";

// --- ENVIRONMENT CONFIG ---
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
console.log("[API Client] Base URL:", BASE_URL);

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // 15 seconds
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to add access token to requests
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await Storage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.log("[API Client] Token fetch failed:", e.message);
  }
  return config;
});

// Interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
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
