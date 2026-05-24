import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../api/firebaseConfig";
import apiClient from "../api/apiClient";
import { Alert, Platform } from "react-native";

// Universal Storage Helper (Native SecureStore vs Browser LocalStorage)
const Storage = {
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }
};

interface User {
  id: string;
  email: string;
  username: string;
  role: "READER" | "ADMIN";
  avatarUrl?: string;
  totalReadTime?: number;
  streakCount?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only subscribe to auth changes if auth is initialized
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await syncWithBackend();
      } else {
        setUser(null);
        await Storage.removeItem("accessToken");
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const syncWithBackend = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;

      const res = await apiClient.post("/auth/firebase", { idToken });
      const { user: backendUser, accessToken, refreshToken } = res.data;
      
      await Storage.setItem("accessToken", accessToken);
      await Storage.setItem("refreshToken", refreshToken);
      setUser(backendUser);
    } catch (e) {
      // Quiet fail to avoid infinite loops, rely on global handler
    }
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, username: string) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
    const res = await apiClient.post("/auth/register", { 
      email, 
      password, 
      username,
      firebaseUid: firebaseUser.uid 
    });
    
    const { user: backendUser, accessToken, refreshToken } = res.data;
    await Storage.setItem("accessToken", accessToken);
    await Storage.setItem("refreshToken", refreshToken);
    setUser(backendUser);
  };

  const loginWithGoogle = async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
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
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
