import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Animated, 
  Alert, 
  Dimensions, 
  Modal, 
  Image 
} from "react-native";
import { Colors, Shadows } from "../theme/colors";
import { ArrowLeft, Bookmark, Heart, MessageSquare, StickyNote, X, AlertTriangle, Lock, Book, Globe, ChevronLeft, ChevronRight, List, Star } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import axios from "axios";

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get("window");

const FONT_SIZES = { small: 15, medium: 18, large: 22 };

export const StoryReaderScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { storyId } = route.params;
  const { user } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();
  
  const [story, setStory] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [currentChapter, setCurrentChapter] = useState<any>(null);
  const [originalBody, setOriginalBody] = useState("");
  const [fontSizeMode, setFontSizeMode] = useState<"small" | "medium" | "large">("medium");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Feature 16-17: Dictionary/Translate
  const [showDictionary, setShowDictionary] = useState(false);
  const [lookupWord, setLookupWord] = useState("");
  const [definition, setDefinition] = useState<any>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [currentLang, setCurrentLang] = useState("English");

  // Feature 24-25: TOC / Warnings
  const [showTOC, setShowTOC] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const progressBarWidth = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);

  const fontSize = FONT_SIZES[fontSizeMode];

  useEffect(() => {
    loadSavedSettings();
    fetchStory();
  }, [storyId]);

  useEffect(() => {
    Animated.timing(progressBarWidth, { toValue: scrollProgress, duration: 300, useNativeDriver: false }).start();
  }, [scrollProgress]);

  const loadSavedSettings = async () => {
    const savedFont = await AsyncStorage.getItem("readerFontSize");
    if (savedFont) setFontSizeMode(savedFont as any);
  };

  const fetchStory = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/stories/${storyId}`);
      setStory(res.data);
      setChapters(res.data.chapters || []);
      setLikeCount(res.data._count?.likes || 0);
      setIsLiked(res.data.isLiked);
      
      if (res.data.contentWarnings || res.data.isAdult) {
          setShowWarning(true);
      }

      if (res.data.chapters?.length > 0) {
          await loadChapter(res.data.chapters[0].id);
      }
      
      const bookmarksRes = await apiClient.get("/users/me/bookmarks");
      const bookmark = bookmarksRes.data.find((b: any) => b.storyId === storyId);
      setIsBookmarked(!!bookmark);

      await apiClient.post(`/stories/${storyId}/read`);
    } catch (error) { 
        console.log("[Reader] Fetch error:", error); 
    } finally { 
        setLoading(false); 
    }
  };

  const loadChapter = async (chapterId: string) => {
      setLoading(true);
      try {
          const res = await apiClient.get(`/chapters/${chapterId}`);
          setCurrentChapter(res.data);
          setOriginalBody(res.data.body);
          scrollViewRef.current?.scrollTo({ y: 0, animated: false });
          setScrollProgress(0);
          setShowTOC(false);
      } catch (e) { 
          console.log("[Reader] Load chapter error:", e); 
      } finally { 
          setLoading(false); 
      }
  };

  const fetchReviews = async () => {
      setReviewsLoading(true);
      try {
          const res = await apiClient.get(`/stories/${storyId}/reviews`);
          setReviews(res.data);
      } catch (e) { console.log(e); }
      finally { setReviewsLoading(false); }
  };

  const handlePostReview = async () => {
      if (!reviewContent.trim()) return;
      try {
          await apiClient.post(`/stories/${storyId}/reviews`, { rating: reviewRating, content: reviewContent });
          setReviewContent("");
          fetchReviews();
      } catch (e) { console.log(e); }
  };

  const handleLookup = async () => {
      if (!lookupWord.trim()) return;
      setDictLoading(true);
      try {
          const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${lookupWord.trim()}`);
          setDefinition(res.data[0]);
      } catch (e) { Alert.alert("Not found", "Definition not found."); }
      finally { setDictLoading(false); }
  };

  const handleTranslate = async (lang: string) => {
      if (lang === "Original") { setCurrentChapter({ ...currentChapter, body: originalBody }); setCurrentLang("English"); setShowTranslate(false); return; }
      setShowTranslate(false);
      try {
          const res = await apiClient.post("/ai/translate", { text: originalBody, targetLanguage: lang });
          setCurrentChapter({ ...currentChapter, body: res.data.result });
          setCurrentLang(lang);
      } catch (e) { Alert.alert("Error", "Translation failed."); }
  };

  const handleLike = async () => {
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      const res = await apiClient.post(`/stories/${storyId}/like`);
      setIsLiked(res.data.isLiked);
      setLikeCount(res.data.likes);
    } catch (error) { setIsLiked(wasLiked); }
  };

  const handleBookmark = async () => {
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);
    try {
      const progress = wasBookmarked ? -1 : Math.round(scrollProgress * 100);
      await apiClient.post(`/stories/${storyId}/bookmark`, { progress });
    } catch (error) { setIsBookmarked(wasBookmarked); }
  };

  if (loading && !currentChapter) {
      return (
          <View style={[styles.container, { backgroundColor: theme.white, justifyContent: 'center' }]}>
              <ActivityIndicator size="large" color={theme.primary} />
          </View>
      );
  }

  const paragraphs = currentChapter?.body ? currentChapter.body.split('\n\n') : [];
  const currentChapterIdx = chapters.findIndex(c => c.id === currentChapter?.id);

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} animated={true} />
      <View style={[styles.topBar, { backgroundColor: theme.white, paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft size={24} color={theme.black} /></TouchableOpacity>
          <View style={styles.topBarIcons}>
            <TouchableOpacity onPress={() => setThemeMode(isDarkMode ? "light" : "dark")} style={styles.iconBtn}>
                {isDarkMode ? <Sun size={20} color={theme.black} /> : <Moon size={20} color={theme.black} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTOC(true)} style={styles.iconBtn}><List size={20} color={theme.black} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTranslate(true)} style={styles.iconBtn}><Globe size={20} color={theme.black} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDictionary(true)} style={styles.iconBtn}><Book size={20} color={theme.black} /></TouchableOpacity>
            <TouchableOpacity onPress={handleBookmark} style={styles.iconBtn}><Bookmark size={20} color={isBookmarked ? Colors.accent : theme.black} fill={isBookmarked ? Colors.accent : "none"} /></TouchableOpacity>
          </View>
        </View>
        <View style={styles.progressContainer}><Animated.View style={[styles.progressBar, { width: progressBarWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: theme.primary }]} /></View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          const totalHeight = contentSize.height - layoutMeasurement.height;
          setScrollProgress(totalHeight > 0 ? contentOffset.y / totalHeight : 0);
          scrollY.current = contentOffset.y;
        }} 
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={styles.header}>
          <Text style={[styles.genre, { color: theme.primary, fontFamily: fonts.body }]}>{story?.genre}</Text>
          <Text style={[styles.title, { color: theme.black, fontFamily: fonts.heading }]}>{story?.title}</Text>
          <View style={styles.chapterHeader}>
              <Text style={[styles.chapterLabel, { color: Colors.mutedTeal, fontFamily: fonts.heading }]}>
                  {currentChapter?.title ? currentChapter.title.toUpperCase() : "CHAPTER 1"}
              </Text>
              <TouchableOpacity onPress={() => { setShowReviews(true); fetchReviews(); }} style={styles.ratingBox}>
                  <Star size={14} color="#FFD700" fill="#FFD700" />
                  <Text style={[styles.ratingText, { fontFamily: fonts.heading }]}>{story?._count?.reviews || 0} reviews</Text>
              </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.bodyContainer}>
          {paragraphs.length > 0 ? paragraphs.map((para, idx) => (
            <Text key={idx} style={[styles.bodyText, { color: theme.black, fontFamily: fonts.body, fontSize, lineHeight: fontSize * 1.75, marginBottom: 20 }]}>{para}</Text>
          )) : (
            <Text style={[styles.bodyText, { color: theme.black, opacity: 0.5, fontStyle: 'italic', textAlign: 'center', marginTop: 40 }]}>No content found for this chapter.</Text>
          )}
        </View>
        
        {chapters.length > 1 && (
            <View style={styles.chapterNav}>
                <TouchableOpacity style={[styles.navBtn, currentChapterIdx <= 0 && { opacity: 0.3 }]} disabled={currentChapterIdx <= 0} onPress={() => loadChapter(chapters[currentChapterIdx - 1].id)}><ChevronLeft size={24} color={theme.black} /><Text style={styles.navBtnText}>Previous</Text></TouchableOpacity>
                <Text style={[styles.navProgress, { fontFamily: fonts.heading }]}>{currentChapterIdx + 1} / {chapters.length}</Text>
                <TouchableOpacity style={[styles.navBtn, currentChapterIdx >= chapters.length - 1 && { opacity: 0.3 }]} disabled={currentChapterIdx >= chapters.length - 1} onPress={() => loadChapter(chapters[currentChapterIdx + 1].id)}><Text style={styles.navBtnText}>Next</Text><ChevronRight size={24} color={theme.black} /></TouchableOpacity>
            </View>
        )}
      </ScrollView>

      {/* Modals: Warning, TOC */}
      <Modal visible={showWarning} animationType="fade" transparent>
          <View style={styles.centeredOverlay}>
              <View style={[styles.warningContent, { backgroundColor: theme.white }]}>
                  <AlertTriangle size={48} color={Colors.error} />
                  <Text style={[styles.modalTitle, { color: theme.black, fontFamily: fonts.heading, marginTop: 20 }]}>ADVISORY</Text>
                  <Text style={[styles.modalDesc, { fontFamily: fonts.body, textAlign: 'center' }]}>{story?.contentWarnings || "General adult themes."}</Text>
                  <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setShowWarning(false)}>
                      <Text style={styles.actionBtnTextPrimary}>I UNDERSTAND</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      <Modal visible={showTOC} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: theme.white, paddingTop: insets.top + 20 }]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.black, fontFamily: fonts.heading }]}>CHAPTERS</Text><TouchableOpacity onPress={() => setShowTOC(false)}><X size={24} color={theme.black} /></TouchableOpacity></View>
              <ScrollView style={{ padding: 24 }}>{chapters.map((c, i) => (<TouchableOpacity key={c.id} style={[styles.tocItem, currentChapter?.id === c.id && { backgroundColor: theme.primary + '10' }]} onPress={() => loadChapter(c.id)}><Text style={[styles.tocOrder, { color: theme.primary }]}>{i + 1}</Text><Text style={[styles.tocTitle, { color: theme.black }]}>{c.title}</Text></TouchableOpacity>))}</ScrollView>
          </View>
      </Modal>

      <View style={[styles.bottomBar, { backgroundColor: theme.white, borderTopColor: 'rgba(0,0,0,0.05)', paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bottomBarContent}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn}><Heart size={22} color={isLiked ? "red" : theme.black} fill={isLiked ? "red" : "none"} /><Text style={styles.actionCount}>{likeCount}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}><MessageSquare size={22} color={theme.black} /><Text style={styles.actionCount}>{story?._count?.comments || 0}</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  topBarContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  topBarIcons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { marginLeft: 16 },
  progressContainer: { height: 2, width: "100%" },
  progressBar: { height: "100%" },
  content: { flex: 1 },
  header: { paddingHorizontal: 24, marginTop: 40, marginBottom: 40 },
  genre: { fontSize: 13, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.1, fontWeight: "700" },
  title: { fontSize: 36, lineHeight: 42, marginBottom: 12 },
  chapterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chapterLabel: { fontSize: 14, letterSpacing: 2 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  ratingText: { fontSize: 11, marginLeft: 6, color: '#8B6508' },
  bodyContainer: { paddingHorizontal: 24, marginBottom: 40 },
  bodyText: { fontSize: 18 },
  chapterNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', marginBottom: 100 },
  navBtn: { flexDirection: 'row', alignItems: 'center' },
  navBtnText: { fontSize: 14, marginHorizontal: 8 },
  navProgress: { fontSize: 16 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingTop: 16 },
  bottomBarContent: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingHorizontal: 20 },
  actionBtn: { flexDirection: "row", alignItems: "center", padding: 8 },
  actionCount: { fontSize: 13, marginLeft: 8 },
  modalOverlay: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24 },
  modalTitle: { fontSize: 18, letterSpacing: 1 },
  modalDesc: { color: Colors.mutedTeal, marginBottom: 24, paddingHorizontal: 40 },
  centeredOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)' },
  warningContent: { width: WINDOW_WIDTH - 64, borderRadius: 32, padding: 32, alignItems: 'center' },
  actionBtnPrimary: { backgroundColor: Colors.primary, width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 24 },
  actionBtnTextPrimary: { color: Colors.accent, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  tocItem: { flexDirection: 'row', alignItems: 'center', padding: 20, justifyContent: 'space-between' },
  tocOrder: { fontSize: 20, width: 40, opacity: 0.3 },
  tocTitle: { fontSize: 16 },
});
