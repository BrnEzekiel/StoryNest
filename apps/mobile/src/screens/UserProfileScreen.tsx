import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
} from "react-native";
import { useNotice } from "../context/NoticeContext";
import { Colors, Shadows } from "../theme/colors";
import {
  ArrowLeft,
  UserPlus,
  UserCheck,
  BookOpen,
  Flame,
  Mail,
  Trophy,
  Share2,
  Ban,
  Flag,
} from "lucide-react-native";
import { ReportSheet } from "../components/ReportSheet";
import apiClient from "../api/apiClient";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { Cache } from "../utils/Cache";
import { checkLimit, tapThrottle, LIMITS, TAP_GAP_MS } from "../utils/rateLimit";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

export const UserProfileScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { userId } = route.params;
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();

  const profileQuery = useCachedQuery<any>(`users:profile:${userId}`, async () => {
    const res = await apiClient.get(`/users/${userId}/profile`);
    return res.data;
  });
  const profile = profileQuery.data;

  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const handleBlock = async () => {
    if (!tapThrottle(`block:${userId}`, TAP_GAP_MS)) return;
    const next = !isBlocked;
    setIsBlocked(next);
    try {
      const res = await apiClient.post(`/users/${userId}/block`);
      setIsBlocked(res.data.isBlocked);
      showNotice({ title: res.data.isBlocked ? "Blocked" : "Unblocked", message: res.data.isBlocked ? "You will no longer see their comments." : "User unblocked.", variant: "info" });
    } catch (e) {
      setIsBlocked(!next);
      showNotice({ title: "Error", message: "Could not update block.", variant: "error" });
    }
  };

  useEffect(() => {
    if (profile) setIsFollowing(Boolean(profile.isFollowing));
  }, [profile?.isFollowing]);

  const handleFollow = async () => {
    if (!tapThrottle(`follow:${userId}`, TAP_GAP_MS)) return;
    const verdict = checkLimit(`follow:${userId}`, LIMITS.follow.max, LIMITS.follow.windowMs);
    if (!verdict.allowed) return;
    const next = !isFollowing;
    setIsFollowing(next);
    if (profile) Cache.set(`users:profile:${userId}`, { ...profile, isFollowing: next }).catch(() => {});
    try {
      await apiClient.post(`/users/${userId}/follow`);
    } catch (e) {
      setIsFollowing(!next);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Follow ${profile?.username || "this author"} on StoryNest`,
        title: "StoryNest",
      });
    } catch (e) {
      showNotice({ title: "Share", message: "Could not open share sheet", variant: "error" });
    }
  };

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.white, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: Colors.mutedTeal }}>Opening profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <LinearGradient
            colors={[Colors.primary, "#004D46"]}
            style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
          >
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft size={24} color={Colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
              <Share2 size={20} color={Colors.accent} />
            </TouchableOpacity>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarContainer}>
                {profile.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + "20" }]}>
                    <Text style={styles.avatarText}>
                      {(profile.username || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={[styles.username, { fontFamily: fonts.heading, color: Colors.white }]}>
              {profile.username}
            </Text>
            <Text style={[styles.bio, { fontFamily: fonts.body, color: Colors.paleGreen }]}>
              {profile.bio || "Searching for the next great story..."}
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: theme.primary, fontFamily: fonts.heading }]}>
              {profile._count?.followers || 0}
            </Text>
            <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>Followers</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.primary + "20" }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: theme.primary, fontFamily: fonts.heading }]}>
              {profile.xp || 0}
            </Text>
            <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>XP</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.primary + "20" }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: theme.primary, fontFamily: fonts.heading }]}>
              {profile._count?.following || 0}
            </Text>
            <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>Following</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.followBtn,
              isFollowing && styles.followingBtn,
              { backgroundColor: isFollowing ? theme.primary + "20" : theme.primary },
            ]}
            onPress={handleFollow}
          >
            {isFollowing ? (
              <UserCheck size={18} color={theme.primary} />
            ) : (
              <UserPlus size={18} color={theme.white} />
            )}
            <Text
              style={[
                styles.followBtnText,
                { color: isFollowing ? theme.primary : theme.white, fontFamily: fonts.heading },
              ]}
            >
              {isFollowing ? "SUBSCRIBED" : "SUBSCRIBE"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.messageBtn,
              { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen },
            ]}
            onPress={() => navigation.navigate("Messages", { targetUser: profile })}
          >
            <Mail size={18} color={theme.primary} />
            <Text style={[styles.messageBtnText, { color: theme.primary, fontFamily: fonts.heading }]}>
              MESSAGE
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.messageBtn, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}
            onPress={handleBlock}
          >
            <Ban size={18} color={isBlocked ? Colors.error : theme.primary} />
            <Text style={[styles.messageBtnText, { color: isBlocked ? Colors.error : theme.primary, fontFamily: fonts.heading }]}>
              {isBlocked ? "UNBLOCK" : "BLOCK"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.messageBtn, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}
            onPress={() => setShowReport(true)}
          >
            <Flag size={18} color={theme.primary} />
            <Text style={[styles.messageBtnText, { color: theme.primary, fontFamily: fonts.heading }]}>
              REPORT
            </Text>
          </TouchableOpacity>
        </View>

        <ReportSheet
          visible={showReport}
          onClose={() => setShowReport(false)}
          targetType="user"
          targetId={userId}
          targetTitle={profile?.username}
        />

        <Text style={[styles.hint, { fontFamily: fonts.body }]}>
          Subscribe is free follow. Nest Plus unlocks premium perks.
        </Text>

        <TouchableOpacity
          style={styles.plusLink}
          onPress={() => navigation.navigate("Premium")}
        >
          <Text style={[styles.plusText, { fontFamily: fonts.heading, color: theme.primary }]}>
            UPGRADE TO NEST PLUS
          </Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>
            ACHIEVEMENTS
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24 }}
          >
            <View style={[styles.badge, { backgroundColor: "#FFD70020" }]}>
              <Trophy size={20} color="#FFD700" />
              <Text style={styles.badgeText}>Early Bird</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#FF950020" }]}>
              <Flame size={20} color="#FF9500" />
              <Text style={styles.badgeText}>7 Day Streak</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#5856D620" }]}>
              <BookOpen size={20} color="#5856D6" />
              <Text style={styles.badgeText}>10 Books Read</Text>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { overflow: "hidden" },
  headerGradient: { paddingBottom: 40, alignItems: "center" },
  backBtn: { position: "absolute", left: 24, top: 48, zIndex: 2 },
  shareBtn: { position: "absolute", right: 24, top: 48, zIndex: 2 },
  avatarWrapper: { marginBottom: 16 },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: Colors.accent,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  avatar: { width: "100%", height: "100%", borderRadius: 45 },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32, color: Colors.accent },
  username: { fontSize: 24, marginBottom: 8 },
  bio: { fontSize: 13, textAlign: "center", paddingHorizontal: 40, opacity: 0.9 },
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 24,
    marginHorizontal: 24,
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginTop: -30,
    ...Shadows.m,
  },
  statBox: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 18 },
  statLabel: { fontSize: 10, color: Colors.mutedTeal, textTransform: "uppercase", marginTop: 2 },
  statDivider: { width: 1, height: 30 },
  actionRow: { flexDirection: "row", paddingHorizontal: 24, marginTop: 24 },
  followBtn: {
    flex: 1.5,
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  followingBtn: { borderWidth: 1.5, borderColor: "rgba(0,54,49,0.1)" },
  followBtnText: { marginLeft: 10, fontSize: 13, letterSpacing: 1 },
  messageBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  messageBtnText: { marginLeft: 10, fontSize: 13, letterSpacing: 1 },
  hint: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.mutedTeal,
    marginTop: 12,
    paddingHorizontal: 32,
  },
  plusLink: { alignItems: "center", marginTop: 16 },
  plusText: { fontSize: 12, letterSpacing: 1 },
  section: { marginTop: 32 },
  sectionTitle: { fontSize: 12, letterSpacing: 1.5, marginLeft: 24, marginBottom: 16 },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginRight: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeText: { marginLeft: 8, fontSize: 12, fontWeight: "600" },
});
