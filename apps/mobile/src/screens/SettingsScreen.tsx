import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Switch, Alert, Animated, ActivityIndicator
} from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import {
  ArrowLeft, Bell, Moon, Shield, Info, LogOut,
  ChevronRight, Globe, Lock, Sparkles, RefreshCw,
  CheckCircle, AlertCircle,
} from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import * as Updates from "expo-updates";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import apiClient from "../api/apiClient";

type UpdateStatus = "idle" | "checking" | "available" | "upToDate" | "error";

export const SettingsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { logout, user, refreshUser } = useAuth();
  const { isDarkMode, toggleDarkMode, recsEnabled, setRecsEnabled, theme } = useTheme();

  const [notifications, setNotifications] = React.useState(user?.notificationsOn || false);
  const [updatingNotifs, setUpdatingNotifs] = React.useState(false);
  const [updateStatus, setUpdateStatus] = React.useState<UpdateStatus>("idle");
  const [isUpdating, setIsUpdating] = React.useState(false);
  
  const spinAnim = React.useRef(new Animated.Value(0)).current;
  const spinLoop = React.useRef<Animated.CompositeAnimation | null>(null);

  // Auto-check on mount
  React.useEffect(() => {
    checkForUpdates();
  }, []);

  const handleToggleNotifications = async (value: boolean) => {
    setNotifications(value);
    setUpdatingNotifs(true);
    try {
        await apiClient.post("/users/me/settings", { notificationsOn: value });
        await refreshUser();
    } catch (e) {
        setNotifications(!value);
        Alert.alert("Error", "Failed to update notification settings.");
    } finally {
        setUpdatingNotifs(false);
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

  const checkForUpdates = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      setUpdateStatus("upToDate");
      return;
    }
    setUpdateStatus("checking");
    startSpin();
    try {
      const result = await Updates.checkForUpdateAsync();
      stopSpin();
      setUpdateStatus(result.isAvailable ? "available" : "upToDate");
    } catch {
      stopSpin();
      setUpdateStatus("error");
    }
  };

  const applyUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    startSpin();
    try {
      await Updates.fetchUpdateAsync();
      stopSpin();
      Alert.alert(
        "Update Ready 🎉",
        "The update has been downloaded. The app will restart to apply it.",
        [{ text: "Restart Now", onPress: () => Updates.reloadAsync() }]
      );
    } catch {
      stopSpin();
      setIsUpdating(false);
      Alert.alert("Update Failed", "Could not download the update. Please try again later.");
    }
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const cfgMap: Record<UpdateStatus, { color: string; label: string; bg: string; sub: string }> = {
    idle:      { color: Colors.mutedTeal, label: "Check for Updates",            bg: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, sub: "Tap to check for new releases." },
    checking:  { color: Colors.mutedTeal, label: "Checking…",                   bg: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, sub: "Looking for new releases…" },
    available: { color: "#FF4444",        label: "Update Available – Tap to Install", bg: isDarkMode ? "rgba(255,68,68,0.15)" : "#FFF0F0",    sub: "A new version is ready to install." },
    upToDate:  { color: "#27AE60",        label: "Up to Date",                  bg: isDarkMode ? "rgba(39,174,96,0.15)"  : "#F0FFF4",         sub: "You're running the latest version." },
    error:     { color: Colors.mutedTeal, label: "Could Not Check – Retry",     bg: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, sub: "Tap to try again." },
  };
  const cfg = cfgMap[updateStatus];

  const handleUpdatePress = () => {
    if (updateStatus === "available") applyUpdate();
    else checkForUpdates();
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
    icon, title, value, onPress, isSwitch, switchValue, onValueChange, loading
  }: any) => (
    <TouchableOpacity
      style={[styles.item, { borderBottomColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}
      onPress={onPress}
      activeOpacity={isSwitch ? 1 : 0.7}
      disabled={(isSwitch && !onPress) || loading}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
          {icon}
        </View>
        <Text style={[styles.itemTitle, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{title}</Text>
      </View>
      <View style={styles.itemRight}>
        {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : (
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
                <ChevronRight size={18} color={Colors.mutedTeal} />
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
        <SettingItem
          icon={<Bell size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Email Notifications"
          isSwitch switchValue={notifications} onValueChange={handleToggleNotifications}
          loading={updatingNotifs}
        />
        <SettingItem
          icon={<Moon size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="App-wide Dark Mode"
          isSwitch switchValue={isDarkMode} onValueChange={toggleDarkMode}
        />
        <SettingItem
          icon={<Sparkles size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Recommended Stories"
          isSwitch switchValue={recsEnabled} onValueChange={setRecsEnabled}
        />
        <SettingItem
          icon={<Globe size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Language"
          value="English"
          onPress={() => Alert.alert("Language", "Multi-language support coming in next update!")}
        />

        {/* ── Account & Security ── */}
        <Text style={styles.sectionTitle}>ACCOUNT & SECURITY</Text>
        <SettingItem
          icon={<Lock size={20} color={isDarkMode ? Colors.accent : Colors.primary} />}
          title="Change Password"
          onPress={() => Alert.alert("Security", "Password reset link sent to your email.")}
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

        {/* ── App Updates ── */}
        <Text style={styles.sectionTitle}>APP UPDATES</Text>
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

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
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