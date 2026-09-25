import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, Dimensions, ActivityIndicator } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, MessageSquare, Heart, BookOpen, Award, Zap, User } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { HeaderWave } from "../components/HeaderWave";

const { width } = Dimensions.get("window");

export const ActivityFeedScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = async () => {
    try {
        setLoading(true);
        const res = await apiClient.get("/activity/feed");
        setActivities(res.data);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const currentBg = isDarkMode ? theme.white : Colors.paleCream;

  const getActivityIcon = (type: string) => {
      switch(type) {
          case 'READ': return <BookOpen size={16} color="#34C759" />;
          case 'LIKE': return <Heart size={16} color="#FF2D55" fill="#FF2D55" />;
          case 'COMMENT': return <MessageSquare size={16} color="#5856D6" />;
          case 'ACHIEVEMENT': return <Award size={16} color="#FF9500" />;
          case 'PUBLISH': return <Zap size={16} color={Colors.accent} fill={Colors.accent} />;
          default: return <User size={16} color={Colors.mutedTeal} />;
      }
  };

  const getActivityText = (activity: any) => {
      const username = <Text style={{ fontWeight: 'bold' }}>{activity.user.username}</Text>;
      const storyTitle = activity.story ? <Text style={{ fontWeight: 'bold', color: theme.primary }}>"{activity.story.title}"</Text> : null;

      switch(activity.type) {
          case 'READ': return <Text>{username} finished reading {storyTitle}</Text>;
          case 'LIKE': return <Text>{username} liked {storyTitle}</Text>;
          case 'COMMENT': return <Text>{username} commented on {storyTitle}</Text>;
          case 'ACHIEVEMENT': return <Text>{username} earned a new badge!</Text>;
          case 'PUBLISH': return <Text>{username} published a new story {storyTitle}</Text>;
          default: return <Text>{username} did something mysterious</Text>;
      }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>ACTIVITY FEED</Text>
        <HeaderWave color={theme.white} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
      >
        {loading && !refreshing ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : activities.length === 0 ? (
            <View style={styles.emptyContainer}>
                <User size={48} color={Colors.mutedTeal} style={{ marginBottom: 16, opacity: 0.3 }} />
                <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>Your feed is quiet. Follow more authors to see what they're up to!</Text>
                <TouchableOpacity style={[styles.exploreBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate("Explore")}>
                    <Text style={[styles.exploreText, { fontFamily: fonts.heading }]}>FIND AUTHORS</Text>
                </TouchableOpacity>
            </View>
        ) : (
            activities.map((activity) => (
                <View key={activity.id} style={[styles.activityCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : Colors.white }, Shadows.s]}>
                    <TouchableOpacity onPress={() => navigation.navigate("UserProfile", { userId: activity.userId })}>
                        <Image source={{ uri: activity.user.avatarUrl || 'https://via.placeholder.com/40' }} style={styles.avatar} />
                    </TouchableOpacity>
                    <View style={styles.cardContent}>
                        <View style={styles.activityHeader}>
                            <View style={styles.iconBox}>{getActivityIcon(activity.type)}</View>
                            <Text style={styles.timeText}>{new Date(activity.createdAt).toLocaleDateString()}</Text>
                        </View>
                        <Text style={[styles.activityText, { color: theme.black, fontFamily: fonts.body }]}>
                            {getActivityText(activity)}
                        </Text>
                        {activity.story && (
                            <TouchableOpacity 
                                style={[styles.storyPreview, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,54,49,0.03)' }]}
                                onPress={() => navigation.navigate("Reader", { storyId: activity.storyId })}
                            >
                                <Image source={{ uri: activity.story.coverUrl }} style={styles.storyCover} />
                                <View style={styles.storyInfo}>
                                    <Text style={[styles.storyTitle, { fontFamily: fonts.heading, color: theme.black }]} numberOfLines={1}>{activity.story.title}</Text>
                                    <Text style={[styles.storyGenre, { fontFamily: fonts.body }]}>{activity.story.genre}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ))
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
  activityCard: { flexDirection: 'row', padding: 16, borderRadius: 24, marginBottom: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 16 },
  cardContent: { flex: 1 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(0,54,49,0.05)', justifyContent: 'center', alignItems: 'center' },
  timeText: { fontSize: 10, color: Colors.mutedTeal },
  activityText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  storyPreview: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 8 },
  storyCover: { width: 32, height: 44, borderRadius: 4, marginRight: 12 },
  storyInfo: { flex: 1 },
  storyTitle: { fontSize: 12 },
  storyGenre: { fontSize: 10, color: Colors.mutedTeal },
  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  exploreBtn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 20 },
  exploreText: { color: Colors.white, fontSize: 13, letterSpacing: 1 }
});
