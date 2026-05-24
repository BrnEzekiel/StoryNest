import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator, Platform, Animated } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Search, Book, Heart, Zap, Scroll, X } from "lucide-react-native";
import { StoryCard } from "../components/StoryCard";
import { SkeletonCard } from "../components/SkeletonCard";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";

const GENRES = [
  { id: "1", name: "FICTION", icon: <Book size={24} color={Colors.primary} />, bg: Colors.paleGreen },
  { id: "2", name: "ROMANCE", icon: <Heart size={24} color="#D2691E" />, bg: Colors.paleCream },
  { id: "3", name: "THRILLER", icon: <Zap size={24} color={Colors.accent} />, bg: Colors.primary },
  { id: "4", name: "FAITH", icon: <Scroll size={24} color={Colors.darkTextCream} />, bg: Colors.accent },
];

export const ExploreScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const searchFocusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async (query = "") => {
    try {
      setLoading(true);
      const url = query ? `/stories?q=${query}` : "/stories?limit=20";
      const res = await apiClient.get(url);
      setStories(res.data);
    } catch (error) {
      console.log("Error fetching explore data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStories(searchQuery);
  };

  const handleGenrePress = (name: string) => {
    const formattedGenre = name.charAt(0) + name.slice(1).toLowerCase();
    navigation.navigate("Home", { genre: formattedGenre });
  };

  const onSearchFocus = () => {
    Animated.timing(searchFocusAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  };

  const onSearchBlur = () => {
    if (!searchQuery) {
      Animated.timing(searchFocusAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <View style={[styles.header, { backgroundColor: Colors.primary }]}>
        <SafeAreaView>
          <Text style={styles.headerTitle}>EXPLORE THE NEST</Text>
        </SafeAreaView>
        
        <View style={styles.searchWrapper}>
          <View style={styles.searchUnderlineRow}>
            <Search size={18} color={Colors.mutedTeal} style={styles.searchIcon} />
            <TextInput
              placeholder="Search stories, authors..."
              placeholderTextColor="rgba(125, 184, 178, 0.5)"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              onSubmitEditing={() => fetchStories(searchQuery)}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(""); fetchStories(""); }}>
                <X size={18} color={Colors.mutedTeal} />
              </TouchableOpacity>
            )}
          </View>
          <Animated.View style={[
            styles.underlineBar,
            {
              width: searchFocusAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"]
              }),
              backgroundColor: Colors.accent
            }
          ]} />
        </View>
      </View>

      <ScrollView 
        style={styles.body} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {!searchQuery && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.accent : Colors.primary }]}>BROWSE GENRES</Text>
            </View>

            <View style={styles.genreGrid}>
              {GENRES.map((genre) => (
                <TouchableOpacity 
                  key={genre.id} 
                  style={[styles.genreTile, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : genre.bg }, Shadows.s]}
                  onPress={() => handleGenrePress(genre.name)}
                >
                  <View style={styles.genreIcon}>{genre.icon}</View>
                  <Text style={[styles.genreName, { color: isDarkMode ? Colors.accent : (genre.id === "3" ? Colors.accent : Colors.primary) }]}>
                    {genre.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.accent : Colors.primary }]}>
            {searchQuery ? "SEARCH RESULTS" : "TRENDING IN THE NEST"}
          </Text>
        </View>

        <View style={styles.trendingList}>
          {loading && !refreshing ? (
            <View>
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </View>
          ) : (
            <>
              {stories.map((story) => (
                <StoryCard 
                  key={story.id} 
                  story={story} 
                  onPress={() => navigation.navigate("Reader", { storyId: story.id })} 
                />
              ))}
              {stories.length === 0 && (
                <Text style={styles.emptyText}>No stories found for this path.</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 24 },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.accent, textAlign: "center", marginTop: 10, letterSpacing: 0.1, textTransform: "uppercase" },
  searchWrapper: { marginHorizontal: Spacing.l, marginTop: 16 },
  searchUnderlineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 16, color: Colors.white },
  underlineBar: { height: 1.5, width: "100%", opacity: 0.5 },
  body: { flex: 1, paddingHorizontal: Spacing.l, paddingTop: Spacing.l },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.m },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: 14, letterSpacing: 0.08, textTransform: "uppercase" },
  genreGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: Spacing.xl },
  genreTile: { width: "48%", padding: 20, borderRadius: Radii.m, marginBottom: 16, alignItems: "center", justifyContent: "center" },
  genreIcon: { marginBottom: 12 },
  genreName: { fontFamily: Fonts.heading, fontSize: 14, letterSpacing: 0.02 },
  trendingList: { marginBottom: 40 },
  emptyText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 20 },
});
