import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform, Dimensions, ImageBackground } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Settings, LogOut, Shield, Bookmark, Trophy, Mail } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export const ProfileScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();

  useEffect(() => {
    refreshUser();
  }, []);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: logout }
    ]);
  };

  const MenuOption = ({ icon: Icon, title, subtitle, onPress, color = theme.primary }: any) => (
    <TouchableOpacity style={[styles.menuItem, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : Colors.paleGreen }]} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: color + '15' }]}><Icon size={22} color={color} /></View>
      <View style={{ flex: 1, marginLeft: 16 }}><Text style={[styles.menuTitle, { color: theme.black, fontFamily: fonts.heading }]}>{title}</Text><Text style={[styles.menuSubtitle, { fontFamily: fonts.body }]}>{subtitle}</Text></View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
            <LinearGradient colors={[Colors.primary, "#004D46"]} style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}>
                <View style={styles.topRow}>
                    <TouchableOpacity onPress={() => navigation.navigate("Settings")}><Settings size={22} color={Colors.accent} /></TouchableOpacity>
                    <TouchableOpacity onPress={handleLogout}><LogOut size={22} color={Colors.accent} /></TouchableOpacity>
                </View>
                <View style={styles.avatarWrapper}>
                    <View style={styles.avatarBorder}><Image source={{ uri: user?.avatarUrl || "https://via.placeholder.com/100" }} style={styles.avatar} /></View>
                </View>
                <Text style={[styles.username, { fontFamily: fonts.heading, color: Colors.white }]}>{user?.username}</Text>
                <Text style={[styles.userRole, { fontFamily: fonts.body, color: Colors.accent }]}>{user?.role === 'ADMIN' ? 'PRO AUTHOR' : 'NEST READER'}</Text>
                
                <TouchableOpacity 
                    style={[styles.editBtn, { borderColor: Colors.accent }]} 
                    onPress={() => navigation.navigate("EditProfile")}
                >
                    <Text style={[styles.editBtnText, { fontFamily: fonts.heading, color: Colors.accent }]}>EDIT PROFILE</Text>
                </TouchableOpacity>
            </LinearGradient>
        </View>

        <View style={styles.menuGrid}>
            <MenuOption icon={Bookmark} title="Library" subtitle="Continue reading" onPress={() => navigation.navigate("Saved")} color="#34C759" />
            <MenuOption icon={Mail} title="Messages" subtitle="Private chats" onPress={() => navigation.navigate("Messages")} color="#E91E63" />
            {user?.role === 'ADMIN' && <MenuOption icon={Shield} title="Creator Studio" subtitle="Manage your stories" onPress={() => navigation.navigate("Admin")} color={Colors.accent} />}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingBottom: 50, alignItems: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 24, marginBottom: 10 },
  avatarWrapper: { position: 'relative', marginBottom: 16 },
  avatarBorder: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.accent, padding: 4 },
  avatar: { width: '100%', height: '100%', borderRadius: 45 },
  xpBadge: { position: 'absolute', bottom: -10, alignSelf: 'center', backgroundColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  xpText: { fontSize: 10, color: Colors.primary },
  username: { fontSize: 24, marginBottom: 4 },
  userRole: { fontSize: 12, letterSpacing: 2 },
  editBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  editBtnText: { fontSize: 11, letterSpacing: 1 },
  menuGrid: { padding: 24, marginTop: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12 },
  menuIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 15 },
  menuSubtitle: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 }
});
