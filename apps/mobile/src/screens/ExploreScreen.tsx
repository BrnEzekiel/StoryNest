import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator, Platform, Animated, Dimensions, ImageBackground, Image } from "react-native";
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

export const ExploreScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [stories, setStories] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const searchFocusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
      setLoading(true);
      try {
          const [storiesRes, trendingRes] = await Promise.all([
              apiClient.get("/stories?limit=10"),
              apiClient.get("/stories/trending")
          ]);
          setStories(storiesRes.data);
          setTrending(trendingRes.data);
      } catch (e) { console.log(e); }
      finally { setLoading(false); setRefreshing(false); }
  };

  const fetchFilteredStories = async (query = "") => {
    setLoading(true);
    try {
      let url = query ? `/stories?q=${query}` : "/stories?limit=20";
      const res = await apiClient.get(url);
      setStories(res.data);
    } catch (error) { console.log(error); } 
    finally { setLoading(false); }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchInitialData();
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
                <TextInput placeholder="Search..." placeholderTextColor="rgba(255, 237, 168, 0.5)" style={[styles.searchInput, { fontFamily: fonts.body }, Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })]} value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={() => fetchFilteredStories(searchQuery)} />
              </View>
            </View>
            <HeaderWave color={theme.white} />
        </ImageBackground>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.section}>
            <View style={styles.sectionHeader}><TrendingUp size={16} color={theme.primary} /><Text style={[styles.sectionTitle, { marginLeft: 8, color: theme.primary, fontFamily: fonts.heading }]}>TRENDING NOW</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                {loading ? [1,2].map(i => <View key={i} style={styles.trendingSkeleton} />) : trending.map(s => (
                    <TouchableOpacity key={s.id} style={styles.trendingCard} onPress={() => navigation.navigate("Reader", { storyId: s.id })}>
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

        <View style={styles.section}>
            <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>{searchQuery ? "SEARCH RESULTS" : "LATEST UPDATES"}</Text></View>
            <View style={styles.listContainer}>{loading ? [1,2].map(i => <SkeletonCard key={i} />) : stories.map((s, i) => <StoryCard key={s.id} story={s} index={i} onPress={() => navigation.navigate("Reader", { storyId: s.id })} />)}</View>
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
  listContainer: { paddingHorizontal: 24 }
});
