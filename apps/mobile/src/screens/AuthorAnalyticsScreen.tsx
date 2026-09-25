import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Animated } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, BarChart3, TrendingUp, Heart, MessageSquare, BookOpen, ChevronRight, Zap, Target, Award, Users } from "lucide-react-native";
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

  const SummaryCard = ({ title, value, icon: Icon, color, delay, trend }: any) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    
    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            delay,
            useNativeDriver: true
        }).start();
    }, []);

    return (
        <Animated.View style={[styles.summaryCard, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
            <LinearGradient 
                colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']} 
                style={styles.cardGradient}
            >
                <View style={[styles.iconGlow, { backgroundColor: color + '20', shadowColor: color, shadowOpacity: 0.5, shadowRadius: 10 }]}>
                    <Icon size={22} color={color} />
                </View>
                <Text style={[styles.summaryLabel, { fontFamily: fonts.body }]}>{title.toUpperCase()}</Text>
                <Text style={[styles.summaryValue, { color: Colors.accent, fontFamily: fonts.heading }]}>{value}</Text>
                <View style={styles.trendIndicator}>
                    <TrendingUp size={12} color="#34C759" />
                    <Text style={styles.trendText}>{trend || "+0%"}</Text>
                </View>
            </LinearGradient>
        </Animated.View>
    );
  };

  const totalReads = stats.reduce((acc, s) => acc + s.reads, 0);
  const totalLikes = stats.reduce((acc, s) => acc + s.likes, 0);
  const avgTrend = stats.length > 0 ? stats[0].trend : "+0%";

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient 
        colors={['#001a18', '#000807']} 
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>AUTHOR INSIGHTS</Text>
            <View style={styles.liveIndicator}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveText}>LIVE METRICS</Text>
            </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchAnalytics}>
            <Zap size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={styles.summaryGrid}>
              <SummaryCard title="Total Readers" value={totalReads} icon={Users} color="#4FACFE" delay={0} trend={avgTrend} />
              <SummaryCard title="Appreciation" value={totalLikes} icon={Heart} color="#F093FB" delay={200} trend={avgTrend} />
          </View>

          <View style={styles.section}>
              <View style={styles.sectionHeader}>
                  <Target size={18} color={Colors.accent} />
                  <Text style={[styles.sectionTitle, { fontFamily: fonts.heading }]}>MISSION PERFORMANCE</Text>
              </View>

              {loading ? (
                  [1,2,3].map(i => <View key={i} style={styles.skeletonCard} />)
              ) : (
                  stats.length === 0 ? (
                      <View style={styles.emptyState}>
                          <BookOpen size={48} color="rgba(255,237,168,0.1)" />
                          <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No stories published yet.</Text>
                      </View>
                  ) : (
                      stats.map((s, idx) => (
                        <View key={s.id} style={styles.performanceCard}>
                            <LinearGradient 
                                colors={['rgba(0, 54, 49, 0.4)', 'rgba(0, 54, 49, 0.1)']} 
                                style={styles.performanceGradient}
                            >
                                <View style={styles.perfHeader}>
                                    <Text style={[styles.perfTitle, { color: Colors.white, fontFamily: fonts.heading }]} numberOfLines={1}>{s.title.toUpperCase()}</Text>
                                    <TouchableOpacity><ChevronRight size={18} color={Colors.accent} /></TouchableOpacity>
                                </View>
                                
                                <View style={styles.perfStatsRow}>
                                    <View style={styles.perfStat}>
                                        <Text style={styles.perfStatLabel}>READS</Text>
                                        <Text style={[styles.perfStatValue, { color: Colors.accent }]}>{s.reads}</Text>
                                    </View>
                                    <View style={styles.perfStat}>
                                        <Text style={styles.perfStatLabel}>ENGAGEMENT</Text>
                                        <Text style={[styles.perfStatValue, { color: Colors.accent }]}>{s.likes + s.comments}</Text>
                                    </View>
                                    <View style={styles.perfStat}>
                                        <Text style={styles.perfStatLabel}>RETENTION</Text>
                                        <Text style={[styles.perfStatValue, { color: '#34C759' }]}>{s.retention}</Text>
                                    </View>
                                </View>

                                <View style={styles.chartContainer}>
                                    <View style={styles.chartTrack}>
                                        <View style={[styles.chartFill, { width: s.retention, backgroundColor: Colors.accent }]} />
                                    </View>
                                </View>
                            </LinearGradient>
                        </View>
                      ))
                  )
              )}
          </View>

          <View style={styles.proTipContainer}>
              <LinearGradient 
                colors={['rgba(255, 237, 168, 0.15)', 'rgba(255, 237, 168, 0.05)']} 
                style={styles.proTipGradient}
              >
                  <Award size={28} color={Colors.accent} />
                  <View style={styles.proTipContent}>
                      <Text style={[styles.proTipTitle, { fontFamily: fonts.heading }]}>NESTRADAR ADVICE</Text>
                      <Text style={[styles.proTipText, { fontFamily: fonts.body }]}>
                          Deploying new chapters at 7:00 PM EST increases initial blast radius by 25%.
                      </Text>
                  </View>
              </LinearGradient>
          </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
      flexDirection: "row", 
      alignItems: "center", 
      justifyContent: 'space-between',
      paddingHorizontal: 24, 
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 237, 168, 0.1)'
  },
  headerInfo: { alignItems: 'center' },
  headerTitle: { fontSize: 16, color: Colors.accent, letterSpacing: 2 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30', marginRight: 6 },
  liveText: { fontSize: 10, color: '#FF3B30', fontWeight: 'bold', letterSpacing: 1 },
  backBtn: { padding: 8 },
  refreshBtn: { padding: 8 },
  content: { flex: 1 },
  summaryGrid: { padding: 20, flexDirection: 'row', justifyContent: 'space-between' },
  summaryCard: { width: '48%', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardGradient: { padding: 20 },
  iconGlow: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  summaryLabel: { fontSize: 10, color: Colors.mutedTeal, letterSpacing: 1 },
  summaryValue: { fontSize: 28, marginVertical: 4 },
  trendIndicator: { flexDirection: 'row', alignItems: 'center' },
  trendText: { fontSize: 11, color: '#34C759', marginLeft: 4, fontWeight: 'bold' },
  section: { paddingHorizontal: 20, marginTop: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 12, letterSpacing: 2, color: Colors.accent, marginLeft: 10 },
  performanceCard: { borderRadius: 24, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0, 54, 49, 0.5)' },
  performanceGradient: { padding: 24 },
  perfHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  perfTitle: { fontSize: 14, letterSpacing: 1, flex: 1 },
  perfStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  perfStat: { alignItems: 'flex-start' },
  perfStatLabel: { fontSize: 9, color: Colors.mutedTeal, letterSpacing: 1, marginBottom: 4 },
  perfStatValue: { fontSize: 18, fontWeight: 'bold' },
  chartContainer: { height: 4, width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2 },
  chartTrack: { flex: 1 },
  chartFill: { height: '100%', borderRadius: 2 },
  skeletonCard: { height: 140, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 16 },
  proTipContainer: { margin: 20, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,237,168,0.2)' },
  proTipGradient: { padding: 24, flexDirection: 'row', alignItems: 'center' },
  proTipContent: { flex: 1, marginLeft: 20 },
  proTipTitle: { fontSize: 12, color: Colors.accent, letterSpacing: 1, marginBottom: 4 },
  proTipText: { fontSize: 13, color: Colors.white, lineHeight: 20, opacity: 0.8 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: Colors.mutedTeal, marginTop: 16, fontSize: 14 }
});
