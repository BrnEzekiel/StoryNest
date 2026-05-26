import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, TouchableOpacity, RefreshControl, Platform, Image, Animated, FlatList } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Search, Bell, X, ChevronRight } from "lucide-react-native";
import { StoryCard } from "../components/StoryCard";
import { SkeletonCard } from "../components/SkeletonCard";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useFocusEffect } from "@react-navigation/native";

const GENRES = ["All", "Fiction", "Romance", "Thriller", "Faith", "Mystery"];

export const HomeScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();
  const { theme, isDarkMode, recsEnabled } = useTheme();
  
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGenre, setActiveGenre] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [greeting, setGreeting] = useState("");
  
  const searchFocusAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const hours = new Date().getHours();
    const username = user?.username || "Reader";
    if (hours < 12) setGreeting(`Good morning, ${username}`);
    else if (hours < 17) setGreeting(`Good afternoon, ${username}`);
    else if (hours < 21) setGreeting(`Good evening, ${username}`);
    else setGreeting(`Reading late, ${username}?`);
  }, [user]);

  const resetHome = useCallback(() => {
    setSearchQuery("");
    setActiveGenre("All");
    fetchData("All", "");
    if (searchInputRef.current) searchInputRef.current.blur();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.reset) {
        resetHome();
        navigation.setParams({ reset: undefined });
      }
      if (route.params?.genre) {
        setActiveGenre(route.params.genre);
        navigation.setParams({ genre: undefined });
      }
    }, [route.params?.reset, route.params?.genre])
  );

  const fetchData = async (genre = activeGenre, q = searchQuery) => {
    try {
      setLoading(true);
      let url = genre === "All" ? "/stories" : `/stories?genre=${genre}`;
      if (q) url += (url.includes("?") ? "&" : "?") + `q=${q}`;
      const res = await apiClient.get(url);
      setStories(res.data);
    } catch (error) {
      console.log("Error fetching home data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(activeGenre, searchQuery);
  }, [activeGenre]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(activeGenre, searchQuery);
  };

  const handleSearch = () => {
    fetchData(activeGenre, searchQuery);
  };

  const onSearchFocus = () => {
    Animated.timing(searchFocusAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  };

  const onSearchBlur = () => {
    if (!searchQuery) {
      Animated.timing(searchFocusAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    }
  };

  const featuredStory = stories.length > 0 ? stories[0] : null;
  const newReleases = [...stories].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

  const renderHeader = () => (
    <>
      {!searchQuery && featuredStory && (
        <StoryCard 
          story={featuredStory} 
          variant="featured" 
          index={0}
          onPress={() => navigation.navigate("Reader", { storyId: featuredStory.id })} 
        />
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.accent : Colors.primary }]}>
          {searchQuery ? "SEARCH RESULTS" : "GENRES"}
        </Text>
        {searchQuery && (
            <TouchableOpacity onPress={resetHome}><Text style={[styles.clearText, { color: Colors.mutedTeal }]}>Clear</Text></TouchableOpacity>
        )}
      </View>
      
      {!searchQuery && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
          {GENRES.map((genre) => (
            <TouchableOpacity 
              key={genre} 
              onPress={() => setActiveGenre(genre)} 
              style={[styles.genreChip, activeGenre === genre ? styles.activeChip : { borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}
            >
              <Text style={[styles.genreText, activeGenre === genre ? styles.activeGenreText : { color: isDarkMode ? Colors.mutedTeal : Colors.primary }]}>
                {genre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* New Releases Infinite Carousel */}
      {!searchQuery && newReleases.length > 0 && (
        <View style={styles.carouselSection}>
          <Text style={[styles.subSectionTitle, { color: isDarkMode ? Colors.mutedTeal : Colors.primary }]}>NEW RELEASES</Text>
          <FlatList
            data={newReleases}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id + '_nr'}
            contentContainerStyle={styles.carouselContent}
            renderItem={({ item, index }) => (
              <StoryCard 
                story={item} 
                variant="compact" 
                index={index}
                style={styles.carouselItem}
                onPress={() => navigation.navigate("Reader", { storyId: item.id })} 
              />
            )}
          />
        </View>
      )}

      {recsEnabled && !searchQuery && (
        <View style={{ marginBottom: Spacing.xl }}>
            <Text style={[styles.subSectionTitle, { color: isDarkMode ? Colors.mutedTeal : Colors.primary }]}>RECOMMENDED FOR YOU</Text>
            {stories.slice(0, 3).map((s, idx) => (
              <StoryCard 
                key={s.id + '_rec'} 
                story={s} 
                index={idx}
                onPress={() => navigation.navigate("Reader", { storyId: s.id })} 
              />
            ))}
        </View>
      )}

      <Text style={[styles.subSectionTitle, { color: isDarkMode ? Colors.mutedTeal : Colors.primary, marginTop: Spacing.m }]}>ALL STORIES</Text>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <View style={[styles.header, { backgroundColor: Colors.primary }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={resetHome} activeOpacity={0.7}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.username}>StoryNest</Text>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconCircle} onPress={() => {}}>
              <Bell size={20} color={Colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.avatarCircle}
              onPress={() => navigation.navigate("Profile")}
            >
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              ) : (
                <Text style={styles.avatarText}>{user?.username?.substring(0, 2).toUpperCase() || "SN"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Minimalist Underline Search Bar */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchUnderlineRow}>
            <Search size={18} color={Colors.mutedTeal} style={styles.searchIcon} />
            <TextInput 
              ref={searchInputRef}
              placeholder="Search stories..." 
              placeholderTextColor="rgba(255, 255, 255, 0.4)" 
              style={[styles.searchInput, Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              returnKeyType="search"
              underlineColorAndroid="transparent"
              selectionColor={Colors.accent}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={resetHome}>
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

      {loading && !refreshing ? (
        <View style={{ flex: 1, paddingHorizontal: Spacing.l, marginTop: Spacing.m }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <FlatList
          data={stories}
          ListHeaderComponent={renderHeader}
          keyExtractor={(item) => item.id + '_all'}
          renderItem={({ item, index }) => (
            <StoryCard 
              story={item} 
              index={index}
              onPress={() => navigation.navigate("Reader", { storyId: item.id })} 
            />
          )}
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No stories found in the nest.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: Spacing.l, paddingTop: 16 },
  headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.l },
  greeting: { fontFamily: Fonts.body, fontSize: 13, color: Colors.paleGreen, opacity: 0.8 },
  username: { fontFamily: Fonts.heading, fontSize: 24, color: Colors.accent, marginTop: 2 },
  headerIcons: { flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 40, height: 40, borderRadius: Radii.round, backgroundColor: "rgba(255, 255, 255, 0.05)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarCircle: { width: 40, height: 40, borderRadius: Radii.round, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", overflow: 'hidden', ...Shadows.s },
  avatar: { width: "100%", height: "100%" },
  avatarText: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.primary },
  searchWrapper: { marginHorizontal: Spacing.l, marginTop: 24 },
  searchUnderlineRow: { flexDirection: "row", alignItems: "center" },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 16, color: Colors.white, paddingVertical: 12 },
  underlineBar: { height: 1.5, opacity: 0.6 },
  body: { flex: 1, paddingHorizontal: Spacing.l, paddingTop: Spacing.l },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.m },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: 14, letterSpacing: 0.08, textTransform: "uppercase" },
  subSectionTitle: { fontFamily: Fonts.heading, fontSize: 12, letterSpacing: 0.1, marginBottom: Spacing.m, textTransform: "uppercase" },
  clearText: { fontFamily: Fonts.body, fontSize: 13, textDecorationLine: "underline" },
  genreScroll: { marginBottom: Spacing.xl },
  genreChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radii.round, marginRight: 10, borderWidth: 1 },
  activeChip: { backgroundColor: Colors.primary, borderColor: Colors.primary, ...Shadows.s },
  genreText: { fontFamily: Fonts.body, fontSize: 13, letterSpacing: 0.02 },
  activeGenreText: { color: Colors.accent, fontWeight: "600" },
  carouselSection: { marginBottom: Spacing.xl },
  carouselContent: { paddingLeft: 2 },
  carouselItem: { marginRight: Spacing.m },
  storiesList: { marginBottom: 40 },
  emptyText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 40 },
});
