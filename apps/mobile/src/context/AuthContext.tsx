import React, { createContext, useContext, useState, useEffect } from "react";
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../api/firebaseConfig";
import apiClient from "../api/apiClient";
import { Platform } from "react-native";
import { Storage } from "../utils/Storage";
import { triggerLocalNotification } from "../utils/NotificationService";
import { Audio } from 'expo-av';

interface User {
  id: string;
  email: string;
  username: string;
  role: "READER" | "ADMIN";
  avatarUrl?: string | null;
  totalReadTime?: number;
  streakCount?: number;
  notificationsOn?: boolean;
  isPremium?: boolean;
  coins?: number;
  readerTheme?: string;
  readerFontSize?: string;
  todayReadTime?: number;
  dailyGoalMinutes?: number;
  xp?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hasUnreadMessages: boolean;
  setHasUnreadMessages: (val: boolean) => void;
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
  hasUnreadMessages: false,
  setHasUnreadMessages: () => {},
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
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(0);

  // --- PERSISTENCE LOGIC ---
  useEffect(() => {
    restoreSession();
  }, []);

  // --- NOTIFICATION POLLING ---
  useEffect(() => {
      let interval: any;
      if (user) {
          checkNewMessages();
          interval = setInterval(checkNewMessages, 15000); // Check every 15s
      }
      return () => clearInterval(interval);
  }, [user]);

  const playNotificationSound = async () => {
      try {
          const { sound } = await Audio.Sound.createAsync(
              require("../../assets/notification.wav")
          );
          await sound.playAsync();
      } catch (e) {
          console.log("[Auth] Audio play failed:", (e as any)?.message || e);
      }
  };

  const checkNewMessages = async () => {
      try {
          const res = await apiClient.get("/messages/conversations");
          const totalMsgs = res.data.length;
          
          if (totalMsgs > lastMessageCount && lastMessageCount !== 0) {
              setHasUnreadMessages(true);
              triggerLocalNotification("StoryNest", "You have new messages waiting in the nest!");
              playNotificationSound();
          }
          setLastMessageCount(totalMsgs);
      } catch (e) {}
  };

  const restoreSession = async () => {
    console.log("[Auth] restoreSession started...");
    try {
      console.log("[Auth] Checking for accessToken in storage...");
      const accessToken = await Storage.getItem("accessToken");
      console.log("[Auth] Access token found:", accessToken ? "YES" : "NO");
      
      if (accessToken) {
        console.log("[Auth] Verifying session with backend...");
        const res = await apiClient.get("/users/me");
        console.log("[Auth] Session verified, user:", res.data?.username);
        setUser(res.data);
      } else {
        console.log("[Auth] No active session found.");
      }
    } catch (err: any) {
      console.log("[Auth] Session restoration failed/expired:", err.message);
    } finally {
      console.log("[Auth] restoreSession finished, setting loading to false.");
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    console.log(`[Auth] Attempting login for ${email}...`);
    try {
        let idToken = null;
        try {
            console.log(`[Auth] STEP 1: Trying Firebase Sign-In (5s timeout)...`);
            const firebaseAuthPromise = signInWithEmailAndPassword(auth, email, password);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase Timeout")), 5000));
            const { user: firebaseUser } = await Promise.race([firebaseAuthPromise, timeoutPromise]) as any;
            console.log(`[Auth] Firebase User authenticated: ${firebaseUser.uid}`);
            idToken = await firebaseUser.getIdToken();
        } catch (firebaseErr: any) {
            console.log(`[Auth] Firebase sign-in skipped/failed: ${firebaseErr.message}`);
        }
        
        console.log(`[Auth] STEP 2: Backend Authentication...`);
        const res = await apiClient.post("/auth/login", idToken ? { idToken } : { email, password });
        console.log(`[Auth] Backend Login Success`);
        
        const { user: backendUser, accessToken, refreshToken } = res.data;
        await Storage.setItem("accessToken", accessToken);
        await Storage.setItem("refreshToken", refreshToken);
        setUser(backendUser);
    } catch (err: any) {
        console.error(`[Auth] Login Failed:`, err.message || err);
        throw err;
    }
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
    try {
        let firebaseUid = "";
        try {
            // 1. Create Firebase User
            console.log(`[Auth] STEP 1: Creating Firebase user for ${data.email}...`);
            const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, data.email, data.password);
            firebaseUid = firebaseUser.uid;
            console.log(`[Auth] Firebase User Created: ${firebaseUid}`);
        } catch (firebaseErr: any) {
            // If user already exists in Firebase, just sign in to get the UID
            if (firebaseErr.code === 'auth/email-already-in-use') {
                console.log(`[Auth] Firebase user already exists, signing in...`);
                const { user: firebaseUser } = await signInWithEmailAndPassword(auth, data.email, data.password);
                firebaseUid = firebaseUser.uid;
            } else {
                throw firebaseErr;
            }
        }
        
        // 2. Complete Backend Registration
        console.log(`[Auth] STEP 2: Completing backend registration...`);
        const res = await apiClient.post("/auth/register", {
            ...data,
            firebaseUid
        });
        console.log(`[Auth] Backend Registration Success`);

        const { user: backendUser, accessToken, refreshToken } = res.data;
        await Storage.setItem("accessToken", accessToken);
        await Storage.setItem("refreshToken", refreshToken);
        setUser(backendUser);
    } catch (err: any) {
        console.log("[Auth] Finalization error details:", {
            message: err.message,
            code: err.code,
            response: err.response?.data
        });
        throw err;
    }
  };

  const forgotPassword = async (email: string) => {
    await apiClient.post("/auth/password/forgot", { email });
  };

  const resetPassword = async (data: any) => {
    await apiClient.post("/auth/password/reset", data);
  };

  const logout = async () => {
    try {
        await apiClient.post("/auth/logout");
    } catch (e) {
        console.log("[Auth] Backend logout notification failed (token likely already gone)");
    }
    await signOut(auth);
    await Storage.removeItem("accessToken");
    await Storage.removeItem("refreshToken");
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      console.log("[Auth] Refreshing user data from backend...");
      const res = await apiClient.get("/users/me");
      setUser(res.data);
      console.log("[Auth] User data refreshed:", res.data.username);
    } catch (e: any) {
      console.log("[Auth] Refresh failed:", e.message);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, hasUnreadMessages, setHasUnreadMessages, 
      login, loginWithGoogle, logout, refreshUser,
      initiateRegistration, verifyOTP, finalizeRegistration,
      forgotPassword, resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
