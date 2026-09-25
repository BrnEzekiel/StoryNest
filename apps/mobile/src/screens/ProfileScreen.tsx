import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform, Dimensions, ImageBackground } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Settings, LogOut, Shield, Bookmark, Trophy, Mail, Star, Zap, ChevronRight, Gift, Coins, MessageCircle } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { openWhatsAppChannel } from "../utils/whatsapp";

const { width } = Dimensions.get("window");

export const ProfileScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();

  useEffect(() => {
    refreshUser();
  }, []);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
        if (window.confirm("Are you sure you want to logout?")) {
            logout();
        }
    } else {
        Alert.alert("Logout", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Logout", onPress: logout }
        ]);
    }
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
                <View style={styles.roleContainer}>
                    <Text style={[styles.userRole, { fontFamily: fonts.body, color: Colors.accent }]}>{user?.role === 'ADMIN' ? 'PRO AUTHOR' : 'NEST READER'}</Text>
                    {user?.isPremium && (
                        <View style={styles.premiumBadgeContainer}>
                            <Star size={12} color={Colors.primary} fill={Colors.primary} />
                            <Text style={[styles.premiumBadgeText, { fontFamily: fonts.heading }]}>PIONEER</Text>
                        </View>
                    )}
                </View>

                {/* Story Coins Balance */}
                <TouchableOpacity 
                    style={styles.coinPill}
                    onPress={() => navigation.navigate("Referral")}
                    activeOpacity={0.85}
                >
                    <Coins size={14} color="#D4AF37" />
                    <Text style={[styles.coinPillText, { fontFamily: fonts.heading }]}>
                        {user?.coins || 0} COINS
                    </Text>
                    <Text style={[styles.coinPillSub, { fontFamily: fonts.body }]}>• EARN MORE</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[styles.editBtn, { borderColor: Colors.accent }]} 
                    onPress={() => navigation.navigate("EditProfile")}
                >
                    <Text style={[styles.editBtnText, { fontFamily: fonts.heading, color: Colors.accent }]}>EDIT PROFILE</Text>
                </TouchableOpacity>
            </LinearGradient>
        </View>

        <View style={styles.menuGrid}>
            {!user?.isPremium && (
                <TouchableOpacity 
                    style={styles.premiumBanner} 
                    onPress={() => navigation.navigate("Premium")}
                    activeOpacity={0.9}
                >
                    <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.bannerGradient} start={{x:0,y:0}} end={{x:1,y:1}}>
                        <Zap size={20} color={Colors.primary} fill={Colors.primary} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.bannerTitle, { color: Colors.primary, fontFamily: fonts.heading }]}>GO PREMIUM</Text>
                            <Text style={[styles.bannerSub, { color: Colors.primary, opacity: 0.8, fontFamily: fonts.body }]}>Unlimited access & early features</Text>
                        </View>
                        <ChevronRight size={18} color={Colors.primary} />
                    </LinearGradient>
                </TouchableOpacity>
            )}

            {/* WhatsApp Community Channel Banner */}
            <TouchableOpacity 
                style={styles.waCommunityBanner} 
                onPress={openWhatsAppChannel}
                activeOpacity={0.9}
            >
                <LinearGradient colors={['#25D366', '#128C7E']} style={styles.waBannerGradient} start={{x:0,y:0}} end={{x:1,y:1}}>
                    <MessageCircle size={22} color="#FFFFFF" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.waBannerTitle, { fontFamily: fonts.heading }]}>JOIN WHATSAPP CHANNEL</Text>
                            <View style={styles.waOfficialTag}><Text style={styles.waOfficialText}>OFFICIAL</Text></View>
                        </View>
                        <Text style={[styles.waBannerSub, { fontFamily: fonts.body }]}>Exclusive chapters, drop alerts & author chats</Text>
                    </View>
                    <ChevronRight size={18} color="#FFFFFF" />
                </LinearGradient>
            </TouchableOpacity>

            <MenuOption icon={Gift} title="Refer & Earn" subtitle="Invite friends & earn free Story Coins" onPress={() => navigation.navigate("Referral")} color="#D4AF37" />
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
  header: { width: '100%' },
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
  roleContainer: { flexDirection: 'row', alignItems: 'center' },
  premiumBadgeContainer: { marginLeft: 12, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  premiumBadgeText: { fontSize: 9, color: Colors.primary, letterSpacing: 1, fontWeight: 'bold' },
  coinPill: { marginTop: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#D4AF37', gap: 6 },
  coinPillText: { fontSize: 11, color: '#FFEDA8', letterSpacing: 1, fontWeight: 'bold' },
  coinPillSub: { fontSize: 9, color: 'rgba(255,237,168,0.7)', letterSpacing: 0.5 },
  premiumBanner: { marginBottom: 14, borderRadius: 16, overflow: 'hidden', elevation: 10, shadowColor: '#FFA500', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  bannerGradient: { padding: 18, flexDirection: 'row', alignItems: 'center' },
  bannerTitle: { fontSize: 14, letterSpacing: 1 },
  bannerSub: { fontSize: 11 },
  waCommunityBanner: { marginBottom: 14, borderRadius: 16, overflow: 'hidden', elevation: 6, shadowColor: '#25D366', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  waBannerGradient: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  waBannerTitle: { fontSize: 13, color: '#FFFFFF', letterSpacing: 1, fontWeight: 'bold' },
  waBannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  waOfficialTag: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  waOfficialText: { color: '#FFFFFF', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
  menuGrid: { padding: 24, marginTop: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12 },
  menuIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 15 },
  menuSubtitle: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 }
});
