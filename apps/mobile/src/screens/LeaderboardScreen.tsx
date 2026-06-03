import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, Dimensions } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Trophy, Medal, Star, Zap, Crown } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { HeaderWave } from "../components/HeaderWave";

const { width } = Dimensions.get("window");

export const LeaderboardScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaders = async () => {
    try {
        setLoading(true);
        const res = await apiClient.get("/gamification/leaderboard");
        setLeaders(res.data);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    fetchLeaders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaders();
  };

  const currentBg = isDarkMode ? theme.white : Colors.paleCream;

  const renderTop3 = () => {
      const top3 = leaders.slice(0, 3);
      if (top3.length === 0) return null;

      const getMedalColor = (idx: number) => {
          if (idx === 0) return "#FFD700"; // Gold
          if (idx === 1) return "#C0C0C0"; // Silver
          return "#CD7F32"; // Bronze
      };

      return (
          <View style={styles.podiumContainer}>
              {/* 2nd Place */}
              {top3[1] && (
                <View style={[styles.podiumItem, { marginTop: 40 }]}>
                    <View style={[styles.podiumAvatarWrap, { borderColor: getMedalColor(1) }]}>
                        <Image source={{ uri: top3[1].avatarUrl || 'https://via.placeholder.com/100' }} style={styles.podiumAvatar} />
                        <View style={[styles.medalCircle, { backgroundColor: getMedalColor(1) }]}>
                            <Text style={styles.medalText}>2</Text>
                        </View>
                    </View>
                    <Text style={[styles.podiumName, { fontFamily: fonts.heading, color: theme.black }]} numberOfLines={1}>{top3[1].username}</Text>
                    <Text style={[styles.podiumXP, { fontFamily: fonts.body }]}>{top3[1].xp} XP</Text>
                </View>
              )}

              {/* 1st Place */}
              {top3[0] && (
                <View style={styles.podiumItem}>
                    <Crown size={24} color="#FFD700" fill="#FFD700" style={{ marginBottom: 4 }} />
                    <View style={[styles.podiumAvatarWrap, { width: 90, height: 90, borderRadius: 45, borderColor: getMedalColor(0) }]}>
                        <Image source={{ uri: top3[0].avatarUrl || 'https://via.placeholder.com/100' }} style={[styles.podiumAvatar, { width: 80, height: 80, borderRadius: 40 }]} />
                        <View style={[styles.medalCircle, { backgroundColor: getMedalColor(0), width: 28, height: 28, borderRadius: 14 }]}>
                            <Text style={[styles.medalText, { fontSize: 14 }]}>1</Text>
                        </View>
                    </View>
                    <Text style={[styles.podiumName, { fontSize: 16, fontFamily: fonts.heading, color: theme.black }]} numberOfLines={1}>{top3[0].username}</Text>
                    <Text style={[styles.podiumXP, { fontSize: 13, fontFamily: fonts.body }]}>{top3[0].xp} XP</Text>
                </View>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <View style={[styles.podiumItem, { marginTop: 60 }]}>
                    <View style={[styles.podiumAvatarWrap, { borderColor: getMedalColor(2) }]}>
                        <Image source={{ uri: top3[2].avatarUrl || 'https://via.placeholder.com/100' }} style={styles.podiumAvatar} />
                        <View style={[styles.medalCircle, { backgroundColor: getMedalColor(2) }]}>
                            <Text style={styles.medalText}>3</Text>
                        </View>
                    </View>
                    <Text style={[styles.podiumName, { fontFamily: fonts.heading, color: theme.black }]} numberOfLines={1}>{top3[2].username}</Text>
                    <Text style={[styles.podiumXP, { fontFamily: fonts.body }]}>{top3[2].xp} XP</Text>
                </View>
              )}
          </View>
      );
  };

  return (
    <View style={[styles.container, { backgroundColor: currentBg }]}>
      <StatusBar style="light" />
      <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>NEST LEGENDS</Text>
        <Trophy size={20} color={Colors.accent} style={{ position: 'absolute', right: 24, top: 55 }} />
        <HeaderWave color={currentBg} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading && !refreshing ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 100 }} />
        ) : (
            <>
                {renderTop3()}

                <View style={[styles.listContainer, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : Colors.white }, Shadows.s]}>
                    {leaders.slice(3).map((user, index) => (
                        <View key={user.username} style={[styles.userRow, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                            <Text style={[styles.rankText, { fontFamily: fonts.heading, color: Colors.mutedTeal }]}>{index + 4}</Text>
                            <Image source={{ uri: user.avatarUrl || 'https://via.placeholder.com/40' }} style={styles.rowAvatar} />
                            <View style={styles.rowInfo}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.rowName, { fontFamily: fonts.heading, color: theme.black }]}>{user.username}</Text>
                                    {user.isPremium && <Crown size={12} color={Colors.accent} fill={Colors.accent} style={{ marginLeft: 6 }} />}
                                </View>
                                <Text style={[styles.rowSub, { fontFamily: fonts.body }]}>Legendary Reader</Text>
                            </View>
                            <View style={styles.xpBadge}>
                                <Text style={[styles.xpText, { fontFamily: fonts.heading, color: theme.primary }]}>{user.xp} XP</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingBottom: 60, alignItems: 'center' },
  backBtn: { position: 'absolute', left: 24, top: 60, zIndex: 10 },
  headerTitle: { fontSize: 16, color: Colors.accent, letterSpacing: 2 },
  content: { flex: 1 },
  podiumContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingHorizontal: 20, marginTop: 40, marginBottom: 40 },
  podiumItem: { alignItems: 'center', width: (width - 40) / 3 },
  podiumAvatarWrap: { width: 74, height: 74, borderRadius: 37, borderWidth: 3, padding: 4, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  podiumAvatar: { width: 60, height: 60, borderRadius: 30 },
  medalCircle: { position: 'absolute', bottom: -5, right: -5, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white },
  medalText: { color: Colors.white, fontSize: 10, fontWeight: '900' },
  podiumName: { fontSize: 13, marginTop: 12, textAlign: 'center' },
  podiumXP: { fontSize: 11, color: Colors.mutedTeal, marginTop: 2 },
  listContainer: { margin: 20, borderRadius: 28, overflow: 'hidden' },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  rankText: { fontSize: 14, width: 30 },
  rowAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 16 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15 },
  rowSub: { fontSize: 11, color: Colors.mutedTeal, marginTop: 2 },
  xpBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0,54,49,0.05)' },
  xpText: { fontSize: 12 },
});
