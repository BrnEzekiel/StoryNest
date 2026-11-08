import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../theme/colors";
import { ArrowLeft, BookOpen, Heart, MessageCircle, Bookmark, Flame, Share2 } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ActivityLog } from "../utils/activityLog";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

export const WrapScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, fonts } = useTheme();
  const [stats, setStats] = useState({ reads: 0, likes: 0, comments: 0, saved: 0 });
  const [topReads, setTopReads] = useState<any[]>([]);
  const year = new Date().getFullYear();

  useFocusEffect(useCallback(() => {
    (async () => {
      const journal: any[] = await ActivityLog.list();
      const reads = journal.filter((e) => e.kind === "READ");
      setStats({
        reads: reads.length,
        likes: journal.filter((e) => e.kind === "LIKE").length,
        comments: journal.filter((e) => e.kind === "COMMENT").length,
        saved: journal.filter((e) => e.kind === "BOOKMARK").length,
      });
      setTopReads(reads.slice(0, 5));
    })();
  }, []));

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My ${year} StoryNest Wrap: ${stats.reads} stories read, ${stats.likes} likes, ${user?.streakCount || 0}-day streak. What did you read this year?`,
      });
    } catch (e) {}
  };

  const Stat = ({ icon: Icon, value, label, color }: any) => (
    <View style={styles.statBox}>
      <Icon size={22} color={color} />
      <Text style={[styles.statValue, { fontFamily: fonts.heading }]}>{value}</Text>
      <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: "#001a18" }]}>
      <StatusBar style="light" />
      <LinearGradient colors={["#003631", "#000807"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>{year} WRAP</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Share2 size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }}>
        <Text style={[styles.hero, { fontFamily: fonts.heading }]}>Your year in stories, {user?.username || "reader"}.</Text>

        <View style={styles.grid}>
          <Stat icon={BookOpen} value={stats.reads} label="Stories read" color="#4FACFE" />
          <Stat icon={Flame} value={user?.streakCount || 0} label="Day streak" color="#FF9A3D" />
          <Stat icon={Heart} value={stats.likes} label="Likes given" color="#F093FB" />
          <Stat icon={MessageCircle} value={stats.comments} label="Comments" color="#34C759" />
          <Stat icon={Bookmark} value={stats.saved} label="Saved" color={Colors.accent} />
        </View>

        {topReads.length > 0 && (
          <View style={styles.listSection}>
            <Text style={[styles.sectionTitle, { fontFamily: fonts.heading }]}>RECENT READS</Text>
            {topReads.map((r: any, i: number) => (
              <View key={`${r.storyId || i}-${i}`} style={styles.readRow}>
                <Text style={[styles.readRank, { fontFamily: fonts.heading }]}>{i + 1}</Text>
                <Text style={[styles.readTitle, { fontFamily: fonts.body }]} numberOfLines={1}>{r.title}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.shareCta} onPress={handleShare}>
          <Text style={[styles.shareCtaText, { fontFamily: fonts.heading }]}>SHARE MY WRAP</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  headerTitle: { fontSize: 18, color: Colors.accent, letterSpacing: 2, flex: 1, textAlign: "center" },
  backBtn: { marginRight: 16 },
  shareBtn: { marginLeft: 16 },
  hero: { fontSize: 26, color: Colors.accent, lineHeight: 32, marginBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  statBox: { width: "48%", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 18, marginBottom: 14, alignItems: "center" },
  statValue: { fontSize: 28, color: "#FFFFFF", marginTop: 8 },
  statLabel: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 },
  listSection: { marginTop: 16 },
  sectionTitle: { fontSize: 13, color: Colors.accent, letterSpacing: 2, marginBottom: 12 },
  readRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  readRank: { fontSize: 16, color: Colors.accent, width: 32 },
  readTitle: { fontSize: 14, color: "#FFFFFF", flex: 1 },
  shareCta: { marginTop: 28, backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  shareCtaText: { fontSize: 13, color: Colors.primary, letterSpacing: 2 },
});
