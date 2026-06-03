import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform, Dimensions, ImageBackground } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Settings, LogOut, ChevronRight, Edit3, Award, Flame, Clock, BookOpen, Camera, ShieldCheck, Zap } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import * as ImagePicker from "expo-image-picker";
import apiClient from "../api/apiClient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { HeaderWave } from "../components/HeaderWave";
import { StatusBar } from "expo-status-bar";

const { width } = Dimensions.get("window");

export const ProfileScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [finishedCount, setFinishedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      fetchProfileData();
    }, [])
  );

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/users/me/bookmarks");
      // Count stories where progress is 100
      const finished = res.data.filter((b: any) => b.progress >= 100).length;
      setFinishedCount(finished);
    } catch (error) {
      console.log("[Profile] Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to leave the Nest?", [
      { text: "Stay", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout }
    ]);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename || "");
      const type = match ? `image/${match[1]}` : `image`;

      formData.append("avatar", {
        uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
        name: filename,
        type,
      } as any);

      await apiClient.post("/users/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await refreshUser();
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to update avatar.");
    } finally {
      setUploading(false);
    }
  };

  const StatItem = ({ icon: Icon, label, value, color }: any) => (
    <View style={[styles.statItem, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.white }, Shadows.s]}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Icon size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={styles.headerWrapper}>
        <ImageBackground 
            source={require("../../assets/onboarding-bg.jpg")}
            style={[styles.headerBg, { paddingTop: insets.top + 20 }]}
            resizeMode="cover"
        >
            <LinearGradient
                colors={["rgba(0, 30, 28, 0.85)", "rgba(0, 30, 28, 0.99)"]}
                style={StyleSheet.absoluteFill}
            />
            
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>YOUR SANCTUARY</Text>
              <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate("Settings")}>
                <Settings size={22} color={Colors.accent} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.avatarWrapper}>
                <TouchableOpacity onPress={pickImage} activeOpacity={0.9} style={styles.avatarContainer}>
                  {user?.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>{user?.username?.substring(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.editBadge}>
                    {uploading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Camera size={14} color={Colors.primary} />}
                  </View>
                </TouchableOpacity>
                <View style={styles.statusDot} />
              </View>
              
              <View style={styles.userDetails}>
                <View style={styles.nameRow}>
                    <Text style={styles.username}>{user?.username || "Story Reader"}</Text>
                    {user?.role === "ADMIN" && <ShieldCheck size={18} color={Colors.accent} style={{ marginLeft: 8 }} />}
                </View>
                <Text style={styles.email}>{user?.email}</Text>
                
                {user?.role === "ADMIN" && (
                    <TouchableOpacity style={styles.adminBadge} onPress={() => navigation.navigate("Admin")}>
                       <Zap size={12} color={Colors.primary} style={{ marginRight: 4 }} />
                       <Text style={styles.adminBadgeText}>SUPER ADMIN DASHBOARD</Text>
                    </TouchableOpacity>
                )}
              </View>
            </View>
            <HeaderWave color={isDarkMode ? "#121212" : theme.white} />
        </ImageBackground>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={styles.statsGrid}>
          <StatItem icon={Flame} label="Day Streak" value={user?.streakCount || 0} color="#FF9500" />
          <StatItem icon={Clock} label="Min Read" value={user?.totalReadTime || 0} color="#34C759" />
          <StatItem icon={BookOpen} label="Finished" value={loading ? "..." : finishedCount} color="#5856D6" />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: isDarkMode ? Colors.accent : Colors.primary }]}>ACCOUNT SETTINGS</Text>
          
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : Colors.white }, Shadows.s]}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.primary + '10' }]}><Edit3 size={20} color={Colors.primary} /></View>
              <View>
                <Text style={[styles.menuText, { color: isDarkMode ? Colors.white : Colors.primary }]}>Profile Identity</Text>
                <Text style={styles.menuSubtext}>Update your bio and handle</Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.mutedTeal} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : Colors.white }, Shadows.s]}
            onPress={() => navigation.navigate("Achievements")}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#FF950015' }]}><Award size={20} color="#FF9500" /></View>
              <View>
                <Text style={[styles.menuText, { color: isDarkMode ? Colors.white : Colors.primary }]}>Reader Achievements</Text>
                <Text style={styles.menuSubtext}>View your unlocked badges</Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.mutedTeal} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { borderLeftColor: Colors.error, borderLeftWidth: 4 }]} onPress={handleLogout}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.error + '10' }]}><LogOut size={20} color={Colors.error} /></View>
              <Text style={[styles.menuText, { color: Colors.error, fontWeight: '700' }]}>Sign Out of the Nest</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.proCard, Shadows.m]}>
          <LinearGradient
            colors={[Colors.primary, "#004D46"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.proGradient}
          >
            <View style={styles.proContent}>
               <Text style={styles.proTitle}>Elevate to Premium</Text>
               <Text style={styles.proDesc}>Access high-fidelity audio stories and exclusive author notes.</Text>
               <View style={styles.proBadge}><Text style={styles.proBadgeText}>EARLY BIRD 50% OFF</Text></View>
            </View>
            <Image source={require("../../assets/icon.png")} style={styles.proIcon} />
          </LinearGradient>
        </TouchableOpacity>
        
        <Text style={styles.footerVersion}>StoryNest v1.0.4 • Crafted with passion</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrapper: { overflow: 'hidden' },
  headerBg: { paddingBottom: 60 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 32 },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.accent, letterSpacing: 2, opacity: 0.9 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  profileInfo: { flexDirection: 'row', alignItems: "center", paddingHorizontal: 24 },
  avatarWrapper: { marginRight: 20 },
  avatarContainer: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: Colors.accent, padding: 4 },
  avatar: { width: "100%", height: "100%", borderRadius: 40 },
  avatarPlaceholder: { width: "100%", height: "100%", borderRadius: 40, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: Fonts.heading, fontSize: 32, color: Colors.primary },
  editBadge: { position: "absolute", bottom: -2, right: -2, backgroundColor: Colors.accent, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#003631" },
  statusDot: { position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#34C759', borderWidth: 2, borderColor: '#003631' },
  userDetails: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { fontFamily: Fonts.heading, fontSize: 28, color: Colors.white },
  email: { fontFamily: Fonts.body, fontSize: 14, color: Colors.paleGreen, opacity: 0.8, marginTop: 2 },
  adminBadge: { backgroundColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  adminBadgeText: { fontFamily: Fonts.heading, fontSize: 9, color: Colors.primary, letterSpacing: 0.5 },
  content: { flex: 1, padding: 20 },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32, marginTop: 10 },
  statItem: { width: (width - 60) / 3, padding: 16, borderRadius: 24, alignItems: "center" },
  statIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statValue: { fontFamily: Fonts.heading, fontSize: 20, marginBottom: 2 },
  statLabel: { fontFamily: Fonts.body, fontSize: 10, color: Colors.mutedTeal, textTransform: "uppercase", letterSpacing: 0.5 },
  section: { marginBottom: 32 },
  sectionHeader: { fontFamily: Fonts.heading, fontSize: 12, letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  menuItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderRadius: 20, marginBottom: 12 },
  menuLeft: { flexDirection: "row", alignItems: "center" },
  menuIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 16 },
  menuText: { fontFamily: Fonts.heading, fontSize: 15 },
  menuSubtext: { fontFamily: Fonts.body, fontSize: 12, color: Colors.mutedTeal, marginTop: 1 },
  proCard: { borderRadius: 28, overflow: "hidden" },
  proGradient: { padding: 24, flexDirection: "row", alignItems: "center" },
  proContent: { flex: 1, zIndex: 1 },
  proTitle: { fontFamily: Fonts.heading, fontSize: 22, color: Colors.accent, marginBottom: 4 },
  proDesc: { fontFamily: Fonts.body, fontSize: 13, color: Colors.paleGreen, marginBottom: 16, lineHeight: 18, opacity: 0.9 },
  proBadge: { backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  proBadgeText: { fontFamily: Fonts.heading, fontSize: 9, color: Colors.white, letterSpacing: 1 },
  proIcon: { width: 120, height: 120, opacity: 0.08, position: "absolute", right: -20, bottom: -20, transform: [{ rotate: '-15deg' }] },
  footerVersion: { textAlign: "center", marginTop: 10, marginBottom: 20, fontFamily: Fonts.body, fontSize: 11, color: Colors.mutedTeal, opacity: 0.6 },
});