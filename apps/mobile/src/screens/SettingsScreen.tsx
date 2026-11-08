import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Switch, Animated, AppState, Share, Modal, TextInput
} from "react-native";
import { useNotice } from "../context/NoticeContext";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import {
  ArrowLeft, Bell, Moon, Shield, Info, LogOut,
  ChevronRight, Globe, Lock, Sparkles, RefreshCw,
  CheckCircle, AlertCircle, Palette, Fingerprint, Type, Layout, Trash2,
  MessageCircle, Gift, Clock, Download, KeyRound, Database, Zap, Mail, Smartphone, Inbox
} from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme, ThemeMode } from "../context/ThemeContext";
import * as LocalAuthentication from "expo-local-authentication";
import * as Updates from "expo-updates";
import * as Linking from 'expo-linking';
import { triggerLocalNotification } from "../utils/NotificationService";
import { resolveUpdateAvailability } from "../utils/updates";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { fetchLatestRelease, isNewerRelease, shouldCheckGitHub, markGitHubChecked, GITHUB_CHECK_INTERVAL_MS, ReleaseInfo, getAutoInstall, setAutoInstall } from "../utils/githubUpdates";
import { openWhatsAppChannel } from "../utils/whatsapp";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import apiClient from "../api/apiClient";
import { downloadAndInstallApk } from "../utils/UpdateService";
import { getEngagePrefs, setEngagePrefs, scheduleRecurring } from "../utils/EngagementService";
import { OfflineManager } from "../utils/OfflineManager";
import { APP_LANGUAGES, getAppLanguage, setAppLanguage, type AppLanguage } from "../i18n";

type UpdateStatus = "idle" | "checking" | "available" | "upToDate" | "error" | "disabled";

export const SettingsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { logout, user, refreshUser, forgotPassword } = useAuth();
  const { 
    themeMode, setThemeMode, 
    fontPreference, setFontPreference,
    tabOrder, setTabOrder,
    isDarkMode, recsEnabled, setRecsEnabled, theme 
  } = useTheme();
  const { showNotice } = useNotice();

  const [notifications, setNotifications] = React.useState(user?.notificationsOn || false);
  const [updatingNotifs, setUpdatingNotifs] = React.useState(false);
  const [discoverable, setDiscoverable] = React.useState(user?.discoverable ?? true);
  const [updatingDiscoverable, setUpdatingDiscoverable] = React.useState(false);
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [updateStatus, setUpdateStatus] = React.useState<UpdateStatus>("idle");
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [ghStatus, setGhStatus] = React.useState<UpdateStatus>("idle");
  const [ghRelease, setGhRelease] = React.useState<ReleaseInfo | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [autoInstall, setAutoInstallState] = React.useState(true);
  const [apkProgress, setApkProgress] = React.useState<number | null>(null);
  const [appLang, setAppLang] = React.useState<AppLanguage>("en");
  const [engage, setEngage] = React.useState({ chapters: true, streak: true, replies: true, digest: true, deals: true, quiet: true });
  const [liteMode, setLiteMode] = React.useState(false);
  const [autoDl, setAutoDl] = React.useState(false);
  const [wifiOnly, setWifiOnly] = React.useState(false);
  const [currency, setCurrency] = React.useState("KES");
  const [totpOn, setTotpOn] = React.useState(Boolean((user as any)?.totpEnabled));
  const [totpModal, setTotpModal] = React.useState(false);
  const [totpSecret, setTotpSecret] = React.useState("");
  const [totpCode, setTotpCode] = React.useState("");
  const [sessionsModal, setSessionsModal] = React.useState(false);
  const [sessions, setSessions] = React.useState<any[]>([]);
  
  const spinAnim = React.useRef(new Animated.Value(0)).current;
  const flickerAnim = React.useRef(new Animated.Value(1)).current;
  const spinLoop = React.useRef<Animated.CompositeAnimation | null>(null);
  const flickerLoop = React.useRef<Animated.CompositeAnimation | null>(null);
  const ghPulseAnim = React.useRef(new Animated.Value(1)).current;
  const ghPulseLoop = React.useRef<Animated.CompositeAnimation | null>(null);

  // Auto-check on mount, re-check on foreground, and poll while mounted.
  React.useEffect(() => {
    checkForUpdates(true);
    checkGitHubUpdates(true);
    loadBiometricSetting();
    loadAutoInstall();
    getAppLanguage().then(setAppLang).catch(() => {});
    loadExtras();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") checkGitHubUpdates(true);
    });
    const timer = setInterval(() => checkGitHubUpdates(true), GITHUB_CHECK_INTERVAL_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
      ghPulseLoop.current?.stop();
    };
  }, []);

  const loadExtras = async () => {
    try {
      const p = await getEngagePrefs();
      setEngage({ chapters: p.chapters, streak: p.streak, replies: p.replies, digest: p.digest, deals: p.deals, quiet: p.quietStart >= 0 });
      const [lite, dl, cur] = await Promise.all([
        AsyncStorage.getItem("liteMode"),
        OfflineManager.getAutoDownload().catch(() => false),
        AsyncStorage.getItem("wallet:currency"),
      ]);
      setLiteMode(lite === "true");
      setAutoDl(dl === true);
      if (cur) setCurrency(cur);
      setWifiOnly((await AsyncStorage.getItem("autoDl:wifiOnly")) === "true");
    } catch {}
  };

  const updateEngage = async (patch: Record<string, boolean>) => {
    const next = { ...engage, ...patch };
    setEngage(next);
    const { quiet, ...rest } = patch;
    await setEngagePrefs({ ...rest, ...(quiet !== undefined ? (quiet ? { quietStart: 22, quietEnd: 7 } : { quietStart: -1, quietEnd: 7 }) : {}) });
    scheduleRecurring().catch(() => {});
  };

  const toggleLite = async (v: boolean) => {
    setLiteMode(v);
    await AsyncStorage.setItem("liteMode", v.toString());
    showNotice({ title: v ? "Lite mode on" : "Lite mode off", message: v ? "Downloads skip cover art to save data." : "Full quality restored.", variant: "info" });
  };

  const toggleAutoDl = async (v: boolean) => {
    setAutoDl(v);
    await OfflineManager.setAutoDownload(v);
  };

  const cycleCurrency = async () => {
    try {
      const res = await apiClient.get("/currencies");
      const list = Array.isArray(res.data) ? res.data : [];
      if (list.length === 0) return;
      const i = list.findIndex((c: any) => c.code === currency);
      const next = list[(i + 1) % list.length].code;
      setCurrency(next);
      await AsyncStorage.setItem("wallet:currency", next);
      showNotice({ title: "Currency", message: `Prices now show in ${next}.`, variant: "success" });
    } catch {
      showNotice({ title: "Error", message: "Could not load currencies.", variant: "error" });
    }
  };

  const openTotp = async () => {
    setTotpCode("");
    if (!totpOn) {
      try {
        const res = await apiClient.post("/auth/totp/setup");
        setTotpSecret(res.data.secret || "");
      } catch {
        showNotice({ title: "Error", message: "Could not start 2FA setup.", variant: "error" });
        return;
      }
    }
    setTotpModal(true);
  };

  const confirmTotp = async () => {
    try {
      await apiClient.post("/auth/totp/verify", { code: totpCode.trim() });
      setTotpOn(true);
      setTotpModal(false);
      setTotpSecret("");
      showNotice({ title: "2FA enabled", message: "Your account now requires an authenticator code.", variant: "success" });
    } catch {
      showNotice({ title: "Invalid code", message: "Check your authenticator app and try again.", variant: "error" });
    }
  };

  const disableTotp = async () => {
    try {
      await apiClient.post("/auth/totp/disable", { code: totpCode.trim() });
      setTotpOn(false);
      setTotpModal(false);
      showNotice({ title: "2FA disabled", message: "Two-factor authentication is off.", variant: "info" });
    } catch {
      showNotice({ title: "Error", message: "Enter your current 2FA code to disable.", variant: "error" });
    }
  };

  const openSessions = async () => {
    try {
      const res = await apiClient.get("/users/me/sessions");
      setSessions(Array.isArray(res.data) ? res.data : []);
      setSessionsModal(true);
    } catch {
      showNotice({ title: "Error", message: "Could not load sessions.", variant: "error" });
    }
  };

  const revokeSessions = async () => {
    try {
      await apiClient.post("/auth/logout-all");
      setSessionsModal(false);
      showNotice({ title: "Signed out everywhere", message: "Please log in again.", variant: "info" });
      logout();
    } catch {
      showNotice({ title: "Error", message: "Could not sign out sessions.", variant: "error" });
    }
  };

  const exportData = async () => {
    try {
      showNotice({ title: "Preparing export", message: "Gathering your data…", variant: "info" });
      const res = await apiClient.get("/users/me/export");
      await Share.share({ message: JSON.stringify(res.data, null, 2).slice(0, 90000), title: "StoryNest data export" });
    } catch {
      showNotice({ title: "Error", message: "Could not export your data.", variant: "error" });
    }
  };

  const loadAutoInstall = async () => {
    setAutoInstallState(await getAutoInstall());
  };

  const handleToggleAutoInstall = async (value: boolean) => {
    setAutoInstallState(value);
    await setAutoInstall(value);
  };

  const loadBiometricSetting = async () => {
    const val = await AsyncStorage.getItem("biometricEnabled");
    setBiometricEnabled(val === "true");
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) {
            showNotice({ title: "Not Supported", message: "Biometric authentication is not set up on this device.", variant: "info" });
            return;
        }
        
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Confirm identity to enable lock",
            fallbackLabel: "Use Passcode"
        });
        
        if (!result.success) return;
    }
    
    setBiometricEnabled(value);
    await AsyncStorage.setItem("biometricEnabled", value.toString());
  };

  const handleThemePress = () => {
    showNotice({
      title: "Theme Library",
      message: "Choose your preferred app appearance:",
      variant: "info",
      actions: [
        { label: "Light", kind: "primary", onPress: () => setThemeMode("light") },
        { label: "Dark", kind: "ghost", onPress: () => setThemeMode("dark") },
        { label: "Sepia (Classic)", kind: "ghost", onPress: () => setThemeMode("sepia") },
        { label: "Solarized (Comfort)", kind: "ghost", onPress: () => setThemeMode("solarized") },
        { label: "OLED Black", kind: "ghost", onPress: () => setThemeMode("oled") },
        { label: "Cancel", kind: "ghost" },
      ],
    });
  };

  const handleFontPress = () => {
    showNotice({
      title: "Typography",
      message: "Choose your preferred reading font:",
      variant: "info",
      actions: [
        { label: "Default (Urbanist)", kind: "primary", onPress: () => setFontPreference("default") },
        { label: "Serif (Lora)", kind: "ghost", onPress: () => setFontPreference("serif") },
        { label: "Modern (Inter)", kind: "ghost", onPress: () => setFontPreference("modern") },
        { label: "Classic (Merriweather)", kind: "ghost", onPress: () => setFontPreference("classic") },
        { label: "Open Sans (Accessible)", kind: "ghost", onPress: () => setFontPreference("dyslexic") },
        { label: "Cancel", kind: "ghost" },
      ],
    });
  };

  const handleNavPress = () => {
    showNotice({
      title: "Navigation Layout",
      message: "Customize your bottom bar tabs:",
      variant: "info",
      actions: [
        { label: "Classic (Home First)", kind: "primary", onPress: () => setTabOrder(["Home", "Read", "Podcasts", "Chat", "Activity"]) },
        { label: "Discovery (Read First)", kind: "ghost", onPress: () => setTabOrder(["Read", "Home", "Podcasts", "Chat", "Activity"]) },
        { label: "Minimal (No Podcasts)", kind: "ghost", onPress: () => setTabOrder(["Home", "Read", "Chat", "Activity"]) },
        { label: "Restore Default", kind: "ghost", onPress: () => setTabOrder(["Home", "Read", "Podcasts", "Chat", "Activity"]) },
        { label: "Cancel", kind: "ghost" },
      ],
    });
  };

  const handleToggleNotifications = async (value: boolean) => {
    setNotifications(value);
    setUpdatingNotifs(true);
    try {
        await apiClient.post("/users/me/settings", { notificationsOn: value });
        await refreshUser();
    } catch (e) {
        setNotifications(!value);
        showNotice({ title: "Error", message: "Failed to update notification settings.", variant: "error" });
    } finally {
        setUpdatingNotifs(false);
    }
  };

  const handleToggleDiscoverable = async (value: boolean) => {
    setDiscoverable(value);
    setUpdatingDiscoverable(true);
    try {
        await apiClient.post("/users/me/settings", { discoverable: value });
        await refreshUser();
        if (!value) {
            showNotice({ title: "Invisible", message: "Nobody can find you in chat search now. Your existing chats keep working.", variant: "info" });
        }
    } catch (e) {
        setDiscoverable(!value);
        showNotice({ title: "Error", message: "Failed to update chat visibility.", variant: "error" });
    } finally {
        setUpdatingDiscoverable(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    try {
        await forgotPassword(user.email);
        navigation.navigate("OTP", { email: user.email, type: "password", from: "settings" });
    } catch (e) {
        showNotice({ title: "Error", message: "Could not send the reset code. Please try again.", variant: "error" });
    }
  };

  const handleDeleteAccount = () => {
    showNotice({
        title: "Delete Account",
        message: "This is PERMANENT. All your library, streaks, and XP will be gone forever. Are you absolutely sure?",
        variant: "error",
        actions: [
            { label: "Cancel", kind: "ghost" },
            {
                label: "DELETE EVERYTHING",
                kind: "destructive",
                onPress: async () => {
                    setDeleting(true);
                    try {
                        await apiClient.delete("/auth/account");
                        logout();
                    } catch (e) {
                        showNotice({ title: "Error", message: "Could not delete account. Try again later.", variant: "error" });
                    } finally { setDeleting(false); }
                }
            },
        ],
    });
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
        if (window.confirm("Are you sure you want to logout?")) {
            logout();
        }
    } else {
        showNotice({
            title: "Logout",
            message: "Are you sure you want to leave the nest?",
            variant: "info",
            actions: [
                { label: "Stay", kind: "ghost" },
                { label: "Logout", kind: "destructive", onPress: logout },
            ],
        });
    }
  };

  const handleTestNotification = async () => {
      await triggerLocalNotification("Test Alert", "This is how StoryNest sounds on your device!");
      if (Platform.OS === 'android') {
          showNotice({
              title: "Did it ring?",
              message: "If not, check your 'StoryNest Alerts' channel in System Settings.",
              variant: "info",
              actions: [
                  { label: "Settings", kind: "primary", onPress: () => Linking.openSettings() },
                  { label: "OK", kind: "ghost" },
              ],
          });
      }
  };

  const startSpin = () => {
    spinAnim.setValue(0);
    spinLoop.current = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: true })
    );
    spinLoop.current.start();
  };

  const stopSpin = () => {
    spinLoop.current?.stop();
    spinAnim.setValue(0);
  };

  const startFlicker = () => {
      flickerLoop.current = Animated.loop(
          Animated.sequence([
              Animated.timing(flickerAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
              Animated.timing(flickerAnim, { toValue: 1, duration: 500, useNativeDriver: true })
          ])
      );
      flickerLoop.current.start();
  };

  const stopFlicker = () => {
      flickerLoop.current?.stop();
      flickerAnim.setValue(1);
  };

  const checkForUpdates = async (isAuto = false) => {
    if (resolveUpdateAvailability(__DEV__, Updates.isEnabled) === "disabled") {
      setUpdateStatus("disabled");
      return;
    }
    setUpdateStatus("checking");
    if (!isAuto) startSpin();
    try {
      const result = await Updates.checkForUpdateAsync();
      stopSpin();
      if (result.isAvailable) {
          setUpdateStatus("available");
          startFlicker();
      } else {
          setUpdateStatus("upToDate");
      }
    } catch {
      stopSpin();
      setUpdateStatus("error");
    }
  };

  const applyUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    startSpin();
    stopFlicker();
    try {
      await Updates.fetchUpdateAsync();
      stopSpin();
      showNotice({
        title: "Update Ready",
        message: "The latest code from GitHub has been downloaded. The app will restart to apply it.",
        variant: "success",
        actions: [{ label: "Restart Now", kind: "primary", onPress: () => Updates.reloadAsync() }],
      });
    } catch {
      stopSpin();
      setIsUpdating(false);
      showNotice({ title: "Update Failed", message: "Could not download the update. Please try again later.", variant: "error" });
    }
  };

  const currentVersion = Constants.expoConfig?.version ?? "0.0.0";

  const checkGitHubUpdates = async (isAuto = false) => {
    if (isAuto && !(await shouldCheckGitHub())) return;
    if (ghStatus === "checking") return;
    setGhStatus("checking");
    try {
      const rel = await fetchLatestRelease();
      if (!rel) {
        setGhStatus("error");
        return;
      }
      if (isNewerRelease(rel.tag, currentVersion)) {
        setGhRelease(rel);
        setGhStatus("available");
        startGhPulse();
        if (await markGitHubChecked(rel.tag)) {
          showNotice({
            title: "New Release Available",
            message: `${rel.name} is out on GitHub. Tap below to view and download it.`,
            variant: "info",
          });
        }
      } else {
        setGhStatus("upToDate");
        await markGitHubChecked(rel.tag);
      }
    } catch {
      setGhStatus("error");
    }
  };

  const startGhPulse = () => {
    if (ghPulseLoop.current) return;
    ghPulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(ghPulseAnim, { toValue: 1.03, duration: 700, useNativeDriver: true }),
        Animated.timing(ghPulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    ghPulseLoop.current.start();
  };

  const handleGhPress = async () => {
    if (ghStatus !== "available") { checkGitHubUpdates(); return; }
    // In-app install when the release ships an APK; otherwise open the page.
    if (ghRelease?.apkUrl && Platform.OS === "android") {
      if (apkProgress !== null) return;
      setApkProgress(0);
      try {
        await downloadAndInstallApk(ghRelease.apkUrl, ghRelease.tag, (p) => setApkProgress(p));
        setApkProgress(null);
        showNotice({ title: "Installer launched", message: "Confirm the system prompt to finish installing.", variant: "success" });
      } catch (e) {
        setApkProgress(null);
        showNotice({ title: "Install failed", message: "Could not download the APK. Opening the release page instead.", variant: "error" });
        openGitHubRelease();
      }
      return;
    }
    openGitHubRelease();
  };

  const openGitHubRelease = async () => {
    if (!ghRelease?.url) return;
    try {
      await WebBrowser.openBrowserAsync(ghRelease.url);
    } catch {
      showNotice({ title: "Error", message: "Could not open the release page.", variant: "error" });
    }
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const cfgMap: Record<UpdateStatus, { color: string; label: string; bg: string; sub: string }> = {
    idle:      { color: Colors.mutedTeal, label: "Check for Updates",            bg: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, sub: "Tap to check for GitHub fixes." },
    checking:  { color: Colors.mutedTeal, label: "Checking…",                   bg: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, sub: "Looking for new code…" },
    available: { color: "#FF4444",        label: "Update Available – Tap to Install", bg: isDarkMode ? "rgba(255,68,68,0.15)" : "#FFF0F0",    sub: "New code is ready to apply." },
    upToDate:  { color: "#27AE60",        label: "Up to Date",                  bg: isDarkMode ? "rgba(39,174,96,0.15)"  : "#F0FFF4",         sub: "You're running the latest code." },
    error:     { color: Colors.mutedTeal, label: "Could Not Check – Retry",     bg: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, sub: "Tap to try again." },
    disabled:  { color: Colors.mutedTeal, label: "Updates Unavailable",          bg: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, sub: "OTA updates are off in this build." },
  };
  const cfg = cfgMap[updateStatus];

  const handleUpdatePress = () => {
    if (updateStatus === "available") applyUpdate();
    else if (updateStatus === "disabled") {
      showNotice({
        title: "Updates Unavailable",
        message: "Over-the-air updates are turned off in this build. Install a newer release to get the latest fixes.",
        variant: "info",
      });
    } else checkForUpdates();
  };

  const UpdateIcon = () => {
    if (updateStatus === "checking" || isUpdating) {
      return (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <RefreshCw size={20} color={cfg.color} />
        </Animated.View>
      );
    }
    if (updateStatus === "upToDate") return <CheckCircle size={20} color="#27AE60" />;
    if (updateStatus === "available") return <AlertCircle size={20} color="#FF4444" />;
    return <RefreshCw size={20} color={cfg.color} />;
  };

  const SettingItem = ({
    icon, title, value, onPress, isSwitch, switchValue, onValueChange, loading, destructive
  }: any) => (
    <TouchableOpacity
      style={[styles.item, { borderBottomColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}
      onPress={onPress}
      activeOpacity={isSwitch ? 1 : 0.7}
      disabled={(isSwitch && !onPress) || loading}
      accessible
      accessibilityRole={isSwitch ? "switch" : "button"}
      accessibilityLabel={title}
      accessibilityState={isSwitch ? { checked: !!switchValue } : undefined}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: destructive ? 'rgba(255,107,107,0.1)' : (isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen) }]}>
          {icon}
        </View>
        <Text style={[styles.itemTitle, { color: destructive ? "#FF6B6B" : (isDarkMode ? Colors.accent : Colors.primary) }]}>{title}</Text>
      </View>
      <View style={styles.itemRight}>
        {loading ? <Text style={{ color: Colors.mutedTeal }}>...</Text> : (
            isSwitch ? (
            <Switch
                value={switchValue}
                onValueChange={onValueChange}
                trackColor={{ false: "#767577", true: Colors.primary }}
                thumbColor={switchValue ? Colors.accent : "#f4f3f4"}
            />
            ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                {value && <Text style={styles.itemValue}>{value}</Text>}
                <ChevronRight size={18} color={destructive ? "#FF6B6B" : Colors.mutedTeal} />
            </View>
            )
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { top: insets.top + 20 }]}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* ── Preferences ── */}
        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.langRow}>
          {APP_LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langChip, appLang === l.code && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={async () => { setAppLang(l.code); await setAppLanguage(l.code); }}
            >
              <Text style={[styles.langText, { fontFamily: Fonts.body }, appLang === l.code && { color: Colors.accent }]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <SettingItem
          icon={<Palette size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="App Theme"
          value={themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
          onPress={handleThemePress}
        />
        <SettingItem
          icon={<Type size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Typography"
          value={fontPreference.charAt(0).toUpperCase() + fontPreference.slice(1)}
          onPress={handleFontPress}
        />
        <SettingItem
          icon={<Layout size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Bottom Bar Layout"
          value={tabOrder[0] === "Explore" ? "Discovery" : tabOrder.length < 4 ? "Minimal" : "Classic"}
          onPress={handleNavPress}
        />
        <SettingItem
          icon={<Bell size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Test Notification Sound"
          onPress={handleTestNotification}
        />
        <SettingItem
          icon={<Shield size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="System Notification Access"
          onPress={() => Linking.openSettings()}
        />
        <SettingItem
          icon={<Bell size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Email Notifications"
          isSwitch switchValue={notifications} onValueChange={handleToggleNotifications}
          loading={updatingNotifs}
        />
        <SettingItem
          icon={<Fingerprint size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Biometric Lock"
          isSwitch switchValue={biometricEnabled} onValueChange={handleToggleBiometric}
        />
        <SettingItem
          icon={<Sparkles size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Recommended Stories"
          isSwitch switchValue={recsEnabled} onValueChange={setRecsEnabled}
        />

        {/* ── Community & Earn ── */}
        <Text style={styles.sectionTitle}>COMMUNITY & REWARDS</Text>
        <SettingItem
          icon={<Globe size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Let Others Find Me to Chat"
          isSwitch switchValue={discoverable} onValueChange={handleToggleDiscoverable}
          loading={updatingDiscoverable}
        />
        <SettingItem
          icon={<MessageCircle size={20} color="#25D366" />}
          title="Join WhatsApp Channel"
          value="Official"
          onPress={() => openWhatsAppChannel((message) => showNotice({ title: "WhatsApp Channel", message, variant: "error" }))}
        />
        <SettingItem
          icon={<Gift size={20} color="#D4AF37" />}
          title="Refer & Earn Coins"
          value="Get 50 Coins"
          onPress={() => navigation.navigate("Referral")}
        />

        {/* ── Notifications ── */}
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        <SettingItem
          icon={<Inbox size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Notification Inbox"
          onPress={() => navigation.navigate("Inbox")}
        />
        <SettingItem
          icon={<Mail size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Weekly Digest"
          isSwitch switchValue={engage.digest} onValueChange={(v: boolean) => updateEngage({ digest: v })}
        />
        <SettingItem
          icon={<Bell size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Chapter Alerts"
          isSwitch switchValue={engage.chapters} onValueChange={(v: boolean) => updateEngage({ chapters: v })}
        />
        <SettingItem
          icon={<Zap size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Streak Reminders"
          isSwitch switchValue={engage.streak} onValueChange={(v: boolean) => updateEngage({ streak: v })}
        />
        <SettingItem
          icon={<MessageCircle size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Reply Alerts"
          isSwitch switchValue={engage.replies} onValueChange={(v: boolean) => updateEngage({ replies: v })}
        />
        <SettingItem
          icon={<Clock size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Quiet Hours (10pm–7am)"
          isSwitch switchValue={engage.quiet} onValueChange={(v: boolean) => updateEngage({ quiet: v })}
        />

        {/* ── Reading & Data ── */}
        <Text style={styles.sectionTitle}>READING & DATA</Text>
        <SettingItem
          icon={<Database size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Downloads & Storage"
          onPress={() => navigation.navigate("Downloads")}
        />
        <SettingItem
          icon={<Download size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Auto-download Bookmarks"
          isSwitch switchValue={autoDl} onValueChange={toggleAutoDl}
        />
        <SettingItem
          icon={<Download size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Auto-download on Wi-Fi Only"
          isSwitch switchValue={wifiOnly} onValueChange={async (v: boolean) => { setWifiOnly(v); await AsyncStorage.setItem("autoDl:wifiOnly", v.toString()); }}
        />
        <SettingItem
          icon={<Trash2 size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Hidden Stories"
          onPress={() => navigation.navigate("Hidden")}
        />
        <SettingItem
          icon={<Zap size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Lite Mode"
          isSwitch switchValue={liteMode} onValueChange={toggleLite}
        />
        <SettingItem
          icon={<Globe size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Currency"
          value={currency}
          onPress={cycleCurrency}
        />

        {/* ── Account & Security ── */}
        <Text style={styles.sectionTitle}>ACCOUNT & SECURITY</Text>
        <SettingItem
          icon={<Lock size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Change Password"
          onPress={handleChangePassword}
        />
        <SettingItem
          icon={<KeyRound size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Two-Factor Authentication"
          value={totpOn ? "On" : "Off"}
          onPress={openTotp}
        />
        <SettingItem
          icon={<Smartphone size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Active Sessions"
          value={String(sessions.length || "")}
          onPress={openSessions}
        />
        <SettingItem
          icon={<Download size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Export My Data"
          onPress={exportData}
        />
        <SettingItem
          icon={<Shield size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Privacy Policy"
          onPress={() => navigation.navigate("Legal", { type: 'privacy' })}
        />
        <SettingItem
          icon={<Info size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Terms of Service"
          onPress={() => navigation.navigate("Legal", { type: 'tos' })}
        />
        <SettingItem
          icon={<Trash2 size={20} color="#FF6B6B" />}
          title="Delete Account"
          destructive
          onPress={handleDeleteAccount}
          loading={deleting}
        />

        {/* ── App Updates (OTA Dynamic Rollout) ── */}
        <Text style={styles.sectionTitle}>DYNAMIC APP UPDATES</Text>
        <Animated.View style={{ opacity: updateStatus === 'available' ? flickerAnim : 1 }}>
            <TouchableOpacity
                style={[styles.updateCard, { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                onPress={handleUpdatePress}
                activeOpacity={0.8}
                disabled={isUpdating || updateStatus === "checking"}
            >
                <View style={styles.updateLeft}>
                    <UpdateIcon />
                    <View style={{ marginLeft: 14, flex: 1 }}>
                    <Text style={[styles.updateLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    <Text style={[styles.updateSub, { color: isDarkMode ? "rgba(255,255,255,0.4)" : Colors.mutedTeal }]}>
                        {cfg.sub}
                    </Text>
                    </View>
                </View>
                {updateStatus !== "checking" && !isUpdating && (
                    <ChevronRight size={18} color={cfg.color} />
                )}
            </TouchableOpacity>
        </Animated.View>

        <SettingItem
          icon={<RefreshCw size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Auto-install Updates"
          isSwitch switchValue={autoInstall} onValueChange={handleToggleAutoInstall}
        />

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>GITHUB RELEASES</Text>
        <Animated.View style={{ transform: [{ scale: ghStatus === 'available' ? ghPulseAnim : 1 }] }}>
            <TouchableOpacity
                style={[styles.updateCard, {
                  backgroundColor: ghStatus === 'available'
                    ? (isDarkMode ? "rgba(255,68,68,0.15)" : "#FFF0F0")
                    : (isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen),
                  borderColor: ghStatus === 'available' ? "#FF4444" : Colors.mutedTeal,
                }]}
                onPress={handleGhPress}
                activeOpacity={0.8}
                disabled={ghStatus === "checking"}
            >
                <View style={styles.updateLeft}>
                    {ghStatus === 'available'
                      ? <AlertCircle size={20} color="#FF4444" />
                      : ghStatus === 'upToDate'
                        ? <CheckCircle size={20} color="#27AE60" />
                        : <RefreshCw size={20} color={Colors.mutedTeal} />}
                    <View style={{ marginLeft: 14, flex: 1 }}>
                    <Text style={[styles.updateLabel, { color: ghStatus === 'available' ? "#FF4444" : Colors.mutedTeal }]}>
                        {apkProgress !== null ? `Downloading… ${Math.round(apkProgress * 100)}%`
                          : ghStatus === 'available' ? `${ghRelease?.name || 'New Release'} – Tap to Install`
                          : ghStatus === 'checking' ? "Checking GitHub…"
                          : ghStatus === 'upToDate' ? "GitHub: Up to Date"
                          : ghStatus === 'error' ? "GitHub: Could Not Check – Retry"
                          : "Check GitHub Releases"}
                    </Text>
                    <Text style={[styles.updateSub, { color: isDarkMode ? "rgba(255,255,255,0.4)" : Colors.mutedTeal }]}>
                        {ghStatus === 'available' ? "A newer native build is published." : "Watches BrnEzekiel/StoryNest releases."}
                    </Text>
                    </View>
                </View>
                {ghStatus !== "checking" && (
                    <ChevronRight size={18} color={Colors.mutedTeal} />
                )}
            </TouchableOpacity>
        </Animated.View>

        <Modal visible={totpModal} animationType="fade" transparent onRequestClose={() => setTotpModal(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 }}>
            <View style={{ backgroundColor: theme.white, borderRadius: 14, padding: 20 }}>
              <Text style={{ fontFamily: Fonts.heading, fontSize: 16, color: isDarkMode ? Colors.accent : Colors.primary, marginBottom: 12 }}>
                {totpOn ? "DISABLE 2FA" : "ENABLE 2FA"}
              </Text>
              {!totpOn && !!totpSecret && (
                <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: Colors.mutedTeal, marginBottom: 12 }} selectable>
                  Scan this secret into your authenticator app, then enter the 6-digit code:{"\n"}{totpSecret}
                </Text>
              )}
              {totpOn && (
                <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: Colors.mutedTeal, marginBottom: 12 }}>
                  Enter your current 6-digit code to turn off two-factor authentication.
                </Text>
              )}
              <TextInput
                value={totpCode}
                onChangeText={setTotpCode}
                placeholder="123456"
                placeholderTextColor={Colors.mutedTeal}
                keyboardType="number-pad"
                maxLength={6}
                style={{ borderWidth: 1, borderColor: Colors.mutedTeal, borderRadius: 10, padding: 12, fontSize: 18, letterSpacing: 4, textAlign: "center", color: isDarkMode ? "#fff" : "#000", marginBottom: 12 }}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => setTotpModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.mutedTeal, alignItems: "center" }}>
                  <Text style={{ color: Colors.mutedTeal, fontFamily: Fonts.body }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={totpOn ? disableTotp : confirmTotp} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontFamily: Fonts.body }}>{totpOn ? "Disable" : "Verify"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={sessionsModal} animationType="slide" transparent onRequestClose={() => setSessionsModal(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 }}>
            <View style={{ backgroundColor: theme.white, borderRadius: 14, padding: 20, maxHeight: "70%" }}>
              <Text style={{ fontFamily: Fonts.heading, fontSize: 16, color: isDarkMode ? Colors.accent : Colors.primary, marginBottom: 12 }}>ACTIVE SESSIONS</Text>
              <ScrollView style={{ marginBottom: 12 }}>
                {sessions.length === 0 && <Text style={{ fontFamily: Fonts.body, color: Colors.mutedTeal }}>No sessions found.</Text>}
                {sessions.map((s: any, i: number) => (
                  <View key={s.id || i} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.paleGreen }}>
                    <Text style={{ fontFamily: Fonts.body, color: isDarkMode ? "#fff" : "#000" }} numberOfLines={1}>{s.device || "Unknown device"}</Text>
                    <Text style={{ fontFamily: Fonts.body, fontSize: 12, color: Colors.mutedTeal }}>{s.lastActive ? new Date(s.lastActive).toLocaleString() : ""}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => setSessionsModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.mutedTeal, alignItems: "center" }}>
                  <Text style={{ color: Colors.mutedTeal, fontFamily: Fonts.body }}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={revokeSessions} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: "#FF6B6B", alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontFamily: Fonts.body }}>Sign out all</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#FF6B6B" />
          <Text style={styles.logoutText}>LOG OUT</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>Logged in as: {user?.email}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: { position: "absolute", left: 20 },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.accent, letterSpacing: 0.05, marginTop: 10 },
  content: { flex: 1, padding: 24 },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.mutedTeal, marginBottom: 16, marginTop: 24, letterSpacing: 0.02 },
  langRow: { flexDirection: "row", marginBottom: 8 },
  langChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: Colors.paleGreen, marginRight: 10 },
  langText: { fontSize: 13 },
  item: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1 },
  itemLeft: { flexDirection: "row", alignItems: "center" },
  iconContainer: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 16 },
  itemTitle: { fontFamily: Fonts.body, fontSize: 16 },
  itemValue: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal, marginRight: 8 },
  itemRight: {},
  // Update card
  updateCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 14, borderWidth: 1.5 },
  updateLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  updateLabel: { fontFamily: Fonts.heading, fontSize: 14 },
  updateSub: { fontFamily: Fonts.body, fontSize: 12, marginTop: 2 },
  // Logout
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 40, paddingVertical: 16, borderWidth: 1, borderColor: "#FF6B6B", borderRadius: 12 },
  logoutText: { fontFamily: Fonts.heading, color: "#FF6B6B", marginLeft: 12, fontSize: 14 },
  footerText: { textAlign: "center", marginTop: 32, marginBottom: 40, fontFamily: Fonts.body, fontSize: 12, color: Colors.mutedTeal },
});
