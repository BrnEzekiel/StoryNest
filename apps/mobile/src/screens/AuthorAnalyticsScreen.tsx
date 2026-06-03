import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, BarChart3, TrendingUp, Heart, MessageSquare, BookOpen, ChevronRight } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export const AuthorAnalyticsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/analytics");
      setStats(res.data);
    } catch (error) { console.log(error); }
    finally { setLoading(false); }
  };

  const SummaryCard = ({ title, value, icon: Icon, color }: any) => (
      <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : Colors.white }, Shadows.s]}>
          <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}><Icon size={20} color={color} /></View>
          <View style={{ marginLeft: 16 }}>
              <Text style={[styles.summaryLabel, { fontFamily: fonts.body }]}>{title}</Text>
              <Text style={[styles.summaryValue, { color: theme.black, fontFamily: fonts.heading }]}>{value}</Text>
          </View>
      </View>
  );

  const totalReads = stats.reduce((acc, s) => acc + s.reads, 0);
  const totalLikes = stats.reduce((acc, s) => acc + s.likes, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><ArrowLeft size={24} color={Colors.accent} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>AUTHOR INSIGHTS</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.summaryGrid}>
              <SummaryCard title="Total Reads" value={totalReads} icon={BookOpen} color="#007AFF" />
              <SummaryCard title="Total Likes" value={totalLikes} icon={Heart} color="#E91E63" />
          </View>

          <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>STORY PERFORMANCE</Text>
              {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} /> : (
                  stats.map(s => (
                      <TouchableOpacity key={s.id} style={[styles.storyCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : Colors.paleGreen }]}>
                          <View style={styles.storyHeader}>
                              <Text style={[styles.storyTitle, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{s.title}</Text>
                              <View style={styles.trendBadge}><TrendingUp size={12} color="#34C759" /><Text style={styles.trendText}>+12%</Text></View>
                          </View>
                          <View style={styles.storyStats}>
                              <View style={styles.miniStat}><BookOpen size={14} color={Colors.mutedTeal} /><Text style={styles.miniStatText}>{s.reads}</Text></View>
                              <View style={styles.miniStat}><Heart size={14} color={Colors.mutedTeal} /><Text style={styles.miniStatText}>{s.likes}</Text></View>
                              <View style={styles.miniStat}><MessageSquare size={14} color={Colors.mutedTeal} /><Text style={styles.miniStatText}>{s.comments}</Text></View>
                          </View>
                          <View style={[styles.progressBarBg, { backgroundColor: theme.primary + '10' }]}><View style={[styles.progressBarFill, { width: '75%', backgroundColor: theme.primary }]} /></View>
                          <Text style={styles.retentionText}>75% Reader Retention</Text>
                      </TouchableOpacity>
                  ))
              )}
          </View>

          <View style={[styles.proTip, { backgroundColor: theme.primary + '05' }]}>
              <BarChart3 size={24} color={theme.primary} />
              <Text style={[styles.proTipText, { fontFamily: fonts.body }]}>Stories with consistent chapter updates (every 3 days) see 40% more engagement in the first month.</Text>
          </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 24, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  headerTitle: { fontSize: 18, color: Colors.accent, letterSpacing: 1 },
  backBtn: { marginRight: 20 },
  content: { flex: 1 },
  summaryGrid: { padding: 24, flexDirection: 'row', justifyContent: 'space-between' },
  summaryCard: { width: '48%', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 11, color: Colors.mutedTeal },
  summaryValue: { fontSize: 18, marginTop: 2 },
  section: { paddingHorizontal: 24, marginTop: 10 },
  sectionTitle: { fontSize: 12, letterSpacing: 1.5, marginBottom: 20 },
  storyCard: { padding: 20, borderRadius: 24, marginBottom: 16 },
  storyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  storyTitle: { fontSize: 16, flex: 1 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52,199,89,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trendText: { fontSize: 10, color: '#34C759', marginLeft: 4, fontWeight: '700' },
  storyStats: { flexDirection: 'row', marginBottom: 20 },
  miniStat: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  miniStatText: { fontSize: 13, color: Colors.mutedTeal, marginLeft: 6 },
  progressBarBg: { height: 6, borderRadius: 3, width: '100%', marginBottom: 8 },
  progressBarFill: { height: '100%', borderRadius: 3 },
  retentionText: { fontSize: 10, color: Colors.mutedTeal, textAlign: 'right' },
  proTip: { margin: 24, padding: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  proTipText: { flex: 1, marginLeft: 16, fontSize: 12, color: Colors.mutedTeal, lineHeight: 18 }
});
