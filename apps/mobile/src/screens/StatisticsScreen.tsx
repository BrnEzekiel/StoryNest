import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, TrendingUp, Calendar, Clock, BarChart2, Zap, Target, Award, Rocket, Snowflake } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useNotice } from "../context/NoticeContext";
import apiClient from "../api/apiClient";
import { levelForXp } from "../utils/levels";
import { Svg, Circle } from "react-native-svg";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export const StatisticsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const { user, refreshUser } = useAuth();
  const { showNotice } = useNotice();
  const [freezing, setFreezing] = useState(false);
  const level = levelForXp(user?.xp || 0);
  const goalProgress = Math.min(1, (user?.todayReadTime || 0) / (user?.dailyGoalMinutes || 30));

  const handleFreeze = async () => {
    if (freezing) return;
    setFreezing(true);
    try {
      const res = await apiClient.post("/gamification/streak-freeze");
      refreshUser();
      showNotice({ title: "Streak frozen", message: `${res.data.streak}-day streak saved. Balance: ${res.data.coins} coins.`, variant: "success" });
    } catch (e: any) {
      showNotice({ title: "Freeze unavailable", message: e.response?.data?.error || "Could not freeze.", variant: "info" });
    } finally { setFreezing(false); }
  };

  const GoalRing = () => {
    const size = 120;
    const stroke = 10;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={Colors.accent} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c}`} strokeDashoffset={c * (1 - goalProgress)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
    );
  };

  const StatCard = ({ icon: Icon, title, value, sub, color, delay }: any) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            delay,
            useNativeDriver: true
        }).start();
    }, []);

    return (
        <Animated.View style={[styles.statCard, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
            <LinearGradient 
                colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']} 
                style={styles.cardGradient}
            >
                <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
                    <Icon size={20} color={color} />
                </View>
                <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>{title}</Text>
                <Text style={[styles.statValue, { color: Colors.accent, fontFamily: fonts.heading }]}>{value}</Text>
                <Text style={[styles.statSub, { fontFamily: fonts.body }]}>{sub}</Text>
            </LinearGradient>
        </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#001a18', '#000807']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>READING INSIGHTS</Text>
            <View style={styles.liveIndicator}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveText}>SYSTEM STATUS: ACTIVE</Text>
            </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn}><Rocket size={20} color={Colors.accent} /></TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        
        <View style={styles.mainGrid}>
            <StatCard 
                icon={Clock} 
                title="TIME INVESTED" 
                value={`${user?.totalReadTime || 0}m`} 
                sub="Total story time"
                color="#4FACFE"
                delay={0}
            />
            <StatCard 
                icon={Target} 
                title="DAILY GOAL" 
                value={`${Math.round(((user?.todayReadTime || 0) / (user?.dailyGoalMinutes || 30)) * 100)}%`} 
                sub={`${user?.todayReadTime || 0}m of ${user?.dailyGoalMinutes || 30}m`}
                color="#34C759"
                delay={100}
            />
            <StatCard 
                icon={Zap} 
                title="WISDOM EARNED" 
                value={`${user?.xp || 0}`} 
                sub="Total experience points"
                color="#F093FB"
                delay={200}
            />
            <StatCard 
                icon={Calendar} 
                title="LONGEST STREAK" 
                value={`${user?.streakCount || 0} Days`} 
                sub="Consecutive reading"
                color="#FF2D55"
                delay={300}
            />
        </View>

        <View style={styles.goalRow}>
            <View style={styles.ringBox}>
                <GoalRing />
                <Text style={[styles.ringLabel, { fontFamily: fonts.heading }]}>{user?.todayReadTime || 0}/{user?.dailyGoalMinutes || 30}m</Text>
            </View>
            <View style={styles.levelBox}>
                <Text style={[styles.levelName, { fontFamily: fonts.heading }]}>LVL {level.level} • {level.name.toUpperCase()}</Text>
                <View style={styles.levelTrack}><View style={[styles.levelFill, { width: `${Math.round(level.progress * 100)}%` }]} /></View>
                <Text style={[styles.levelSub, { fontFamily: fonts.body }]}>{user?.xp || 0} XP</Text>
                <TouchableOpacity style={styles.freezeBtn} onPress={handleFreeze} disabled={freezing}>
                    <Snowflake size={16} color={Colors.accent} />
                    <Text style={[styles.freezeText, { fontFamily: fonts.heading }]}>{freezing ? "FREEZING..." : "FREEZE STREAK • 50"}</Text>
                </TouchableOpacity>
            </View>
        </View>

        <View style={styles.chartWrapper}>
            <LinearGradient 
                colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)']} 
                style={styles.chartGradient}
            >
                <View style={styles.chartHeader}>
                    <BarChart2 size={18} color={Colors.accent} />
                    <Text style={[styles.chartTitle, { fontFamily: fonts.heading, color: Colors.accent }]}>NEURAL ACTIVITY LOG</Text>
                </View>
                
                <View style={styles.barsRow}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                        const h = Math.random() * 100 + 20;
                        return (
                            <View key={i} style={styles.barCol}>
                                <View style={styles.barBg}>
                                    <LinearGradient
                                        colors={[Colors.accent, Colors.accent + '20']}
                                        style={[styles.barFill, { height: i === 2 ? 80 : h }]}
                                    />
                                </View>
                                <Text style={[styles.barDay, { fontFamily: fonts.body }]}>{day}</Text>
                            </View>
                        );
                    })}
                </View>
            </LinearGradient>
        </View>

        <View style={styles.quoteWrapper}>
            <LinearGradient 
                colors={['rgba(255, 237, 168, 0.12)', 'rgba(255, 237, 168, 0.04)']} 
                style={styles.quoteGradient}
            >
                <Award size={32} color={Colors.accent} opacity={0.3} style={styles.quoteIcon} />
                <Text style={[styles.quoteText, { fontFamily: fonts.body }]}>"A reader lives a thousand lives before he dies. The man who never reads lives only one."</Text>
                <Text style={[styles.quoteAuthor, { fontFamily: fonts.heading }]}>— GEORGE R.R. MARTIN</Text>
            </LinearGradient>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,237,168,0.1)' },
  backBtn: { padding: 8 },
  refreshBtn: { padding: 8 },
  headerInfo: { alignItems: 'center' },
  headerTitle: { fontSize: 14, color: Colors.accent, letterSpacing: 3 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759', marginRight: 6 },
  liveText: { fontSize: 9, color: '#34C759', fontWeight: 'bold', letterSpacing: 1 },
  content: { flex: 1, padding: 20 },
  mainGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: (width - 56) / 2, borderRadius: 24, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardGradient: { padding: 20 },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  statLabel: { fontSize: 9, color: Colors.mutedTeal, letterSpacing: 1, marginBottom: 4 },
  statValue: { fontSize: 24, marginBottom: 2 },
  statSub: { fontSize: 9, color: Colors.mutedTeal, opacity: 0.6 },
  chartWrapper: { borderRadius: 28, marginTop: 8, marginBottom: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chartGradient: { padding: 24 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  chartTitle: { fontSize: 12, marginLeft: 12, letterSpacing: 2 },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140 },
  barCol: { alignItems: 'center', width: 24 },
  barBg: { width: 6, height: 110, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 3 },
  barDay: { fontSize: 9, color: Colors.mutedTeal, marginTop: 12, fontWeight: 'bold' },
  quoteWrapper: { borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,237,168,0.1)' },
  quoteGradient: { padding: 32, alignItems: 'center' },
  quoteIcon: { position: 'absolute', top: 20, left: 20 },
  quoteText: { color: Colors.white, fontSize: 15, fontStyle: 'italic', lineHeight: 22, textAlign: 'center', opacity: 0.9 },
  quoteAuthor: { color: Colors.accent, fontSize: 11, textAlign: 'center', marginTop: 16, letterSpacing: 2 },
  goalRow: { flexDirection: 'row', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 20, marginBottom: 24, alignItems: 'center' },
  ringBox: { alignItems: 'center', marginRight: 20 },
  ringLabel: { fontSize: 12, color: Colors.accent, marginTop: 8, letterSpacing: 1 },
  levelBox: { flex: 1 },
  levelName: { fontSize: 13, color: Colors.accent, letterSpacing: 1 },
  levelTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 10, overflow: 'hidden' },
  levelFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 4 },
  levelSub: { fontSize: 11, color: Colors.mutedTeal, marginTop: 6 },
  freezeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: Colors.accent, paddingVertical: 10, marginTop: 14 },
  freezeText: { fontSize: 11, color: Colors.accent, letterSpacing: 1, marginLeft: 8 }
});
