import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Dimensions, Animated } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, UserPlus, UserCheck, MessageSquare, Zap, Trophy, BookOpen, Flame, Mail, Globe } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useTheme } from "../context/ThemeContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export const UserProfileScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { userId } = route.params;
  const { theme, fonts, isDarkMode } = useTheme();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/users/${userId}/profile`);
      setProfile(res.data);
      // Check if following (this logic would normally come from backend)
      setIsFollowing(false); 
    } catch (error) { console.log(error); }
    finally { setLoading(false); }
  };

  const handleFollow = async () => {
      setIsFollowing(!isFollowing);
      try {
          await apiClient.post(`/users/${userId}/follow`);
      } catch (e) { setIsFollowing(isFollowing); }
  };

  if (loading || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.white, justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
            <LinearGradient colors={[Colors.primary, "#004D46"]} style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={Colors.accent} />
                </TouchableOpacity>
                <View style={styles.avatarWrapper}>
                    <View style={styles.avatarContainer}>
                        {profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '20' }]}><Text style={styles.avatarText}>{profile.username[0].toUpperCase()}</Text></View>}
                    </View>
                    <View style={styles.statusDot} />
                </View>
                <Text style={[styles.username, { fontFamily: fonts.heading, color: Colors.white }]}>{profile.username}</Text>
                <Text style={[styles.bio, { fontFamily: fonts.body, color: Colors.paleGreen }]}>{profile.bio || "Searching for the next great story..."}</Text>
            </LinearGradient>
        </View>

        <View style={styles.statsBar}>
            <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: theme.primary, fontFamily: fonts.heading }]}>{profile._count?.followers || 0}</Text>
                <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>Followers</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.primary + '20' }]} />
            <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: theme.primary, fontFamily: fonts.heading }]}>{profile.xp || 0}</Text>
                <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>XP</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.primary + '20' }]} />
            <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: theme.primary, fontFamily: fonts.heading }]}>{profile._count?.following || 0}</Text>
                <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>Following</Text>
            </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.followBtn, isFollowing && styles.followingBtn, { backgroundColor: isFollowing ? theme.primary + '20' : theme.primary }]} 
            onPress={handleFollow}
          >
            {isFollowing ? <UserCheck size={18} color={theme.primary} /> : <UserPlus size={18} color={theme.white} />}
            <Text style={[styles.followBtnText, { color: isFollowing ? theme.primary : theme.white, fontFamily: fonts.heading }]}>
              {isFollowing ? "FOLLOWING" : "FOLLOW"}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.messageBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : Colors.paleGreen }]}
            onPress={() => navigation.navigate("Messages", { targetUser: profile })}
          >
            <Mail size={18} color={theme.primary} />
            <Text style={[styles.messageBtnText, { color: theme.primary, fontFamily: fonts.heading }]}>MESSAGE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>ACHIEVEMENTS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                <View style={[styles.badge, { backgroundColor: '#FFD70020' }]}><Trophy size={20} color="#FFD700" /><Text style={styles.badgeText}>Early Bird</Text></View>
                <View style={[styles.badge, { backgroundColor: '#FF950020' }]}><Flame size={20} color="#FF9500" /><Text style={styles.badgeText}>7 Day Streak</Text></View>
                <View style={[styles.badge, { backgroundColor: '#5856D620' }]}><BookOpen size={20} color="#5856D6" /><Text style={styles.badgeText}>10 Books Read</Text></View>
            </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { overflow: 'hidden' },
  headerGradient: { paddingBottom: 40, alignItems: 'center' },
  backBtn: { position: 'absolute', left: 24, top: 40 },
  avatarWrapper: { marginBottom: 16 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: Colors.accent, padding: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  avatar: { width: '100%', height: '100%', borderRadius: 45 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, color: Colors.accent },
  statusDot: { position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#34C759', borderWidth: 3, borderColor: Colors.primary },
  username: { fontSize: 24, marginBottom: 8 },
  bio: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40, opacity: 0.9 },
  statsBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 24, marginHorizontal: 24, backgroundColor: Colors.white, borderRadius: 20, marginTop: -30, ...Shadows.m },
  statBox: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 18 },
  statLabel: { fontSize: 10, color: Colors.mutedTeal, textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, height: 30 },
  actionRow: { flexDirection: 'row', paddingHorizontal: 24, marginTop: 24 },
  followBtn: { flex: 1.5, height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  followBtnText: { marginLeft: 10, fontSize: 14, letterSpacing: 1 },
  messageBtn: { flex: 1, height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  messageBtnText: { marginLeft: 10, fontSize: 14, letterSpacing: 1 },
  section: { marginTop: 32 },
  sectionTitle: { fontSize: 12, letterSpacing: 1.5, marginLeft: 24, marginBottom: 16 },
  badge: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginRight: 12, flexDirection: 'row', alignItems: 'center' },
  badgeText: { marginLeft: 8, fontSize: 12, fontWeight: '600' }
});
