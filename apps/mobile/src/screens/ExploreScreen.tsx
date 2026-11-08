import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, RefreshControl, Platform, Animated, Dimensions, ImageBackground, Image } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Search, X, TrendingUp, Sparkles, Filter, Shuffle, Ticket, Users, PenLine, ChevronRight, Clock, Mic } from "lucide-react-native";
import Voice from "@react-native-voice/voice";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNotice } from "../context/NoticeContext";
import { useTranslation } from "react-i18next";
import { StoryCard } from "../components/StoryCard";
import { useHiddenStories } from "../hooks/useHiddenStories";
import { SkeletonCard } from "../components/SkeletonCard";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { tapThrottle, TAP_GAP_MS } from "../utils/rateLimit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { HeaderWave } from "../components/HeaderWave";

const { width } = Dimensions.get("window");

const COLLECTIONS = [
  { name: "Cozy Nights", genre: "Romance", mood: "Cozy" },
  { name: "Adrenaline", genre: "Thriller", mood: "Thrilling" },
  { name: "Other Worlds", genre: "Sci-Fi", mood: "Epic" },
  { name: "Faith & Heart", genre: "Faith", mood: "Uplifting" },
];

export const ExploreScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [collectionLabel, setCollectionLabel] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [betaCode, setBetaCode] = useState("");
  const [betaBusy, setBetaBusy] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    Voice.onSpeechResults = (e: any) => {
      const text = e?.value?.[0] || "";
      setListening(false);
      if (text) { setSearchQuery(text); fetchFilteredStories(text); }
    };
    Voice.onSpeechError = () => setListening(false);
    return () => { Voice.destroy().then(() => Voice.removeAllListeners()).catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startVoiceSearch = async () => {
    try {
      const available = await Voice.isAvailable().catch(() => false);
      if (!available) {
        showNotice({ title: "Voice unavailable", message: "Speech recognition is not available on this device.", variant: "info" });
        return;
      }
      setListening(true);
      await Voice.start("en-US");
    } catch { setListening(false); }
  };

  const searchFocusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem("explore:recent").then((raw) => {
      try { if (raw) setRecentSearches(JSON.parse(raw)); } catch {}
    }).catch(() => {});
  }, []);

  const storiesQuery = useCachedQuery<any[]>(searchQuery ? null : "explore:stories", async () => {
    const res = await apiClient.get("/stories?limit=10");
    return res.data;
  });
  const trendingQuery = useCachedQuery<any[]>("explore:trending", async () => {
    const res = await apiClient.get("/stories/trending");
    return res.data;
  });

  const { hidden } = useHiddenStories();
  const stories = ((searchQuery || collectionLabel) ? (searchResults || []) : (storiesQuery.data || [])).filter((s: any) => !hidden.includes(s.id));
  const trending = trendingQuery.data || [];
  const isFirstLoad = !searchQuery && !collectionLabel && storiesQuery.isFirstLoad && storiesQuery.data === null;

  const saveRecent = (q: string) => {
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6);
      AsyncStorage.setItem("explore:recent", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const fetchFilteredStories = async (query = "") => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    if (!tapThrottle("explore:search", TAP_GAP_MS)) return;
    try {
      const res = await apiClient.get(`/stories?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data);
      setCollectionLabel(null);
      saveRecent(q);
    } catch (error) { console.log(error); }
  };

  const clearResults = () => {
    setSearchQuery("");
    setSearchResults(null);
    setCollectionLabel(null);
  };

  const handleCollection = async (col: { name: string; genre: string; mood: string }) => {
    if (collectionLabel === col.name) { clearResults(); return; }
    if (!tapThrottle(`explore:col:${col.name}`, TAP_GAP_MS)) return;
    try {
      const res = await apiClient.get(`/stories?genre=${encodeURIComponent(col.genre)}&mood=${encodeURIComponent(col.mood)}&limit=12`);
      setSearchQuery("");
      setSearchResults(res.data);
      setCollectionLabel(col.name);
    } catch (error) { console.log(error); }
  };

  const handleBetaRedeem = async () => {
    const c = betaCode.trim().toUpperCase();
    if (!c || betaBusy) return;
    setBetaBusy(true);
    try {
      const res = await apiClient.post("/beta/redeem", { code: c });
      setBetaCode("");
      navigation.navigate("Reader", { storyId: res.data.storyId });
    } catch (e) { showNotice({ title: "Invalid code", message: "No story uses that beta code.", variant: "error" }); }
    finally { setBetaBusy(false); }
  };

  const spotlight = trending.length > 0
    ? trending.reduce((best: any, s: any) => {
        const score = (s._count?.likes || 0) * 2 + (s._count?.history || 0);
        const bestScore = (best._count?.likes || 0) * 2 + (best._count?.history || 0);
        return score > bestScore ? s : best;
      })
    : null;

  const onRefresh = () => {
    if (!tapThrottle("explore:refresh", TAP_GAP_MS)) return;
    storiesQuery.refresh({ showIndicator: true });
    trendingQuery.refresh();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={styles.headerContainer}>
        <ImageBackground source={require("../../assets/auth-bg.jpg")} style={[styles.headerBg, { paddingTop: insets.top + 20 }]} resizeMode="cover">
            <LinearGradient colors={["rgba(0, 30, 28, 0.85)", "rgba(0, 30, 28, 0.99)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.headerContent}><Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>EXPLORE THE NEST</Text></View>
            <View style={styles.searchWrapper}>
              <View style={styles.searchBar}>
                <Search size={18} color={Colors.accent} style={styles.searchIcon} />
                <TextInput placeholder={listening ? "Listening..." : "Search..."} placeholderTextColor="rgba(255, 237, 168, 0.5)" style={[styles.searchInput, { fontFamily: fonts.body }, Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })]} value={searchQuery} onChangeText={(t) => { setSearchQuery(t); if (!t) { setSearchResults(null); setCollectionLabel(null); } }} onSubmitEditing={() => fetchFilteredStories(searchQuery)} />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={clearResults}>
                    <X size={18} color={Colors.accent} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={startVoiceSearch} style={{ marginLeft: 10 }} accessibilityLabel="Voice search">
                  <Mic size={18} color={listening ? "#FF6B6B" : Colors.accent} />
                </TouchableOpacity>
              </View>
            </View>
            <HeaderWave color={theme.white} />
        </ImageBackground>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} refreshControl={<RefreshControl refreshing={storiesQuery.refreshing} onRefresh={onRefresh} />}>
        {!searchQuery && recentSearches.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
                {recentSearches.map((r) => (
                    <TouchableOpacity key={r} style={styles.recentChip} onPress={() => { setSearchQuery(r); fetchFilteredStories(r); }}>
                        <Clock size={12} color={Colors.mutedTeal} />
                        <Text style={[styles.recentText, { fontFamily: fonts.body }]}>{r}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        )}
        <View style={styles.section}>
            <View style={styles.sectionHeader}><TrendingUp size={16} color={theme.primary} /><Text style={[styles.sectionTitle, { marginLeft: 8, color: theme.primary, fontFamily: fonts.heading }]}>{t("sec_trending")}</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                {isFirstLoad ? [1,2].map(i => <View key={i} style={styles.trendingSkeleton} />) : trending.map(s => (
                    <TouchableOpacity key={s.id} style={styles.trendingCard} onPress={() => navigation.navigate("Reader", { storyId: s.id, story: s })}>
                        <View style={[styles.trendingImg, { backgroundColor: theme.primary + '10' }]}>
                            {s.coverUrl ? (
                                <Image source={{ uri: s.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            ) : (
                                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                                    <TrendingUp size={32} color={theme.primary} opacity={0.2} />
                                </View>
                            )}
                        </View>
                        <Text style={[styles.trendingTitle, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{s.title}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {!searchQuery && spotlight && (
            <View style={styles.section}>
                <View style={styles.sectionHeader}><Sparkles size={16} color={theme.primary} /><Text style={[styles.sectionTitle, { marginLeft: 8, color: theme.primary, fontFamily: fonts.heading }]}>{t("sec_spotlight")}</Text></View>
                <TouchableOpacity
                    style={[styles.spotCard, { backgroundColor: theme.primary }]}
                    onPress={() => spotlight.ownerId
                      ? navigation.navigate("UserProfile", { userId: spotlight.ownerId })
                      : navigation.navigate("Reader", { storyId: spotlight.id, story: spotlight })}
                >
                    {spotlight.coverUrl ? (
                        <Image source={{ uri: spotlight.coverUrl }} style={styles.spotCover} resizeMode="cover" />
                    ) : <View style={styles.spotCover} />}
                    <View style={styles.spotInfo}>
                        <Text style={[styles.spotAuthor, { fontFamily: fonts.heading }]} numberOfLines={1}>{spotlight.authorName}</Text>
                        <Text style={[styles.spotTitle, { fontFamily: fonts.body }]} numberOfLines={2}>“{spotlight.title}”</Text>
                        <Text style={[styles.spotMeta, { fontFamily: fonts.body }]}>{spotlight._count?.likes || 0} likes • {spotlight.genre}</Text>
                    </View>
                    <ChevronRight size={20} color={Colors.accent} />
                </TouchableOpacity>
            </View>
        )}

        {!searchQuery && (
            <View style={styles.section}>
                <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>{t("sec_collections")}</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                    {COLLECTIONS.map((c) => (
                        <TouchableOpacity
                            key={c.name}
                            style={[styles.collectionCard, collectionLabel === c.name && { borderColor: Colors.accent, borderWidth: 2 }]}
                            onPress={() => handleCollection(c)}
                        >
                            <Text style={[styles.collectionName, { fontFamily: fonts.heading }]}>{c.name}</Text>
                            <Text style={[styles.collectionMeta, { fontFamily: fonts.body }]}>{c.genre} • {c.mood}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        )}

        {!searchQuery && (
            <View style={styles.section}>
                <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>{t("sec_community")}</Text></View>
                <View style={styles.communityRow}>
                    <TouchableOpacity style={[styles.communityCard, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate("Clubs")}>
                        <Users size={22} color={Colors.accent} />
                        <Text style={[styles.communityTitle, { fontFamily: fonts.heading }]}>BOOK CLUBS</Text>
                        <Text style={[styles.communitySub, { fontFamily: fonts.body }]}>Read together</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.communityCard, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate("Requests")}>
                        <PenLine size={22} color={Colors.accent} />
                        <Text style={[styles.communityTitle, { fontFamily: fonts.heading }]}>REQUESTS</Text>
                        <Text style={[styles.communitySub, { fontFamily: fonts.body }]}>Ask for stories</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )}

        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>{searchQuery ? t("sec_search") : (collectionLabel ? collectionLabel.toUpperCase() : t("sec_latest"))}</Text>
                {(searchQuery || collectionLabel) && (
                    <TouchableOpacity onPress={clearResults}><Text style={[styles.clearText, { fontFamily: fonts.body }]}>Clear</Text></TouchableOpacity>
                )}
            </View>
            <View style={styles.listContainer}>
                {isFirstLoad ? [1,2].map(i => <SkeletonCard key={i} />) : stories.length === 0 ? (
                    <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>{collectionLabel ? "Nothing in this collection yet." : "No stories found."}</Text>
                ) : stories.map((s, i) => <StoryCard key={s.id} story={s} index={i} onPress={() => navigation.navigate("Reader", { storyId: s.id, story: s })} />)}
            </View>
        </View>

        <View style={styles.section}>
            <View style={[styles.betaRow, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : Colors.paleGreen }]}>
                <Ticket size={20} color={theme.primary} />
                <TextInput
                    style={[styles.betaInput, { fontFamily: fonts.body, color: theme.black }]}
                    placeholder="Have a beta code?"
                    placeholderTextColor={Colors.mutedTeal}
                    value={betaCode}
                    onChangeText={(t) => setBetaCode(t.toUpperCase())}
                    onSubmitEditing={handleBetaRedeem}
                    returnKeyType="go"
                    autoCapitalize="characters"
                />
                <TouchableOpacity style={[styles.betaBtn, { backgroundColor: theme.primary }]} onPress={handleBetaRedeem} disabled={betaBusy}>
                    <Text style={[styles.betaBtnText, { fontFamily: fonts.heading }]}>{betaBusy ? "..." : "GO"}</Text>
                </TouchableOpacity>
            </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { overflow: 'hidden' },
  headerBg: { paddingBottom: 60 },
  headerContent: { paddingHorizontal: 32, marginBottom: 20, alignItems: 'center' },
  headerTitle: { fontSize: 18, color: Colors.accent, letterSpacing: 3 },
  searchWrapper: { paddingHorizontal: 40 },
  searchBar: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1.5, borderBottomColor: "rgba(255, 237, 168, 0.2)", height: 48 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.accent },
  body: { flex: 1 },
  section: { marginTop: 32 },
  sectionHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" },
  trendingCard: { width: 140, marginRight: 16 },
  trendingImg: { width: 140, height: 200, borderRadius: 16, marginBottom: 8 },
  trendingTitle: { fontSize: 14 },
  trendingSkeleton: { width: 140, height: 200, borderRadius: 16, marginRight: 16, backgroundColor: 'rgba(0,0,0,0.05)' },
  listContainer: { paddingHorizontal: 24 },
  recentRow: { paddingHorizontal: 24, paddingTop: 20 },
  recentChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.05)", marginRight: 8 },
  recentText: { fontSize: 12, marginLeft: 6, color: Colors.mutedTeal },
  spotCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 24, borderRadius: 16, padding: 14 },
  spotCover: { width: 56, height: 80, borderRadius: 10 },
  spotInfo: { flex: 1, marginLeft: 14 },
  spotAuthor: { fontSize: 15, color: Colors.accent, letterSpacing: 0.5 },
  spotTitle: { fontSize: 13, color: "#FFFFFF", marginTop: 2, opacity: 0.9 },
  spotMeta: { fontSize: 11, color: Colors.mutedTeal, marginTop: 4 },
  collectionCard: { width: 150, borderRadius: 16, padding: 16, marginRight: 12, backgroundColor: Colors.primary, borderWidth: 2, borderColor: "transparent" },
  collectionName: { fontSize: 14, color: Colors.accent },
  collectionMeta: { fontSize: 11, color: Colors.mutedTeal, marginTop: 4 },
  communityRow: { flexDirection: "row", paddingHorizontal: 24 },
  communityCard: { flex: 1, borderRadius: 16, padding: 16, marginRight: 12 },
  communityTitle: { fontSize: 13, color: Colors.accent, marginTop: 10, letterSpacing: 1 },
  communitySub: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  clearText: { fontSize: 13, color: Colors.mutedTeal, textDecorationLine: "underline" },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 20 },
  betaRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 24, borderRadius: 16, padding: 12, paddingLeft: 16 },
  betaInput: { flex: 1, fontSize: 14, marginLeft: 10, paddingVertical: 8 },
  betaBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  betaBtnText: { fontSize: 12, color: Colors.accent, letterSpacing: 1 },
});
