import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image, RefreshControl, Platform } from "react-native";
import { Colors, Radii, Spacing, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Trash2, Bookmark, Compass } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useFocusEffect } from "@react-navigation/native";
import { SkeletonCard } from "../components/SkeletonCard";
import { Button } from "../components/Button";
import { useTheme } from "../context/ThemeContext";

export const BookmarksScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookmarks = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/users/me/bookmarks");
      setBookmarks(res.data);
    } catch (error) {
      console.log("Error fetching bookmarks:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchBookmarks();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookmarks();
  };

  const removeBookmark = async (storyId: string) => {
    try {
      await apiClient.post(`/stories/${storyId}/bookmark`, { progress: -1 });
      setBookmarks(bookmarks.filter(b => b.storyId !== storyId));
    } catch (error) {
      console.log("Error removing bookmark:", error);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.primary }]}>
        <Bookmark size={48} color={Colors.accent} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: isDarkMode ? Colors.accent : Colors.primary }]}>Your Nest is Empty</Text>
      <Text style={styles.emptySubtitle}>
        Save stories you love to build your personal sanctuary. They'll be waiting for you here.
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
      <View style={[styles.header, { backgroundColor: Colors.primary }]}>
        <SafeAreaView>
          <Text style={styles.headerTitle}>YOUR LIBRARY</Text>
        </SafeAreaView>
      </View>

      <ScrollView 
        style={styles.body} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={bookmarks.length === 0 && { flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {loading && !refreshing ? (
          <View style={{ padding: Spacing.l }}>
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </View>
        ) : (
          bookmarks.length === 0 ? renderEmptyState() : (
            <View style={styles.listContainer}>
              {bookmarks.map((bookmark) => (
                <TouchableOpacity 
                  key={bookmark.id} 
                  style={[styles.card, Shadows.s, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.white, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate("Reader", { storyId: bookmark.story.id })}
                >
                  <Image source={{ uri: bookmark.story.coverUrl }} style={styles.cover} />
                  <View style={styles.info}>
                    <Text style={[styles.genre, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{bookmark.story.genre}</Text>
                    <Text style={[styles.title, { color: isDarkMode ? Colors.white : Colors.darkTextGreen }]} numberOfLines={1}>{bookmark.story.title}</Text>
                    <Text style={styles.author}>by {bookmark.story.authorName}</Text>
                    
                    <View style={styles.progressContainer}>
                      <View style={styles.progressRow}>
                        <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}>
                          <View style={[styles.progressBarFill, { width: `${bookmark.progress}%`, backgroundColor: isDarkMode ? Colors.accent : Colors.primary }]} />
                        </View>
                        <Text style={styles.progressText}>{bookmark.progress}%</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => removeBookmark(bookmark.storyId)} 
                    style={styles.removeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={18} color={isDarkMode ? Colors.accent : Colors.mutedTeal} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 24 },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.accent, textAlign: "center", marginTop: 10, letterSpacing: 0.1, textTransform: "uppercase" },
  body: { flex: 1 },
  listContainer: { padding: Spacing.l },
  card: { flexDirection: "row", borderRadius: Radii.m, padding: Spacing.m, marginBottom: Spacing.m, alignItems: "center", borderWidth: 1 },
  cover: { width: 56, height: 72, borderRadius: Radii.s, backgroundColor: Colors.paleGreen },
  info: { flex: 1, marginLeft: Spacing.m },
  genre: { fontFamily: Fonts.body, fontSize: 10, textTransform: "uppercase", marginBottom: 2, letterSpacing: 0.05 },
  title: { fontFamily: Fonts.heading, fontSize: 18 },
  author: { fontFamily: Fonts.body, fontSize: 12, color: Colors.mutedTeal, marginBottom: 8 },
  progressContainer: { marginTop: 4 },
  progressRow: { flexDirection: "row", alignItems: "center" },
  progressBarBg: { flex: 1, height: 4, borderRadius: 2, marginRight: 8 },
  progressBarFill: { height: "100%", borderRadius: 2 },
  progressText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.mutedTeal },
  removeBtn: { padding: 8 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing.xxl },
  emptyIconContainer: { width: 100, height: 100, borderRadius: Radii.round, justifyContent: "center", alignItems: "center", marginBottom: Spacing.xl, ...Shadows.m },
  emptyTitle: { fontFamily: Fonts.heading, fontSize: 24, marginBottom: Spacing.s },
  emptySubtitle: { fontFamily: Fonts.body, fontSize: 16, color: Colors.mutedTeal, textAlign: "center", lineHeight: 24, marginBottom: Spacing.xxl },
  emptyBtn: { paddingHorizontal: Spacing.xl },
});
