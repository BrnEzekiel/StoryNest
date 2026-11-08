import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useNotice } from "../context/NoticeContext";
import { Colors } from "../theme/colors";
import { ArrowLeft, Target, Gift, CheckCircle2, Crown } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { ActivityLog } from "../utils/activityLog";
import { tapThrottle, TAP_GAP_MS } from "../utils/rateLimit";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const SEASON_GOAL = 8;
const SEASON_REWARD = 100;

export const ChallengesScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();

  const [seasonReads, setSeasonReads] = useState(0);
  const [claiming, setClaiming] = useState<string | null>(null);

  const challengesQuery = useCachedQuery<any[]>("gamification:challenges", async () => {
    const res = await apiClient.get("/gamification/challenges");
    return res.data;
  });
  const achievementsQuery = useCachedQuery<any>("gamification:achievements-mini", async () => {
    const res = await apiClient.get("/gamification/achievements");
    return res.data;
  });

  const challenges = challengesQuery.data || [];
  const unlockedTitles = new Set((achievementsQuery.data?.catalog || []).filter((c: any) => c.unlocked).map((c: any) => c.title));

  const now = new Date();
  const seasonKey = `season:${now.getFullYear()}-${now.getMonth() + 1}`;
  const seasonName = now.toLocaleString("default", { month: "long" });
  const seasonClaimed = unlockedTitles.has(seasonKey);
  const seasonComplete = seasonReads >= SEASON_GOAL;

  useFocusEffect(useCallback(() => {
    (async () => {
      const journal: any[] = await ActivityLog.list();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      setSeasonReads(journal.filter((e) => e.kind === "READ" && (e.ts || 0) >= monthStart).length);
    })();
    challengesQuery.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const handleClaim = async (key: string, coins: number, title: string) => {
    if (claiming || !tapThrottle(`claim:${key}`, TAP_GAP_MS)) return;
    setClaiming(key);
    try {
      const res = await apiClient.post("/gamification/claim", { key, coins, title });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showNotice({ title: "Reward claimed", message: `+${coins} coins. Balance: ${res.data.coins}.`, variant: "success" });
      challengesQuery.refresh();
      achievementsQuery.refresh();
      refreshUser();
    } catch (e: any) {
      showNotice({ title: "Not yet", message: e.response?.data?.error || "Could not claim.", variant: "info" });
    } finally { setClaiming(null); }
  };

  const renderProgress = (progress: number, goal: number) => (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(100, Math.round((progress / goal) * 100))}%` }]} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>CHALLENGES</Text>
        <View style={{ width: 24, marginLeft: 16 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={challengesQuery.refreshing} onRefresh={() => challengesQuery.refresh({ showIndicator: true })} tintColor={Colors.accent} />}
      >
        <View style={[styles.seasonCard, { backgroundColor: theme.primary }]}>
          <View style={styles.seasonTop}>
            <Crown size={20} color={Colors.accent} />
            <Text style={[styles.seasonTitle, { fontFamily: fonts.heading }]}>{seasonName.toUpperCase()} SEASON PASS</Text>
          </View>
          <Text style={[styles.seasonDesc, { fontFamily: fonts.body }]}>Read {SEASON_GOAL} stories this month for {SEASON_REWARD} coins.</Text>
          {renderProgress(seasonReads, SEASON_GOAL)}
          <Text style={[styles.seasonProgress, { fontFamily: fonts.body }]}>{Math.min(seasonReads, SEASON_GOAL)}/{SEASON_GOAL} stories</Text>
          {seasonClaimed ? (
            <View style={styles.claimedRow}><CheckCircle2 size={16} color="#34C759" /><Text style={[styles.claimedText, { fontFamily: fonts.heading }]}>CLAIMED</Text></View>
          ) : (
            <TouchableOpacity
              style={[styles.claimBtn, { backgroundColor: Colors.accent, opacity: seasonComplete ? 1 : 0.4 }]}
              disabled={!seasonComplete || claiming === seasonKey}
              onPress={() => handleClaim(seasonKey, SEASON_REWARD, `${seasonName} Season Pass`)}
            >
              <Gift size={16} color={Colors.primary} />
              <Text style={[styles.claimText, { fontFamily: fonts.heading }]}>{claiming === seasonKey ? "CLAIMING..." : `CLAIM ${SEASON_REWARD} COINS`}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.sectionTitle, { fontFamily: fonts.heading, color: theme.primary }]}>THIS WEEK</Text>
        {challenges.map((c: any) => (
          <View key={c.id} style={[styles.chRow, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : Colors.white, borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
            <View style={[styles.chIcon, { backgroundColor: theme.primary + "15" }]}>
              <Target size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.chTitle, { color: theme.black, fontFamily: fonts.heading }]}>{c.title}</Text>
              <Text style={[styles.chDesc, { fontFamily: fonts.body }]}>{c.desc}</Text>
              {renderProgress(c.progress, c.goal)}
              <Text style={[styles.chProgress, { fontFamily: fonts.body }]}>{c.progress}/{c.goal} • {c.reward} coins</Text>
            </View>
            {c.claimed ? (
              <CheckCircle2 size={22} color="#34C759" />
            ) : (
              <TouchableOpacity
                style={[styles.miniClaim, { backgroundColor: theme.primary, opacity: c.complete ? 1 : 0.35 }]}
                disabled={!c.complete || claiming === c.id}
                onPress={() => handleClaim(c.id, c.reward, c.title)}
              >
                <Text style={[styles.miniClaimText, { fontFamily: fonts.heading }]}>{claiming === c.id ? "..." : "CLAIM"}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {challenges.length === 0 && (
          <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>Loading challenges...</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 24, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  headerTitle: { fontSize: 18, color: Colors.accent, letterSpacing: 1, flex: 1, textAlign: "center" },
  backBtn: { marginRight: 16 },
  content: { flex: 1, padding: 24 },
  seasonCard: { borderRadius: 20, padding: 20, marginBottom: 24 },
  seasonTop: { flexDirection: "row", alignItems: "center" },
  seasonTitle: { fontSize: 15, color: Colors.accent, letterSpacing: 1, marginLeft: 10 },
  seasonDesc: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 8 },
  seasonProgress: { fontSize: 12, color: Colors.accent, marginTop: 8 },
  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)", marginTop: 12, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: Colors.accent, borderRadius: 4 },
  claimBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 14, marginTop: 16 },
  claimText: { fontSize: 12, color: Colors.primary, letterSpacing: 1, marginLeft: 8 },
  claimedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16 },
  claimedText: { fontSize: 12, color: "#34C759", letterSpacing: 1, marginLeft: 6 },
  sectionTitle: { fontSize: 13, letterSpacing: 1.5, marginBottom: 12 },
  chRow: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  chIcon: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  chTitle: { fontSize: 15 },
  chDesc: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 },
  chProgress: { fontSize: 11, color: Colors.mutedTeal, marginTop: 6 },
  miniClaim: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginLeft: 10 },
  miniClaimText: { fontSize: 11, color: Colors.accent, letterSpacing: 1 },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 30 },
});
