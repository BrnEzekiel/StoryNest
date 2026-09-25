import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Award, Lock, Star, Zap, BookOpen, Flame, Trophy } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const { width } = Dimensions.get("window");

const ACHIEVEMENTS = [
  { id: "1", title: "Early Bird", desc: "Read a story before 7 AM", icon: Flame, color: "#FF9500", unlocked: true },
  { id: "2", title: "First Flight", desc: "Finish your very first story", icon: Award, color: "#5856D6", unlocked: true },
  { id: "3", title: "Nest Builder", desc: "Save 10 stories to your library", icon: Star, color: "#FFCC00", unlocked: true },
  { id: "4", title: "Speed Reader", desc: "Finish 5 stories in one day", icon: Zap, color: Colors.accent, unlocked: false },
  { id: "5", title: "Scholar", desc: "Read for 500 total minutes", icon: BookOpen, color: "#34C759", unlocked: false },
  { id: "6", title: "Grand Storyteller", desc: "Write and publish 3 stories", icon: Trophy, color: Colors.error, unlocked: false },
];

export const AchievementsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme, fonts } = useTheme();

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

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { fontFamily: fonts.heading }]}>3/6</Text>
            <Text style={[styles.summaryLabel, { fontFamily: fonts.heading }]}>NEST BADGES EARNED</Text>
        </View>

        <View style={styles.grid}>
            {ACHIEVEMENTS.map((ach) => {
                const Icon = ach.icon;
                return (
                    <View key={ach.id} style={[styles.achCard, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : Colors.white }, !ach.unlocked && { opacity: 0.6 }]}>
                        <View style={[styles.iconBox, { backgroundColor: ach.unlocked ? ach.color + '15' : 'rgba(0,0,0,0.05)' }]}>
                            {ach.unlocked ? <Icon size={32} color={ach.color} /> : <Lock size={24} color={Colors.mutedTeal} />}
                        </View>
                        <Text style={[styles.achTitle, { color: isDarkMode ? Colors.white : Colors.primary, fontFamily: fonts.heading }]}>{ach.title}</Text>
                        <Text style={[styles.achDesc, { fontFamily: fonts.body }]}>{ach.desc}</Text>
                        {ach.unlocked && (
                            <View style={styles.unlockedBadge}>
                                <Text style={[styles.unlockedText, { fontFamily: fonts.heading }]}>UNLOCKED</Text>
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20 },
  headerTitle: { fontSize: 16, color: Colors.accent, letterSpacing: 1 },
  backBtn: { padding: 4 },
  summaryCard: { backgroundColor: Colors.primary, padding: 32, borderRadius: 24, alignItems: 'center', marginBottom: 32, ...Shadows.m },
  summaryValue: { fontSize: 48, color: Colors.accent },
  summaryLabel: { fontSize: 12, color: Colors.paleGreen, letterSpacing: 1, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  achCard: { width: (width - 64) / 2, padding: 20, borderRadius: 24, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  iconBox: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  achTitle: { fontSize: 15, textAlign: 'center', marginBottom: 4 },
  achDesc: { fontSize: 11, color: Colors.mutedTeal, textAlign: 'center', lineHeight: 16 },
  unlockedBadge: { marginTop: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#34C75915' },
  unlockedText: { fontSize: 8, color: '#34C759', letterSpacing: 0.5 },
});
