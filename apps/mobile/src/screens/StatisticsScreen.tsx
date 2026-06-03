import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, TrendingUp, Calendar, Clock, BarChart2, Zap, Target } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { HeaderWave } from "../components/HeaderWave";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export const StatisticsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const { user } = useAuth();

  const currentBg = isDarkMode ? theme.white : Colors.paleCream;

  const StatCard = ({ icon: Icon, title, value, sub, color }: any) => (
    <View style={[styles.statCard, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.white }, Shadows.s]}>
        <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
            <Icon size={24} color={color} />
        </View>
        <View style={styles.statInfo}>
            <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>{title}</Text>
            <Text style={[styles.statValue, { color: theme.black, fontFamily: fonts.heading }]}>{value}</Text>
            <Text style={[styles.statSub, { fontFamily: fonts.body }]}>{sub}</Text>
        </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: currentBg }]}>
      <StatusBar style="light" />
      <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>READING INSIGHTS</Text>
        <HeaderWave color={currentBg} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        
        <View style={styles.mainGrid}>
            <StatCard 
                icon={Clock} 
                title="TIME INVESTED" 
                value={`${user?.totalReadTime || 0}m`} 
                sub="Total story time"
                color="#007AFF"
            />
            <StatCard 
                icon={Target} 
                title="DAILY GOAL" 
                value={`${Math.round(((user?.todayReadTime || 0) / (user?.dailyGoalMinutes || 30)) * 100)}%`} 
                sub={`${user?.todayReadTime || 0}m of ${user?.dailyGoalMinutes || 30}m`}
                color="#34C759"
            />
            <StatCard 
                icon={Zap} 
                title="WISDOM EARNED" 
                value={`${user?.xp || 0}`} 
                sub="Total experience points"
                color="#FF9500"
            />
            <StatCard 
                icon={Calendar} 
                title="LONGEST STREAK" 
                value={`${user?.streakCount || 0} Days`} 
                sub="Consecutive reading"
                color="#FF2D55"
            />
        </View>

        <View style={[styles.chartContainer, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : Colors.white }, Shadows.s]}>
            <View style={styles.chartHeader}>
                <BarChart2 size={18} color={theme.primary} />
                <Text style={[styles.chartTitle, { fontFamily: fonts.heading, color: theme.black }]}>WEEKLY ACTIVITY</Text>
            </View>
            
            <View style={styles.barsRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                    const h = Math.random() * 100 + 20; // Simulated data
                    return (
                        <View key={i} style={styles.barCol}>
                            <View style={[styles.barBg, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : Colors.paleGreen }]}>
                                <LinearGradient
                                    colors={[theme.primary, theme.primary + '80']}
                                    style={[styles.barFill, { height: i === 2 ? 80 : h }]} // Highlight Wednesday as today
                                />
                            </View>
                            <Text style={[styles.barDay, { fontFamily: fonts.body }]}>{day}</Text>
                        </View>
                    );
                })}
            </View>
        </View>

        <View style={[styles.quoteCard, { backgroundColor: theme.primary }]}>
            <TrendingUp size={32} color={Colors.accent} opacity={0.3} style={styles.quoteIcon} />
            <Text style={[styles.quoteText, { fontFamily: fonts.body }]}>"A reader lives a thousand lives before he dies. The man who never reads lives only one."</Text>
            <Text style={[styles.quoteAuthor, { fontFamily: fonts.heading }]}>— GEORGE R.R. MARTIN</Text>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingBottom: 60, alignItems: 'center' },
  backBtn: { position: 'absolute', left: 24, top: 60, zIndex: 10 },
  headerTitle: { fontSize: 16, color: Colors.accent, letterSpacing: 2 },
  content: { flex: 1, padding: 24 },
  mainGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: (width - 64) / 2, padding: 20, borderRadius: 24, marginBottom: 16, flexDirection: 'column' },
  statIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  statInfo: {},
  statLabel: { fontSize: 10, color: Colors.mutedTeal, letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 24, marginBottom: 2 },
  statSub: { fontSize: 10, color: Colors.mutedTeal, opacity: 0.8 },
  chartContainer: { padding: 24, borderRadius: 28, marginTop: 16, marginBottom: 24 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  chartTitle: { fontSize: 14, marginLeft: 12, letterSpacing: 1 },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 150 },
  barCol: { alignItems: 'center', width: 20 },
  barBg: { width: 8, height: 120, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4 },
  barDay: { fontSize: 10, color: Colors.mutedTeal, marginTop: 12 },
  quoteCard: { padding: 32, borderRadius: 32, marginTop: 8 },
  quoteIcon: { position: 'absolute', top: 20, left: 20 },
  quoteText: { color: Colors.white, fontSize: 16, fontStyle: 'italic', lineHeight: 24, textAlign: 'center' },
  quoteAuthor: { color: Colors.accent, fontSize: 12, textAlign: 'center', marginTop: 16, letterSpacing: 1 }
});
