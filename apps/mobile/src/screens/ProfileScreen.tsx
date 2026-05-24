import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image, Alert, Platform, ActivityIndicator } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Settings, LogOut, Edit2, ShieldCheck, Flame, ChevronRight } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { StoryCard } from "../components/StoryCard";
import * as ImagePicker from "expo-image-picker";
import { SkeletonCard } from "../components/SkeletonCard";

export const ProfileScreen = ({ navigation }: any) => {
  const { user, logout, refreshUser } = useAuth();
  const { theme, isDarkMode } = useTheme();
  
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/users/me/history");
      setHistory(res.data);
    } catch (error) {
      console.log("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setUpdatingAvatar(true);
    try {
      const formData = new FormData();
      const filename = uri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename || "");
      const type = match ? `image/${match[1]}` : `image`;
      formData.append("avatar", { uri, name: filename, type } as any);

      await apiClient.put("/users/me", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refreshUser();
      Alert.alert("Success", "Avatar updated successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to update avatar.");
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const totalTimeHours = Math.round((user?.totalReadTime || 0) / 60);

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <SafeAreaView>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>YOUR NEST</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => navigation.navigate("Settings")} style={styles.iconBtn}>
                  <Settings size={22} color={Colors.accent} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          <View style={styles.profileSection}>
            <TouchableOpacity onPress={handleEditProfile} activeOpacity={0.9} style={styles.avatarWrapper}>
              <View style={[styles.avatarBorder, { borderColor: Colors.accent }, Shadows.m]}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{user?.username?.substring(0, 2).toUpperCase() || "ST"}</Text>
                  </View>
                )}
                {updatingAvatar && (
                  <View style={styles.avatarOverlay}><ActivityIndicator color={Colors.accent} /></View>
                )}
              </View>
              <View style={styles.editBadge}><Edit2 size={12} color={Colors.primary} /></View>
            </TouchableOpacity>
            
            <Text style={styles.username}>{user?.username || "Reader"}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>

          <View style={[styles.statsCard, Shadows.m, { backgroundColor: isDarkMode ? "#1a2e2c" : Colors.white }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{history.length}</Text>
              <Text style={styles.statLab}>Stories</Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{totalTimeHours}h</Text>
              <Text style={styles.statLab}>Reading</Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]} />
            <View style={styles.statBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.statVal, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{user?.streakCount || 0}</Text>
                <Flame size={16} color="#FF6B6B" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.statLab}>Streak</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {user?.role === "ADMIN" && (
            <TouchableOpacity 
              style={[styles.adminCard, Shadows.s, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}
              onPress={() => navigation.navigate("Admin")}
            >
              <View style={styles.adminLeft}>
                <View style={[styles.adminIcon, { backgroundColor: isDarkMode ? Colors.primary : Colors.white }]}><ShieldCheck size={20} color={isDarkMode ? Colors.accent : Colors.primary} /></View>
                <View>
                  <Text style={[styles.adminTitle, { color: isDarkMode ? Colors.accent : Colors.primary }]}>Admin Control</Text>
                  <Text style={styles.adminSub}>Manage stories and analytics</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.mutedTeal} />
            </TouchableOpacity>
          )}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.mutedTeal : Colors.primary }]}>RECENTLY READ</Text>
            <TouchableOpacity onPress={fetchHistory}><Text style={[styles.refreshLink, { color: isDarkMode ? Colors.accent : Colors.primary }]}>Refresh</Text></TouchableOpacity>
          </View>

          <View style={styles.historyList}>
            {loading ? [1, 2].map(i => <SkeletonCard key={i} />) : (
              history.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No reading history found yet.</Text>
                </View>
              ) : (
                history.slice(0, 5).map((item) => (
                  <StoryCard 
                    key={item.id} 
                    story={item.story} 
                    onPress={() => navigation.navigate("Reader", { storyId: item.story.id })} 
                  />
                ))
              )
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { backgroundColor: Colors.primary, paddingBottom: 60, borderBottomLeftRadius: Radii.xl, borderBottomRightRadius: Radii.xl },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.l, paddingTop: 10 },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.mutedTeal, letterSpacing: 0.1 },
  headerActions: { flexDirection: "row" },
  iconBtn: { padding: 4 },
  profileSection: { alignItems: "center", marginTop: Spacing.l },
  avatarWrapper: { position: "relative" },
  avatarBorder: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, overflow: "hidden", backgroundColor: Colors.midForest },
  avatar: { width: "100%", height: "100%" },
  avatarPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatarText: { fontFamily: Fonts.heading, fontSize: 32, color: Colors.accent },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  editBadge: { position: "absolute", bottom: 4, right: 4, backgroundColor: Colors.accent, width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: Colors.primary },
  username: { fontFamily: Fonts.heading, fontSize: 28, color: Colors.accent, marginTop: Spacing.m },
  email: { fontFamily: Fonts.body, fontSize: 14, color: Colors.paleGreen, opacity: 0.7, marginTop: 2 },
  statsCard: { position: "absolute", bottom: -35, left: Spacing.l, right: Spacing.l, borderRadius: Radii.l, flexDirection: "row", paddingVertical: Spacing.l, justifyContent: "space-around", alignItems: "center" },
  statBox: { alignItems: "center" },
  statVal: { fontFamily: Fonts.heading, fontSize: 20 },
  statLab: { fontFamily: Fonts.body, fontSize: 11, color: Colors.mutedTeal, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.05 },
  statDiv: { width: 1, height: 30 },
  content: { marginTop: 60, paddingHorizontal: Spacing.l },
  adminCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.m, borderRadius: Radii.m, marginBottom: Spacing.xl },
  adminLeft: { flexDirection: "row", alignItems: "center" },
  adminIcon: { width: 40, height: 40, borderRadius: Radii.s, justifyContent: "center", alignItems: "center", marginRight: Spacing.m },
  adminTitle: { fontFamily: Fonts.heading, fontSize: 16 },
  adminSub: { fontFamily: Fonts.body, fontSize: 12, color: Colors.mutedTeal },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.m },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: 14, letterSpacing: 0.08 },
  refreshLink: { fontFamily: Fonts.body, fontSize: 13, textDecorationLine: "underline" },
  historyList: { marginTop: Spacing.s },
  emptyBox: { paddingVertical: Spacing.xl, alignItems: "center" },
  emptyText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal },
});
