import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../api/firebaseConfig";
import apiClient from "../api/apiClient";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Storage } from "../utils/Storage";
import { triggerLocalNotification } from "../utils/NotificationService";
import { resetLimits } from "../utils/rateLimit";
import { shouldSignOutOnRestoreError } from "../utils/session";
import { warmupServer } from "../utils/warmup";
import { ensureChatKeys } from "../utils/crypto";
import { withTimeout } from "../utils/promise";
import { Audio } from 'expo-av';

const USER_SNAPSHOT_KEY = "@sn_auth_user";

interface User {
  id: string;
  email: string;
  username: string;
  role: "READER" | "WRITER" | "ADMIN";
  avatarUrl?: string | null;
  totalReadTime?: number;
  streakCount?: number;
  notificationsOn?: boolean;
  discoverable?: boolean;
  publicKey?: string | null;
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
  /** Instant local update (e.g. avatar) + persisted snapshot. */
  updateUser: (patch: Partial<User>) => Promise<void>;
  /** Null on success, human-readable error otherwise. */
  upgradeToWriter: () => Promise<string | null>;

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
  updateUser: async () => {},
  upgradeToWriter: async () => "Not signed in.",
  initiateRegistration: async () => {},
  verifyOTP: async () => {},
  finalizeRegistration: async () => {},
  forgotPassword: async () => {},
  resetPassword: async () => {},
});

const persistSnapshot = async (u: User | null) => {
  try {
    if (u) await AsyncStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(USER_SNAPSHOT_KEY);
  } catch {}
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  // Id of the newest message seen by the poller. A ref (not state): the
  // 15s interval would otherwise keep comparing against a stale snapshot.
  const lastSeenMessageIdRef = useRef<string | null>(null);
  // Synchronous mirror of the user for persistence: setState updaters run
  // at render time (not inside the setState call), so persistence must
  // never read values computed inside an updater.
  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
          console.log("[Auth] Audio play failed:", (e as any).message);
      }
  };

  const checkNewMessages = async () => {
      try {
          const res = await apiClient.get("/messages/conversations");
          const convos = Array.isArray(res.data) ? res.data : [];
          // Newest message across every conversation: a reply inside an
          // old chat must notify too (the old conversation count never did).
          let newest: any = null;
          for (const c of convos) {
              const lm = c?.lastMessage;
              if (!lm?.id) continue;
              if (!newest || new Date(lm.createdAt).getTime() > new Date(newest.createdAt).getTime()) newest = lm;
          }
          if (!newest) return;
          const myId = userRef.current?.id;
          if (lastSeenMessageIdRef.current === null) {
              // Baseline: adopt history silently, but light the badge when
              // unread mail from others is already waiting.
              lastSeenMessageIdRef.current = newest.id;
              if (convos.some((c: any) => c?.lastMessage && !c.lastMessage.isRead && c.lastMessage.senderId !== myId)) {
                  setHasUnreadMessages(true);
              }
              return;
          }
          if (newest.id !== lastSeenMessageIdRef.current) {
              lastSeenMessageIdRef.current = newest.id;
              if (newest.senderId !== myId) {
                  setHasUnreadMessages(true);
                  triggerLocalNotification("StoryNest", "You have new messages waiting in the nest!");
                  playNotificationSound();
              }
          }
      } catch (e) {}
  };

  const restoreSession = async () => {
    console.log("[Auth] restoreSession started...");
    // Wake a sleeping backend while the app boots (fire-and-forget).
    warmupServer();
    try {
      // 1. Instant paint from the locally saved snapshot — the app opens
      // signed-in immediately, even on a cold backend or flaky network.
      const [snapshotRaw, accessToken] = await Promise.all([
        AsyncStorage.getItem(USER_SNAPSHOT_KEY),
        Storage.getItem("accessToken"),
      ]);
      if (snapshotRaw) {
        try {
          setUser(JSON.parse(snapshotRaw));
          console.log("[Auth] Restored user from local snapshot.");
        } catch {}
      }
      setLoading(false);

      // 2. Silent background revalidation (never blocks the UI).
      if (accessToken) {
        try {
          const res = await apiClient.get("/users/me");
          setUser(res.data);
          persistSnapshot(res.data);
          ensureChatKeys(res.data?.id, res.data?.publicKey).catch(() => {});
          console.log("[Auth] Session verified, user:", res.data?.username);
        } catch (err: any) {
          // Definitive rejection => session is truly dead, sign out.
          // Anything else (timeout, sleepy server, inconclusive refresh)
          // => keep the snapshot.
          if (shouldSignOutOnRestoreError(err)) {
            console.log("[Auth] Session rejected by server, signing out.");
            await Storage.removeItem("accessToken");
            await Storage.removeItem("refreshToken");
            await persistSnapshot(null);
            setUser(null);
          } else {
            console.log("[Auth] Background revalidation failed, keeping local session:", err.message);
          }
        }
      } else if (!snapshotRaw) {
        console.log("[Auth] No active session found.");
      }
    } catch (err: any) {
      console.log("[Auth] Session restoration failed:", err.message);
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    console.log(`[Auth] Attempting login for ${email}...`);
    try {
        console.log(`[Auth] Direct backend authentication...`);
        const res = await apiClient.post("/auth/login", { email, password });
        console.log(`[Auth] Backend Login Success`);

        const { user: backendUser, accessToken, refreshToken } = res.data;
        await Storage.setItem("accessToken", accessToken);
        await Storage.setItem("refreshToken", refreshToken);
        await persistSnapshot(backendUser);
        setUser(backendUser);
        // Chat keys: create once, publish the public half (never blocks login).
        ensureChatKeys(backendUser.id, backendUser.publicKey).catch(() => {});
    } catch (err: any) {
        console.error(`[Auth] Login Failed:`, err.message || err);
        throw err;
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    throw new Error("Google Sign-In is temporarily disabled.");
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
            // 1. Create Firebase User (bounded: a stalled network must surface
            //    an error, never freeze the UI on "VERIFIED! ENTERING NEST").
            console.log(`[Auth] STEP 1: Creating Firebase user for ${data.email}...`);
            const { user: firebaseUser } = await withTimeout(
                createUserWithEmailAndPassword(auth, data.email, data.password),
                25000,
                "Firebase signup took too long"
            );
            firebaseUid = firebaseUser.uid;
            console.log(`[Auth] Firebase User Created: ${firebaseUid}`);
        } catch (firebaseErr: any) {
            // If user already exists in Firebase, just sign in to get the UID
            if (firebaseErr.code === 'auth/email-already-in-use') {
                console.log(`[Auth] Firebase user already exists, signing in...`);
                const { user: firebaseUser } = await withTimeout(
                    signInWithEmailAndPassword(auth, data.email, data.password),
                    25000,
                    "Firebase sign-in took too long"
                );
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
        await persistSnapshot(backendUser);
        setUser(backendUser);
        ensureChatKeys(backendUser.id, backendUser.publicKey).catch(() => {});
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
    await persistSnapshot(null);
    resetLimits();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      console.log("[Auth] Refreshing user data from backend...");
      const res = await apiClient.get("/users/me");
      setUser(res.data);
      persistSnapshot(res.data);
      console.log("[Auth] User data refreshed:", res.data.username);
    } catch (e: any) {
      console.log("[Auth] Refresh failed:", e.message);
    }
  };

  const updateUser = async (patch: Partial<User>) => {
    const prev = userRef.current;
    const next: User = prev ? { ...prev, ...patch } : (patch as User);
    userRef.current = next;
    setUser(next);
    await persistSnapshot(next);
  };

  // Readers can promote themselves to writers (never to admin: the server
  // enforces that). Fresh tokens carry the new role immediately.
  const upgradeToWriter = async (): Promise<string | null> => {
    try {
      const res = await apiClient.post("/users/me/role", { role: "WRITER" });
      const { user: updated, accessToken, refreshToken } = res.data;
      if (accessToken) await Storage.setItem("accessToken", accessToken);
      if (refreshToken) await Storage.setItem("refreshToken", refreshToken);
      setUser({ ...updated, token: accessToken });
      userRef.current = { ...updated, token: accessToken };
      await persistSnapshot({ ...updated, token: accessToken });
      return null;
    } catch (e: any) {
      return e?.response?.data?.error || "Could not upgrade your account. Check your connection and try again.";
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading, hasUnreadMessages, setHasUnreadMessages,
      login, loginWithGoogle, logout, refreshUser, updateUser, upgradeToWriter,
      initiateRegistration, verifyOTP, finalizeRegistration,
      forgotPassword, resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
