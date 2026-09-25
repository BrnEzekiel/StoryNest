import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, Platform, Dimensions } from "react-native";
import { Colors, Radii, Spacing, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Trash2, Bookmark, Compass, Cloud, DownloadCloud } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useFocusEffect } from "@react-navigation/native";
import { SkeletonCard } from "../components/SkeletonCard";
import { Button } from "../components/Button";
import { useTheme } from "../context/ThemeContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { OfflineManager } from "../utils/OfflineManager";

const { width } = Dimensions.get("window");

export const BookmarksScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  
  const [tab, setTab] = useState<"online" | "offline">("online");
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [offlineStories, setOfflineStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (tab === "online") {
        const res = await apiClient.get("/users/me/bookmarks");
        setBookmarks(res.data);
      } else {
        const res = await OfflineManager.getDownloadedStories();
        setOfflineStories(res);
      }
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [tab])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const removeBookmark = async (storyId: string) => {
    try {
      await apiClient.post(`/stories/${storyId}/bookmark`, { progress: -1 });
      setBookmarks(bookmarks.filter(b => b.storyId !== storyId));
    } catch (error) { console.log(error); }
  };

  const removeOffline = async (storyId: string) => {
    await OfflineManager.removeStory(storyId);
    setOfflineStories(offlineStories.filter(s => s.id !== storyId));
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : theme.primary }]}>
        <Bookmark size={48} color={Colors.accent} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.primary, fontFamily: fonts.heading }]}>
        {tab === "online" ? "Your Nest is Empty" : "No Offline Stories"}
      </Text>
      <Text style={[styles.emptySubtitle, { fontFamily: fonts.body }]}>
        {tab === "online" 
          ? "Save stories you love to build your personal sanctuary. They'll be waiting for you here."
          : "Download stories while online to read them anywhere, even in the middle of nowhere."}
      </Text>
      <Button 
        title="START EXPLORING" 
        onPress={() => navigation.navigate("Explore")} 
        type="secondary"
        style={styles.emptyBtn}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 10 }]}>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>YOUR LIBRARY</Text>
        
        <View style={styles.tabContainer}>
            <TouchableOpacity 
                style={[styles.tab, tab === "online" && { borderBottomColor: Colors.accent, borderBottomWidth: 3 }]}
                onPress={() => setTab("online")}
            >
                <Cloud size={16} color={tab === "online" ? Colors.accent : "rgba(255,255,255,0.5)"} style={{ marginRight: 8 }} />
                <Text style={[styles.tabText, { fontFamily: fonts.heading, color: tab === "online" ? Colors.accent : "rgba(255,255,255,0.5)" }]}>SAVED</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.tab, tab === "offline" && { borderBottomColor: Colors.accent, borderBottomWidth: 3 }]}
                onPress={() => setTab("offline")}
            >
                <DownloadCloud size={16} color={tab === "offline" ? Colors.accent : "rgba(255,255,255,0.5)"} style={{ marginRight: 8 }} />
                <Text style={[styles.tabText, { fontFamily: fonts.heading, color: tab === "offline" ? Colors.accent : "rgba(255,255,255,0.5)" }]}>DOWNLOADS</Text>
            </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.body} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[((tab === "online" && bookmarks.length === 0) || (tab === "offline" && offlineStories.length === 0)) && { flex: 1 }, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {loading && !refreshing ? (
          <View style={{ padding: Spacing.l }}>
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </View>
        ) : (
          tab === "online" ? (
            bookmarks.length === 0 ? renderEmptyState() : (
              <View style={styles.listContainer}>
                {bookmarks.map((bookmark) => (
                  <TouchableOpacity 
                    key={bookmark.id} 
                    style={[styles.card, Shadows.s, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : theme.white, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate("Reader", { storyId: bookmark.story.id })}
                  >
                    <Image source={{ uri: bookmark.story.coverUrl }} style={styles.cover} />
                    <View style={styles.info}>
                      <Text style={[styles.genre, { color: theme.primary, fontFamily: fonts.body }]}>{bookmark.story.genre}</Text>
                      <Text style={[styles.title, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{bookmark.story.title}</Text>
                      <Text style={[styles.author, { fontFamily: fonts.body }]}>by {bookmark.story.authorName}</Text>
                      
                      <View style={styles.progressContainer}>
                        <View style={styles.progressRow}>
                          <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}>
                            <View style={[styles.progressBarFill, { width: `${bookmark.progress}%`, backgroundColor: isDarkMode ? Colors.accent : theme.primary }]} />
                          </View>
                          <Text style={[styles.progressText, { fontFamily: fonts.body }]}>{bookmark.progress}%</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeBookmark(bookmark.storyId)} style={styles.removeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Trash2 size={18} color={isDarkMode ? Colors.accent : Colors.mutedTeal} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )
          ) : (
            offlineStories.length === 0 ? renderEmptyState() : (
                <View style={styles.listContainer}>
                  {offlineStories.map((story) => (
                    <TouchableOpacity 
                      key={story.id} 
                      style={[styles.card, Shadows.s, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : theme.white, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}
                      activeOpacity={0.9}
                      onPress={() => navigation.navigate("Reader", { storyId: story.id })}
                    >
                      <Image source={{ uri: story.localCoverPath || story.coverUrl }} style={styles.cover} />
                      <View style={styles.info}>
                        <Text style={[styles.genre, { color: theme.primary, fontFamily: fonts.body }]}>{story.genre}</Text>
                        <Text style={[styles.title, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{story.title}</Text>
                        <Text style={[styles.author, { fontFamily: fonts.body }]}>by {story.authorName}</Text>
                        <Text style={[styles.progressText, { fontFamily: fonts.body, marginTop: 4 }]}>Offline Ready</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeOffline(story.id)} style={styles.removeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Trash2 size={18} color={Colors.error} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 0 },
  headerTitle: { fontSize: 16, color: Colors.accent, textAlign: "center", marginTop: 10, letterSpacing: 0.1, textTransform: "uppercase" },
  tabContainer: { flexDirection: 'row', marginTop: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 11, letterSpacing: 1 },
  body: { flex: 1 },
  listContainer: { padding: Spacing.l },
  card: { flexDirection: "row", borderRadius: Radii.m, padding: Spacing.m, marginBottom: Spacing.m, alignItems: "center", borderWidth: 1 },
  cover: { width: 56, height: 72, borderRadius: Radii.s, backgroundColor: Colors.paleGreen },
  info: { flex: 1, marginLeft: Spacing.m },
  genre: { fontSize: 10, textTransform: "uppercase", marginBottom: 2, letterSpacing: 0.05 },
  title: { fontSize: 18 },
  author: { fontSize: 12, color: Colors.mutedTeal, marginBottom: 8 },
  progressContainer: { marginTop: 4 },
  progressRow: { flexDirection: "row", alignItems: "center" },
  progressBarBg: { flex: 1, height: 4, borderRadius: 2, marginRight: 8 },
  progressBarFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 11, color: Colors.mutedTeal },
  removeBtn: { padding: 8 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing.xxl },
  emptyIconContainer: { width: 100, height: 100, borderRadius: Radii.round, justifyContent: "center", alignItems: "center", marginBottom: Spacing.xl, ...Shadows.m },
  emptyTitle: { fontSize: 24, marginBottom: Spacing.s },
  emptySubtitle: { fontSize: 16, color: Colors.mutedTeal, textAlign: "center", lineHeight: 24, marginBottom: Spacing.xxl },
  emptyBtn: { paddingHorizontal: Spacing.xl },
});
