import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator, Platform, Animated, Dimensions, ImageBackground } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Search, X, TrendingUp, Sparkles, Filter, Shuffle } from "lucide-react-native";
import { StoryCard } from "../components/StoryCard";
import { SkeletonCard } from "../components/SkeletonCard";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { HeaderWave } from "../components/HeaderWave";

const { width } = Dimensions.get("window");

const GENRES = ["Fiction", "Romance", "Thriller", "Faith", "Mystery", "Poetry", "Sci-Fi"];

export const ExploreScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
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
    navigation.navigate("Home", { genre: name });
  };

  const handleSurpriseMe = () => {
    if (stories.length === 0) return;
    const randomIdx = Math.floor(Math.random() * stories.length);
    const story = stories[randomIdx];
    navigation.navigate("Reader", { storyId: story.id });
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
      <StatusBar style="light" />
      
      <View style={styles.headerContainer}>
        <ImageBackground 
            source={require("../../assets/auth-bg.jpg")}
            style={[styles.headerBg, { paddingTop: insets.top + 20 }]}
            resizeMode="cover"
        >
            <LinearGradient
                colors={["rgba(0, 30, 28, 0.85)", "rgba(0, 30, 28, 0.99)"]}
                style={StyleSheet.absoluteFill}
            />
            
            <View style={styles.headerContent}>
                <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>EXPLORE THE NEST</Text>
                <Text style={[styles.headerSubtitle, { fontFamily: fonts.body }]}>Discover worlds beyond imagination</Text>
            </View>

            <View style={styles.searchWrapper}>
              <View style={[styles.searchBar, isDarkMode && { borderBottomColor: "rgba(255,237,168,0.3)" }]}>
                <Search size={18} color={Colors.accent} style={styles.searchIcon} />
                <TextInput
                  placeholder="Search stories..."
                  placeholderTextColor="rgba(255, 237, 168, 0.5)"
                  style={[styles.searchInput, { fontFamily: fonts.body }, Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={onSearchFocus}
                  onBlur={onSearchBlur}
                  onSubmitEditing={() => fetchStories(searchQuery)}
                  returnKeyType="search"
                  underlineColorAndroid="transparent"
                  selectionColor={Colors.accent}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(""); fetchStories(""); }}>
                    <X size={20} color={Colors.accent} />
                  </TouchableOpacity>
                )}
              </View>
              <Animated.View style={[
                styles.searchUnderline,
                {
                  width: searchFocusAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"]
                  }),
                  backgroundColor: Colors.accent
                }
              ]} />
            </View>
            <HeaderWave color={isDarkMode ? theme.white : theme.white} />
        </ImageBackground>
      </View>

      <ScrollView 
        style={styles.body} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.actionHeader}>
            <TouchableOpacity style={[styles.surpriseBtn, { backgroundColor: theme.primary }]} onPress={handleSurpriseMe}>
                <Shuffle size={18} color={theme.white} style={{ marginRight: 10 }} />
                <Text style={[styles.surpriseText, { fontFamily: fonts.heading }]}>SURPRISE ME</Text>
            </TouchableOpacity>
        </View>

        {!searchQuery && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.titleRow}>
                <Filter size={16} color={theme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.primary : theme.primary, fontFamily: fonts.heading }]}>BROWSE GENRES</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll} contentContainerStyle={{ paddingRight: 40 }}>
              {GENRES.map((genre) => (
                <TouchableOpacity 
                  key={genre} 
                  style={[styles.genreChip, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0, 54, 49, 0.05)" }]}
                  onPress={() => handleGenrePress(genre)}
                >
                  <Text style={[styles.genreName, { color: isDarkMode ? theme.primary : theme.primary, fontFamily: fonts.heading }]}>
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.titleRow}>
                <TrendingUp size={16} color={theme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.primary : theme.primary, fontFamily: fonts.heading }]}>
                    {searchQuery ? "SEARCH RESULTS" : "TRENDING NOW"}
                </Text>
              </View>
              {!searchQuery && <Sparkles size={16} color={Colors.error} />}
            </View>

            <View style={styles.listContainer}>
              {loading && !refreshing ? (
                <View>
                  {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                </View>
              ) : (
                <>
                  {stories.map((story, index) => (
                    <StoryCard 
                      key={story.id} 
                      story={story} 
                      index={index}
                      onPress={() => navigation.navigate("Reader", { storyId: story.id })} 
                    />
                  ))}
                  {stories.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>The nest is quiet... no stories found here.</Text>
                        <TouchableOpacity style={[styles.resetBtn, { backgroundColor: theme.primary + '10' }]} onPress={() => { setSearchQuery(""); fetchStories(""); }}>
                            <Text style={[styles.resetBtnText, { fontFamily: fonts.heading, color: theme.primary }]}>Explore All</Text>
                        </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { overflow: 'hidden' },
  headerBg: { paddingBottom: 80 },
  headerContent: { paddingHorizontal: 32, marginBottom: 20, alignItems: 'center' },
  headerTitle: { fontSize: 18, color: Colors.accent, letterSpacing: 3, textTransform: "uppercase" },
  headerSubtitle: { fontSize: 13, color: Colors.paleGreen, opacity: 0.8, marginTop: 4 },
  searchWrapper: { paddingHorizontal: 40, marginTop: 10 },
  searchBar: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1.5, borderBottomColor: "rgba(255, 237, 168, 0.2)", height: 48, paddingHorizontal: 4 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.accent, height: "100%" },
  searchUnderline: { height: 2, alignSelf: 'center', marginTop: -1.5 },
  body: { flex: 1 },
  actionHeader: { paddingHorizontal: 24, marginTop: 32 },
  surpriseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, ...Shadows.s },
  surpriseText: { color: Colors.white, fontSize: 13, letterSpacing: 1 },
  section: { marginTop: 32 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" },
  genreScroll: { paddingLeft: 24 },
  genreChip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, marginRight: 12 },
  genreName: { fontSize: 13, letterSpacing: 0.5 },
  listContainer: { paddingHorizontal: 24, paddingBottom: 40 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center" },
  resetBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  resetBtnText: { fontSize: 12 },
});
