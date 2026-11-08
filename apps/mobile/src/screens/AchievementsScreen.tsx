import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Colors } from "../theme/colors";
import { ArrowLeft, Award, Lock, BookOpen, Flame, Trophy, Zap, Clock, Target, Gift } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useTheme } from "../context/ThemeContext";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const ICONS: Record<string, any> = { BookOpen, Zap, Flame, Trophy, Clock, Target, Award, Gift };
const COLORS = ["#FF9500", "#5856D6", "#FFCC00", "#F093FB", "#34C759", "#4FACFE", "#FF2D55"];

export const AchievementsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme, fonts } = useTheme();

  const achQuery = useCachedQuery<any>("gamification:achievements", async () => {
    const res = await apiClient.get("/gamification/achievements");
    return res.data;
  });
  const catalog = achQuery.data?.catalog || [];
  const unlockedCount = catalog.filter((c: any) => c.unlocked).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>ACHIEVEMENTS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={achQuery.refreshing} onRefresh={() => achQuery.refresh({ showIndicator: true })} tintColor={Colors.accent} />}
      >
        <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { fontFamily: fonts.heading }]}>{unlockedCount}/{catalog.length}</Text>
            <Text style={[styles.summaryLabel, { fontFamily: fonts.heading }]}>NEST BADGES EARNED</Text>
        </View>

        <View style={styles.grid}>
            {catalog.map((ach: any, i: number) => {
                const Icon = ICONS[ach.icon] || Award;
                const color = COLORS[i % COLORS.length];
                return (
                    <View key={ach.title} style={[styles.achCard, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : Colors.white }, !ach.unlocked && { opacity: 0.6 }]}>
                        <View style={[styles.iconBox, { backgroundColor: ach.unlocked ? color + '15' : 'rgba(0,0,0,0.05)' }]}>
                            {ach.unlocked ? <Icon size={32} color={color} /> : <Lock size={24} color={Colors.mutedTeal} />}
                        </View>
                        <Text style={[styles.achTitle, { color: isDarkMode ? Colors.white : Colors.primary, fontFamily: fonts.heading }]}>{ach.title}</Text>
                        <Text style={[styles.achDesc, { fontFamily: fonts.body }]}>{ach.desc}</Text>
                        {ach.unlocked ? (
                            <View style={styles.unlockedBadge}>
                                <Text style={[styles.unlockedText, { fontFamily: fonts.heading }]}>UNLOCKED</Text>
                            </View>
                        ) : (
                            <View style={styles.lockedBadge}>
                                <Text style={[styles.lockedText, { fontFamily: fonts.heading }]}>LOCKED</Text>
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
        {catalog.length === 0 && !achQuery.isFirstLoad && (
          <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>Could not load achievements.</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, color: Colors.accent, letterSpacing: 2, flex: 1, textAlign: "center" },
  summaryCard: { backgroundColor: Colors.primary, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 20 },
  summaryValue: { fontSize: 36, color: Colors.accent },
  summaryLabel: { fontSize: 11, color: Colors.mutedTeal, letterSpacing: 2, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  achCard: { width: "48%", borderRadius: 18, padding: 16, marginBottom: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" },
  iconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  achTitle: { fontSize: 14, textAlign: "center" },
  achDesc: { fontSize: 11, color: Colors.mutedTeal, textAlign: "center", marginTop: 4, lineHeight: 16 },
  unlockedBadge: { marginTop: 10, backgroundColor: "rgba(52,199,89,0.12)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  unlockedText: { fontSize: 10, color: "#34C759", letterSpacing: 1 },
  lockedBadge: { marginTop: 10, backgroundColor: "rgba(0,0,0,0.05)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  lockedText: { fontSize: 10, color: Colors.mutedTeal, letterSpacing: 1 },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 24 },
});
