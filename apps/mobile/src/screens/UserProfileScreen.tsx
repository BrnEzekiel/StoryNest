import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform, Dimensions, ImageBackground } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, UserPlus, UserMinus, ShieldCheck, Zap, Award, BookOpen, Flame, Clock } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { HeaderWave } from "../components/HeaderWave";
import { StatusBar } from "expo-status-bar";

const { width } = Dimensions.get("window");

export const UserProfileScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { userId } = route.params;
  const { user: currentUser } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchProfile = async () => {
    try {
        setLoading(true);
        const res = await apiClient.get(`/users/${userId}/profile`);
        setUser(res.data);
        setFollowing(res.data.isFollowing);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const toggleFollow = async () => {
      setFollowLoading(true);
      try {
          if (following) {
              await apiClient.delete(`/users/${userId}/follow`);
              setFollowing(false);
          } else {
              await apiClient.post(`/users/${userId}/follow`);
              setFollowing(true);
          }
      } catch (e) { Alert.alert("Error", "Action failed"); }
      finally { setFollowLoading(false); }
  };

  if (loading || !user) {
      return (
          <View style={[styles.container, { backgroundColor: theme.white, justifyContent: 'center' }]}>
              <ActivityIndicator color={theme.primary} />
          </View>
      );
  }

  const currentBg = isDarkMode ? theme.white : Colors.paleCream;

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={styles.headerWrapper}>
        <ImageBackground 
            source={require("../../assets/auth-bg.jpg")}
            style={[styles.headerBg, { paddingTop: insets.top + 20 }]}
            resizeMode="cover"
        >
            <LinearGradient
                colors={["rgba(0, 30, 28, 0.85)", "rgba(0, 30, 28, 0.99)"]}
                style={StyleSheet.absoluteFill}
            />
            
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <ArrowLeft size={24} color={Colors.accent} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>VISITING NEST</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.profileInfo}>
                <View style={styles.avatarContainer}>
                  {user?.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={[styles.avatarText, { fontFamily: fonts.heading }]}>{user?.username?.substring(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                </View>
              
              <View style={styles.userDetails}>
                <View style={styles.nameRow}>
                    <Text style={[styles.username, { fontFamily: fonts.heading }]}>{user?.username}</Text>
                    {user?.isPremium && <Zap size={18} color={Colors.accent} fill={Colors.accent} style={{ marginLeft: 8 }} />}
                </View>
                <Text style={[styles.bio, { fontFamily: fonts.body }]}>{user?.bio || "A mysterious reader in the nest..."}</Text>
                
                <View style={styles.statsRow}>
                    <View style={styles.miniStat}>
                        <Text style={[styles.miniValue, { fontFamily: fonts.heading }]}>{user._count?.followers || 0}</Text>
                        <Text style={[styles.miniLabel, { fontFamily: fonts.body }]}>Followers</Text>
                    </View>
                    <View style={styles.miniStat}>
                        <Text style={[styles.miniValue, { fontFamily: fonts.heading }]}>{user._count?.following || 0}</Text>
                        <Text style={[styles.miniLabel, { fontFamily: fonts.body }]}>Following</Text>
                    </View>
                </View>

                {currentUser?.id !== userId && (
                    <TouchableOpacity 
                        style={[styles.followBtn, following ? { backgroundColor: 'rgba(255,255,255,0.1)' } : { backgroundColor: Colors.accent }]} 
                        onPress={toggleFollow}
                        disabled={followLoading}
                    >
                        {followLoading ? <ActivityIndicator size="small" color={following ? theme.white : theme.primary} /> : (
                            <>
                                {following ? <UserMinus size={16} color={Colors.white} /> : <UserPlus size={16} color={Colors.primary} />}
                                <Text style={[styles.followBtnText, { fontFamily: fonts.heading, color: following ? Colors.white : Colors.primary }]}>
                                    {following ? "UNFOLLOW" : "FOLLOW"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
              </View>
            </View>
            <HeaderWave color={isDarkMode ? theme.white : theme.white} />
        </ImageBackground>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>ACHIEVEMENTS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                {user.achievements?.map((ach: any) => (
                    <View key={ach.id} style={[styles.achBadge, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,54,49,0.05)' }]}>
                        <Award size={20} color={Colors.accent} />
                        <Text style={[styles.achText, { fontFamily: fonts.heading, color: theme.black }]}>{ach.title}</Text>
                    </View>
                ))}
                {user.achievements?.length === 0 && <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No badges earned yet.</Text>}
            </ScrollView>
        </View>

        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>RECENT ACTIVITY</Text>
            <View style={[styles.activityPlaceholder, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,54,49,0.02)' }]}>
                <BookOpen size={24} color={Colors.mutedTeal} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>{user.username} hasn't shared any activity yet.</Text>
            </View>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrapper: { overflow: 'hidden' },
  headerBg: { paddingBottom: 60 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 32 },
  headerTitle: { fontSize: 14, color: Colors.accent, letterSpacing: 2, opacity: 0.9 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  profileInfo: { flexDirection: 'row', alignItems: "flex-start", paddingHorizontal: 24 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.accent, padding: 4, marginRight: 20 },
  avatar: { width: "100%", height: "100%", borderRadius: 45 },
  avatarPlaceholder: { width: "100%", height: "100%", borderRadius: 45, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 32, color: Colors.primary },
  userDetails: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { fontSize: 24, color: Colors.white },
  bio: { fontSize: 13, color: Colors.paleGreen, opacity: 0.8, marginTop: 4, lineHeight: 18 },
  statsRow: { flexDirection: 'row', marginTop: 16, marginBottom: 20 },
  miniStat: { marginRight: 24 },
  miniValue: { color: Colors.white, fontSize: 16 },
  miniLabel: { color: Colors.paleGreen, fontSize: 10, opacity: 0.7 },
  followBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  followBtnText: { fontSize: 12, marginLeft: 8, letterSpacing: 1 },
  content: { flex: 1, padding: 24 },
  section: { marginBottom: 40 },
  sectionTitle: { fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 },
  achBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 12 },
  achText: { fontSize: 12, marginLeft: 8 },
  emptyText: { fontSize: 13, color: Colors.mutedTeal, textAlign: 'center' },
  activityPlaceholder: { padding: 40, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(0,54,49,0.1)' }
});
