import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// --- DEPLOYMENT CONFIG ---
// Live URL (Render/Firebase):
const LIVE_URL = "https://us-central1-storynest-12345.cloudfunctions.net/api";

// Local Development URL:
const MACHINE_IP = "192.168.100.5"; 
const LOCAL_URL = Platform.OS === "android" ? `http://${MACHINE_IP}:5000` : `http://localhost:5000`;

// POINTING TO LOCAL FOR NOW SO THE BROWSER WORKS
const BASE_URL = LOCAL_URL; 

console.log(`[API] Targeting Backend at: ${BASE_URL}`);

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, 
});

apiClient.interceptors.request.use(async (config) => {
  console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
  
  // SecureStore doesn't work on Web by default, fallback to localStorage
  let token;
  if (Platform.OS === 'web') {
    token = localStorage.getItem("accessToken");
  } else {
    token = await SecureStore.getItemAsync("accessToken");
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        let refreshToken;
        if (Platform.OS === 'web') {
          refreshToken = localStorage.getItem("refreshToken");
        } else {
          refreshToken = await SecureStore.getItemAsync("refreshToken");
        }

        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = res.data;
        
        if (Platform.OS === 'web') {
          localStorage.setItem("accessToken", accessToken);
          localStorage.setItem("refreshToken", newRefreshToken);
        } else {
          await SecureStore.setItemAsync("accessToken", accessToken);
          await SecureStore.setItemAsync("refreshToken", newRefreshToken);
        }
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (err) {
        if (Platform.OS === 'web') {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
        } else {
          await SecureStore.deleteItemAsync("accessToken");
          await SecureStore.deleteItemAsync("refreshToken");
        }
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
