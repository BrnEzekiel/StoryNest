import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, RefreshControl, Platform, Image, Animated, FlatList, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useNotice } from "../context/NoticeContext";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Search, Bell, X, Sparkles, Users } from "lucide-react-native";
import { StoryCard } from "../components/StoryCard";
import { useHiddenStories } from "../hooks/useHiddenStories";
import { SkeletonCard } from "../components/SkeletonCard";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { NotificationDot } from "../components/NotificationDot";
import apiClient from "../api/apiClient";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { tapThrottle, TAP_GAP_MS } from "../utils/rateLimit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const GENRES = ["All", "Fiction", "Romance", "Thriller", "Faith", "Mystery"];
const MOODS = ["All", "Cozy", "Epic", "Thrilling", "Dark", "Romantic", "Mysterious", "Uplifting"];
const TIMES = ["Any", "<10", "10-30", "30+"];

export const HomeScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const { user, hasUnreadMessages } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();
  const { t } = useTranslation();

  const [activeGenre, setActiveGenre] = useState("All");
  const [activeMood, setActiveMood] = useState("All");
  const [timeFilter, setTimeFilter] = useState("Any");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [greeting, setGreeting] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  const [tasteGenres, setTasteGenres] = useState<string[]>([]);
  const [quizDraft, setQuizDraft] = useState<string[]>([]);

  const searchFocusAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem("home:taste").then((raw) => {
      try { if (raw) setTasteGenres(JSON.parse(raw)); } catch {}
    }).catch(() => {});
  }, []);

  // Cached queries: instant paint from device, silent background sync.
  // Navigating away and back never blanks or reloads the screen.
  const storiesQuery = useCachedQuery<any[]>(
    searchQuery ? null : `home:stories:${activeGenre}:${activeMood}`,
    async () => {
      const params = new URLSearchParams();
      if (activeGenre !== "All") params.append("genre", activeGenre);
      if (activeMood !== "All") params.append("mood", activeMood);
      const qs = params.toString();
      const res = await apiClient.get(qs ? `/stories?${qs}` : "/stories");
      return res.data;
    }
  );
  const recsQuery = useCachedQuery<any[]>("home:recs", async () => {
    const res = await apiClient.get("/stories/recommendations");
    return res.data;
  });
  const bookmarksQuery = useCachedQuery<any[]>("home:bookmarks", async () => {
    const res = await apiClient.get("/users/me/bookmarks");
    return res.data;
  });

  const matchTime = (s: any) => {
    const mins = s.readingTime || 0;
    if (timeFilter === "<10") return mins < 10;
    if (timeFilter === "10-30") return mins >= 10 && mins <= 30;
    if (timeFilter === "30+") return mins > 30;
    return true;
  };
  const { hidden } = useHiddenStories();
  const rawStories = searchQuery ? (searchResults || []) : (storiesQuery.data || []);
  const stories = rawStories.filter(matchTime).filter((s: any) => !hidden.includes(s.id));
  const serverRecs = recsQuery.data || [];
  const tasteFiltered = tasteGenres.length > 0 ? serverRecs.filter((s: any) => tasteGenres.includes(s.genre)) : serverRecs;
  const recommendations = (tasteFiltered.length > 0 ? tasteFiltered : serverRecs).filter((s: any) => !hidden.includes(s.id));
  const updatedForYou = (bookmarksQuery.data || [])
    .map((b: any) => b.story)
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  const isFirstLoad = !searchQuery && storiesQuery.isFirstLoad && storiesQuery.data === null;

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
    setSearchResults(null);
    setActiveGenre("All");
    setActiveMood("All");
    setTimeFilter("Any");
    if (searchInputRef.current) searchInputRef.current.blur();
  }, []);

  // Handle explicit reset requests without refetching on every focus.
  useEffect(() => {
    if (route.params?.reset) {
      resetHome();
      navigation.setParams({ reset: undefined });
    }
  }, [route.params?.reset]);

  const onRefresh = () => {
    if (!tapThrottle("home:refresh", TAP_GAP_MS)) return;
    storiesQuery.refresh({ showIndicator: true });
    recsQuery.refresh();
    bookmarksQuery.refresh();
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    if (!tapThrottle("home:search", TAP_GAP_MS)) return;
    try {
      // Keep old results visible while searching; empty only if none yet.
      const params = new URLSearchParams({ q });
      if (activeGenre !== "All") params.append("genre", activeGenre);
      if (activeMood !== "All") params.append("mood", activeMood);
      const res = await apiClient.get(`/stories?${params.toString()}`);
      setSearchResults(res.data);
    } catch (error: any) {
      console.log("Error searching:", error);
      showNotice({ title: "Connection Problem", message: "We had trouble reaching the nest. Please check your internet and try again.", variant: "error" });
    }
  };

  const openQuiz = () => {
    setQuizDraft(tasteGenres);
    setShowQuiz(true);
  };

  const saveQuiz = () => {
    setTasteGenres(quizDraft);
    AsyncStorage.setItem("home:taste", JSON.stringify(quizDraft)).catch(() => {});
    setShowQuiz(false);
    recsQuery.refresh();
  };

  const toggleQuizGenre = (g: string) => {
    setQuizDraft((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
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
      {!searchQuery && updatedForYou.length > 0 && (
          <View style={styles.recsSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { fontFamily: fonts.heading, color: theme.primary }]}>{t("sec_updated")}</Text>
              </View>
              <FlatList
                data={updatedForYou}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item.id + '_upd'}
                renderItem={({ item, index }) => (
                    <StoryCard
                        story={item}
                        variant="compact"
                        index={index}
                        onPress={() => navigation.navigate("Reader", { storyId: item.id, story: item })}
                    />
                )}
              />
          </View>
      )}

      {!searchQuery && recommendations.length > 0 && (
          <View style={styles.recsSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { fontFamily: fonts.heading, color: theme.primary }]}>{t("sec_recs")}</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity onPress={openQuiz} style={{ marginRight: 8 }}><Text style={[styles.refineText, { fontFamily: fonts.heading }]}>REFINE</Text></TouchableOpacity>
                  <Sparkles size={16} color={Colors.accent} />
                </View>
              </View>
              <FlatList
                data={recommendations}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item.id + '_rec'}
                renderItem={({ item, index }) => (
                    <StoryCard
                        story={item}
                        variant="compact"
                        index={index}
                        onPress={() => navigation.navigate("Reader", { storyId: item.id, story: item })}
                    />
                )}
              />
          </View>
      )}

      {!searchQuery && featuredStory && (
        <StoryCard
          story={featuredStory}
          variant="featured"
          index={0}
          onPress={() => navigation.navigate("Reader", { storyId: featuredStory.id, story: featuredStory })}
        />
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.primary : theme.primary, fontFamily: fonts.heading }]}>
          {searchQuery ? "SEARCH RESULTS" : "GENRES"}
        </Text>
        {searchQuery && (
            <TouchableOpacity onPress={resetHome}><Text style={[styles.clearText, { color: Colors.mutedTeal, fontFamily: fonts.body }]}>Clear</Text></TouchableOpacity>
        )}
      </View>

      {!searchQuery && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
          {GENRES.map((genre) => (
            <TouchableOpacity
              key={genre}
              onPress={() => setActiveGenre(genre)}
              style={[styles.genreChip, activeGenre === genre ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}
            >
              <Text style={[styles.genreText, { fontFamily: fonts.body }, activeGenre === genre ? { color: theme.white, fontWeight: "600" } : { color: isDarkMode ? Colors.mutedTeal : Colors.primary }]}>
                {genre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!searchQuery && (
        <>
          <Text style={[styles.filterLabel, { fontFamily: fonts.heading, color: isDarkMode ? Colors.mutedTeal : Colors.primary }]}>MOOD</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
            {MOODS.map((mood) => (
              <TouchableOpacity
                key={mood}
                onPress={() => setActiveMood(mood)}
                style={[styles.genreChip, activeMood === mood ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}
              >
                <Text style={[styles.genreText, { fontFamily: fonts.body }, activeMood === mood ? { color: theme.white, fontWeight: "600" } : { color: isDarkMode ? Colors.mutedTeal : Colors.primary }]}>
                  {mood}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[styles.filterLabel, { fontFamily: fonts.heading, color: isDarkMode ? Colors.mutedTeal : Colors.primary }]}>READING TIME (MIN)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
            {TIMES.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTimeFilter(t)}
                style={[styles.genreChip, timeFilter === t ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}
              >
                <Text style={[styles.genreText, { fontFamily: fonts.body }, timeFilter === t ? { color: theme.white, fontWeight: "600" } : { color: isDarkMode ? Colors.mutedTeal : Colors.primary }]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {!searchQuery && newReleases.length > 0 && (
        <View style={styles.carouselSection}>
          <Text style={[styles.subSectionTitle, { color: isDarkMode ? Colors.mutedTeal : Colors.primary, fontFamily: fonts.heading }]}>NEW RELEASES</Text>
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
                onPress={() => navigation.navigate("Reader", { storyId: item.id, story: item })}
              />
            )}
          />
        </View>
      )}

      <Text style={[styles.subSectionTitle, { color: isDarkMode ? Colors.mutedTeal : Colors.primary, marginTop: Spacing.m, fontFamily: fonts.heading }]}>ALL STORIES</Text>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 10 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={resetHome} activeOpacity={0.7}>
            <Text style={[styles.greeting, { fontFamily: fonts.body }]}>{greeting}</Text>
            <Text style={[styles.username, { fontFamily: fonts.heading }]}>StoryNest</Text>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            <TouchableOpacity
                style={styles.iconCircle}
                onPress={() => navigation.navigate("ActivityFeed")}
            >
              <Bell size={20} color={Colors.accent} />
              {hasUnreadMessages && <NotificationDot />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={() => navigation.navigate("Profile")}
            >
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                    <Text style={[styles.avatarText, { fontFamily: fonts.heading }]}>{user?.username?.substring(0, 2).toUpperCase() || "SN"}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchWrapper}>
          <View style={styles.searchUnderlineRow}>
            <Search size={18} color={Colors.mutedTeal} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              placeholder="Search stories..."
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              style={[styles.searchInput, { fontFamily: fonts.body }, Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })]}
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                if (!t) setSearchResults(null);
              }}
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

      {isFirstLoad ? (
        <View style={{ flex: 1, paddingHorizontal: Spacing.l, marginTop: Spacing.m }}>
          <SkeletonCard variant="featured" />
          <Text style={[styles.subSectionTitle, { color: isDarkMode ? Colors.mutedTeal : Colors.primary, marginBottom: 20, fontFamily: fonts.heading }]}>NEW RELEASES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 32 }}>
            {[1, 2, 3].map(i => <SkeletonCard key={i} variant="compact" />)}
          </ScrollView>
          <Text style={[styles.subSectionTitle, { color: isDarkMode ? Colors.mutedTeal : Colors.primary, marginBottom: 20, fontFamily: fonts.heading }]}>ALL STORIES</Text>
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
              onPress={() => navigation.navigate("Reader", { storyId: item.id, story: item })}
            />
          )}
          style={styles.body}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={storiesQuery.refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          ListEmptyComponent={<Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No stories found in the nest.</Text>}
        />
      )}

      <Modal visible={showQuiz} animationType="slide" transparent onRequestClose={() => setShowQuiz(false)}>
        <View style={styles.quizOverlay}>
          <View style={[styles.quizContent, { backgroundColor: theme.white, paddingBottom: insets.bottom + 32 }]}>
            <Text style={[styles.quizTitle, { fontFamily: fonts.heading, color: theme.primary }]}>WHAT DO YOU LOVE?</Text>
            <Text style={[styles.quizSub, { fontFamily: fonts.body }]}>Pick genres to tune your recommendations.</Text>
            <View style={styles.quizWrap}>
              {GENRES.filter((g) => g !== "All").map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => toggleQuizGenre(g)}
                  style={[styles.genreChip, quizDraft.includes(g) ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: Colors.paleGreen }]}
                >
                  <Text style={[styles.genreText, { fontFamily: fonts.body }, quizDraft.includes(g) ? { color: theme.white, fontWeight: "600" } : { color: Colors.primary }]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.quizActions}>
              <TouchableOpacity style={[styles.quizBtn, { backgroundColor: theme.primary }]} onPress={saveQuiz}>
                <Text style={[styles.quizBtnText, { fontFamily: fonts.heading }]}>SAVE TASTE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quizBtn} onPress={() => setShowQuiz(false)}>
                <Text style={[styles.quizBtnGhost, { fontFamily: fonts.heading }]}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: Spacing.l },
  headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.l },
  greeting: { fontSize: 13, color: Colors.paleGreen, opacity: 0.8 },
  username: { fontSize: 24, color: Colors.accent, marginTop: 2 },
  headerIcons: { flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 40, height: 40, borderRadius: Radii.round, backgroundColor: "rgba(255, 255, 255, 0.05)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarCircle: { width: 40, height: 40, borderRadius: Radii.round, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", overflow: 'hidden', ...Shadows.s },
  avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: "100%", height: "100%" },
  avatarText: { fontSize: 14, color: Colors.primary },
  searchWrapper: { marginHorizontal: Spacing.l, marginTop: 24 },
  searchUnderlineRow: { flexDirection: "row", alignItems: "center" },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: Colors.white, paddingVertical: 12 },
  underlineBar: { height: 1.5, opacity: 0.6 },
  body: { flex: 1, paddingHorizontal: Spacing.l, paddingTop: Spacing.l },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.m },
  sectionTitle: { fontSize: 14, letterSpacing: 0.08, textTransform: "uppercase" },
  subSectionTitle: { fontSize: 12, letterSpacing: 0.1, marginBottom: Spacing.m, textTransform: "uppercase" },
  clearText: { fontSize: 13, textDecorationLine: "underline" },
  genreScroll: { marginBottom: Spacing.xl },
  genreChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radii.round, marginRight: 10, borderWidth: 1 },
  genreText: { fontSize: 13, letterSpacing: 0.02 },
  carouselSection: { marginBottom: Spacing.xl },
  carouselContent: { paddingLeft: 2 },
  carouselItem: { marginRight: Spacing.m },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 40 },
  recsSection: { marginBottom: 32 },
  refineText: { fontSize: 11, color: Colors.accent, letterSpacing: 1 },
  filterLabel: { fontSize: 11, letterSpacing: 0.1, marginBottom: 8, textTransform: "uppercase" },
  quizOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  quizContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28 },
  quizTitle: { fontSize: 18, letterSpacing: 1, marginBottom: 4 },
  quizSub: { fontSize: 13, color: Colors.mutedTeal, marginBottom: 20 },
  quizWrap: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  quizActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  quizBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center", marginHorizontal: 4 },
  quizBtnText: { fontSize: 12, color: Colors.accent, letterSpacing: 1 },
  quizBtnGhost: { fontSize: 12, color: Colors.mutedTeal, letterSpacing: 1 },
});
