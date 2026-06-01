import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../api/firebaseConfig";
import apiClient from "../api/apiClient";
import { Platform } from "react-native";

const Storage = {
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    else return await SecureStore.getItemAsync(key);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  }
};

interface User {
  id: string;
  email: string;
  username: string;
  role: "READER" | "ADMIN";
  avatarUrl?: string | null;
  totalReadTime?: number;
  streakCount?: number;
  notificationsOn?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  
  // v2.0 Methods
  initiateRegistration: (email: string, dob: Date) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  finalizeRegistration: (data: any) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, 
  loading: true, 
  login: async () => {}, 
  loginWithGoogle: async () => {},
  logout: async () => {}, 
  refreshUser: async () => {},
  initiateRegistration: async () => {},
  verifyOTP: async () => {},
  finalizeRegistration: async () => {},
  forgotPassword: async () => {},
  resetPassword: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // --- PERSISTENCE LOGIC ---
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const accessToken = await Storage.getItem("accessToken");
      if (accessToken) {
        // Try to fetch current user to verify token
        const res = await apiClient.get("/users/me");
        setUser(res.data);
      }
    } catch (err) {
      console.log("[Auth] Session restoration failed, token likely expired.");
      // Token might be expired, apiClient interceptor will try to refresh it
      // if it fails there, user remains null and must log in.
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await firebaseUser.getIdToken();
    const res = await apiClient.post("/auth/login", { idToken });
    
    const { user: backendUser, accessToken, refreshToken } = res.data;
    await Storage.setItem("accessToken", accessToken);
    await Storage.setItem("refreshToken", refreshToken);
    setUser(backendUser);
  };

  const loginWithGoogle = async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const { user: firebaseUser } = await signInWithCredential(auth, credential);
    const firebaseIdToken = await firebaseUser.getIdToken();
    const res = await apiClient.post("/auth/login", { idToken: firebaseIdToken });
    
    const { user: backendUser, accessToken, refreshToken } = res.data;
    await Storage.setItem("accessToken", accessToken);
    await Storage.setItem("refreshToken", refreshToken);
    setUser(backendUser);
  };

  const initiateRegistration = async (email: string, dob: Date) => {
    await apiClient.post("/auth/otp/initiate", { email, dob: dob.toISOString() });
  };

  const verifyOTP = async (email: string, otp: string) => {
    await apiClient.post("/auth/otp/verify", { email, otp });
  };

  const finalizeRegistration = async (data: any) => {
    // 1. Create Firebase User
    const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, data.email, data.password);
    
    // 2. Complete Backend Registration
    const res = await apiClient.post("/auth/register", {
        ...data,
        firebaseUid: firebaseUser.uid
    });

    const { user: backendUser, accessToken, refreshToken } = res.data;
    await Storage.setItem("accessToken", accessToken);
    await Storage.setItem("refreshToken", refreshToken);
    setUser(backendUser);
  };

  const forgotPassword = async (email: string) => {
    await apiClient.post("/auth/password/forgot", { email });
  };

  const resetPassword = async (data: any) => {
    await apiClient.post("/auth/password/reset", data);
  };

  const logout = async () => {
    await signOut(auth);
    await Storage.removeItem("accessToken");
    await Storage.removeItem("refreshToken");
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await apiClient.get("/users/me");
      setUser(res.data);
    } catch (e) {}
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, login, loginWithGoogle, logout, refreshUser,
      initiateRegistration, verifyOTP, finalizeRegistration,
      forgotPassword, resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
