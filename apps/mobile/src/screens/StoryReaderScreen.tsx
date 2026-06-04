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
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl
} from "react-native";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { 
  ArrowLeft, 
  Bookmark, 
  Heart, 
  MessageSquare, 
  X, 
  AlertTriangle, 
  Lock, 
  Book, 
  Globe, 
  ChevronLeft, 
  ChevronRight, 
  List, 
  Star, 
  Moon, 
  Sun, 
  Send,
  Palette
} from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import axios from "axios";

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get("window");
const FONT_SIZES = { small: 15, medium: 18, large: 22 };

const READER_THEMES = {
  light: { bg: "#FFFFFF", text: "#003631", meta: "#7db8b2", primary: "#003631" },
  dark: { bg: "#121212", text: "#FFFFFF", meta: "#7db8b2", primary: "#FFEDA8" },
  sepia: { bg: "#f4ecd8", text: "#433422", meta: "#5f4b32", primary: "#5f4b32" },
  solarized: { bg: "#fdf6e3", text: "#073642", meta: "#586e75", primary: "#268bd2" },
  oled: { bg: "#000000", text: "#FFFFFF", meta: "#7db8b2", primary: "#FFEDA8" }
};

export const StoryReaderScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { storyId } = route.params;
  const { user, refreshUser } = useAuth();
  const { theme: appTheme, fonts, isDarkMode: appIsDarkMode, setThemeMode } = useTheme();
  
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
  const [targetProgress, setTargetProgress] = useState(0);
  const [hasResumed, setHasResumed] = useState(false);
  
  // Reader Theme
  const [readerThemeMode, setReaderThemeMode] = useState<string>(user?.readerTheme || "light");
  const readerTheme = READER_THEMES[readerThemeMode as keyof typeof READER_THEMES] || READER_THEMES.light;
  const isReaderDark = readerThemeMode === "dark" || readerThemeMode === "oled";

  // Modals
  const [showTOC, setShowTOC] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  
  // Comments logic
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Dictionary/Translate
  const [showDictionary, setShowDictionary] = useState(false);
  const [lookupWord, setLookupWord] = useState("");
  const [definition, setDefinition] = useState<any>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);

  const progressBarWidth = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const contentHeight = useRef(0);

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
    
    if (user?.readerTheme) {
        setReaderThemeMode(user.readerTheme);
    }
  };

  const fetchStory = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/stories/${storyId}`);
      setStory(res.data);
      setChapters(res.data.chapters || []);
      setLikeCount(res.data._count?.likes || 0);
      setIsLiked(res.data.isLiked);
      setTargetProgress(res.data.bookmarkProgress || 0);
      
      const bookmarksRes = await apiClient.get("/users/me/bookmarks");
      const bookmark = bookmarksRes.data.find((b: any) => b.storyId === storyId);
      setIsBookmarked(!!bookmark);

      if (res.data.contentWarnings || res.data.isAdult) {
          setShowWarning(true);
      }

      if (res.data.chapters?.length > 0) {
          await loadChapter(res.data.chapters[0].id);
      }
      
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
          setHasResumed(false); // Reset resume flag for new chapter
          setShowTOC(false);
      } catch (e) { 
          console.log("[Reader] Load chapter error:", e); 
      } finally { 
          setLoading(false); 
      }
  };

  const onContentSizeChange = (w: number, h: number) => {
      contentHeight.current = h;
      if (targetProgress > 0 && !hasResumed) {
          const y = (targetProgress / 100) * (h - WINDOW_HEIGHT);
          if (y > 0) {
            scrollViewRef.current?.scrollTo({ y, animated: true });
            setHasResumed(true);
          }
      }
  };

  const handleBookmark = async () => {
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);
    try {
      const progress = wasBookmarked ? -1 : Math.round(scrollProgress * 100);
      await apiClient.post(`/stories/${storyId}/bookmark`, { progress });
      if (!wasBookmarked) Alert.alert("Saved", "Story added to your library.");
    } catch (error) { setIsBookmarked(wasBookmarked); }
  };

  const updateProgress = async () => {
      if (!isBookmarked) return;
      try {
          await apiClient.post(`/stories/${storyId}/bookmark`, { progress: Math.round(scrollProgress * 100) });
      } catch (e) {}
  };

  useEffect(() => {
      const timer = setTimeout(updateProgress, 2000); // Debounced progress update
      return () => clearTimeout(timer);
  }, [scrollProgress]);

  const updateReaderTheme = async (mode: string) => {
      setReaderThemeMode(mode);
      setShowThemePicker(false);
      try {
          await apiClient.post("/users/me/preferences", { readerTheme: mode });
          refreshUser();
      } catch (e) { console.log("Failed to sync preference"); }
  };

  // Comments, Translation, Lookup methods... (rest unchanged)
  const fetchComments = async () => {
      setCommentsLoading(true);
      try {
          const res = await apiClient.get(`/stories/${storyId}/comments`);
          setComments(res.data);
      } catch (e) { console.log(e); }
      finally { setCommentsLoading(false); }
  };

  const handlePostComment = async () => {
      if (!newComment.trim()) return;
      try {
          await apiClient.post(`/stories/${storyId}/comments`, { content: newComment });
          setNewComment("");
          fetchComments();
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
      if (lang === "Original") { setCurrentChapter({ ...currentChapter, body: originalBody }); setShowTranslate(false); return; }
      setShowTranslate(false);
      try {
          const res = await apiClient.post("/ai/translate", { text: originalBody, targetLanguage: lang });
          setCurrentChapter({ ...currentChapter, body: res.data.result });
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

  if (loading && !currentChapter) {
      return (
          <View style={[styles.container, { backgroundColor: appTheme.white, justifyContent: 'center' }]}>
              <ActivityIndicator size="large" color={appTheme.primary} />
          </View>
      );
  }

  const paragraphs = currentChapter?.body ? currentChapter.body.split('\n\n') : [];
  const currentChapterIdx = chapters.findIndex(c => c.id === currentChapter?.id);

  return (
    <View style={[styles.container, { backgroundColor: readerTheme.bg }]}>
      {/* SOLID STATUS BAR FIX */}
      <View style={{ height: insets.top, backgroundColor: readerTheme.bg }} />
      <StatusBar 
        style={isReaderDark ? "light" : "dark"} 
        backgroundColor={readerTheme.bg}
        translucent={false}
      />
      
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: readerTheme.bg, borderBottomColor: isReaderDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft size={24} color={readerTheme.text} /></TouchableOpacity>
          <View style={styles.topBarIcons}>
            <TouchableOpacity onPress={() => setShowThemePicker(true)} style={styles.iconBtn}>
                <Palette size={20} color={readerTheme.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTOC(true)} style={styles.iconBtn}><List size={20} color={readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTranslate(true)} style={styles.iconBtn}><Globe size={20} color={readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDictionary(true)} style={styles.iconBtn}><Book size={20} color={readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={handleBookmark} style={styles.iconBtn}><Bookmark size={20} color={isBookmarked ? Colors.accent : readerTheme.text} fill={isBookmarked ? Colors.accent : "none"} /></TouchableOpacity>
          </View>
        </View>
        <View style={styles.progressContainer}><Animated.View style={[styles.progressBar, { width: progressBarWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: readerTheme.primary }]} /></View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          const totalHeight = contentSize.height - layoutMeasurement.height;
          setScrollProgress(totalHeight > 0 ? contentOffset.y / totalHeight : 0);
        }} 
        onContentSizeChange={onContentSizeChange}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.header}>
          <Text style={[styles.genre, { color: readerTheme.primary, fontFamily: fonts.body }]}>{story?.genre}</Text>
          <Text style={[styles.title, { color: readerTheme.text, fontFamily: fonts.heading }]}>{story?.title}</Text>
          <View style={styles.chapterHeader}>
              <Text style={[styles.chapterLabel, { color: readerTheme.meta, fontFamily: fonts.heading }]}>
                  {currentChapter?.title ? currentChapter.title.toUpperCase() : "CHAPTER 1"}
              </Text>
          </View>
        </View>
        
        <View style={styles.bodyContainer}>
          {paragraphs.length > 0 ? paragraphs.map((para, idx) => (
            <Text key={idx} style={[styles.bodyText, { color: readerTheme.text, fontFamily: fonts.body, fontSize, lineHeight: fontSize * 1.75, marginBottom: 20 }]}>{para}</Text>
          )) : (
            <Text style={[styles.bodyText, { color: readerTheme.text, opacity: 0.5, fontStyle: 'italic', textAlign: 'center', marginTop: 40 }]}>No content found for this chapter.</Text>
          )}
        </View>
        
        {chapters.length > 1 && (
            <View style={[styles.chapterNav, { borderTopColor: isReaderDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                <TouchableOpacity style={[styles.navBtn, currentChapterIdx <= 0 && { opacity: 0.3 }]} disabled={currentChapterIdx <= 0} onPress={() => loadChapter(chapters[currentChapterIdx - 1].id)}><ChevronLeft size={24} color={readerTheme.text} /><Text style={[styles.navBtnText, { color: readerTheme.text }]}>Previous</Text></TouchableOpacity>
                <Text style={[styles.navProgress, { fontFamily: fonts.heading, color: readerTheme.text }]}>{currentChapterIdx + 1} / {chapters.length}</Text>
                <TouchableOpacity style={[styles.navBtn, currentChapterIdx >= chapters.length - 1 && { opacity: 0.3 }]} disabled={currentChapterIdx >= chapters.length - 1} onPress={() => loadChapter(chapters[currentChapterIdx + 1].id)}><Text style={[styles.navBtnText, { color: readerTheme.text }]}>Next</Text><ChevronRight size={24} color={readerTheme.text} /></TouchableOpacity>
            </View>
        )}
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { backgroundColor: readerTheme.bg, borderTopColor: isReaderDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bottomBarContent}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
            <Heart size={22} color={isLiked ? "red" : readerTheme.text} fill={isLiked ? "red" : "none"} />
            <View style={{ marginLeft: 8 }}>
                <Text style={[styles.actionLabel, { color: readerTheme.text, fontFamily: fonts.heading }]}>LIKE</Text>
                <Text style={[styles.actionCount, { color: readerTheme.text, fontFamily: fonts.body }]}>{likeCount}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => { setShowComments(true); fetchComments(); }} style={styles.actionBtn}>
            <MessageSquare size={22} color={readerTheme.text} />
            <View style={{ marginLeft: 8 }}>
                <Text style={[styles.actionLabel, { color: readerTheme.text, fontFamily: fonts.heading }]}>COMMENTS</Text>
                <Text style={[styles.actionCount, { color: readerTheme.text, fontFamily: fonts.body }]}>{story?._count?.comments || 0}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals... */}
      <Modal visible={showThemePicker} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }]}>
              <View style={[styles.modalContent, { backgroundColor: appTheme.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: insets.bottom + 40 }]}>
                  <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: appTheme.black, fontFamily: fonts.heading }]}>READING MOOD</Text><TouchableOpacity onPress={() => setShowThemePicker(false)}><X size={24} color={appTheme.black} /></TouchableOpacity></View>
                  <View style={styles.themeGrid}>
                      {Object.keys(READER_THEMES).map((mode) => (
                          <TouchableOpacity key={mode} style={[styles.themeOption, { backgroundColor: (READER_THEMES as any)[mode].bg, borderColor: readerThemeMode === mode ? Colors.accent : 'rgba(0,0,0,0.1)' }]} onPress={() => updateReaderTheme(mode)}>
                              <Text style={[styles.themeOptionText, { color: (READER_THEMES as any)[mode].text }]}>{mode.toUpperCase()}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>
              </View>
          </View>
      </Modal>

      <Modal visible={showWarning} animationType="fade" transparent>
          <View style={styles.centeredOverlay}>
              <View style={[styles.warningContent, { backgroundColor: appTheme.white }]}>
                  <AlertTriangle size={48} color={Colors.error} />
                  <Text style={[styles.modalTitle, { color: appTheme.black, fontFamily: fonts.heading, marginTop: 20 }]}>ADVISORY</Text>
                  <Text style={[styles.modalDesc, { fontFamily: fonts.body, textAlign: 'center' }]}>{story?.contentWarnings || "General adult themes."}</Text>
                  <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setShowWarning(false)}>
                      <Text style={styles.actionBtnTextPrimary}>I UNDERSTAND</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      <Modal visible={showTOC} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: appTheme.white, paddingTop: insets.top + 20 }]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: appTheme.black, fontFamily: fonts.heading }]}>CHAPTERS</Text><TouchableOpacity onPress={() => setShowTOC(false)}><X size={24} color={appTheme.black} /></TouchableOpacity></View>
              <ScrollView style={{ padding: 24 }}>{chapters.map((c, i) => (<TouchableOpacity key={c.id} style={[styles.tocItem, currentChapter?.id === c.id && { backgroundColor: appTheme.primary + '10' }]} onPress={() => loadChapter(c.id)}><Text style={[styles.tocOrder, { color: appTheme.primary }]}>{i + 1}</Text><Text style={[styles.tocTitle, { color: appTheme.black }]}>{c.title}</Text></TouchableOpacity>))}</ScrollView>
          </View>
      </Modal>

      <Modal visible={showComments} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: appTheme.white, paddingTop: insets.top + 20 }]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: appTheme.black, fontFamily: fonts.heading }]}>COMMENTS</Text><TouchableOpacity onPress={() => setShowComments(false)}><X size={24} color={appTheme.black} /></TouchableOpacity></View>
              <ScrollView style={{ padding: 24 }} refreshControl={<RefreshControl refreshing={commentsLoading} onRefresh={fetchComments} />}>
                  {comments.map(c => (
                      <View key={c.id} style={styles.commentItem}>
                          <Text style={[styles.commentUser, { fontFamily: fonts.heading, color: appTheme.primary }]}>{c.user?.username}</Text>
                          <Text style={[styles.commentText, { fontFamily: fonts.body, color: appTheme.black }]}>{c.content}</Text>
                      </View>
                  ))}
                  {comments.length === 0 && !commentsLoading && <Text style={{ textAlign: 'center', marginTop: 40, opacity: 0.5 }}>No comments yet.</Text>}
              </ScrollView>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
                  <View style={[styles.commentInputRow, { borderTopColor: 'rgba(0,0,0,0.05)', paddingBottom: insets.bottom + 20 }]}>
                      <TextInput style={[styles.commentInput, { fontFamily: fonts.body, color: appTheme.black, backgroundColor: appIsDarkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }]} placeholder="Add a comment..." value={newComment} onChangeText={setNewComment} />
                      <TouchableOpacity onPress={handlePostComment} style={[styles.sendBtn, { backgroundColor: appTheme.primary }]}><Send size={18} color={appTheme.white} /></TouchableOpacity>
                  </View>
              </KeyboardAvoidingView>
          </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { borderBottomWidth: 1, paddingVertical: 12 },
  topBarContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  topBarIcons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { marginLeft: 16 },
  progressContainer: { height: 2, width: "100%", marginTop: 12 },
  progressBar: { height: "100%" },
  content: { flex: 1 },
  header: { paddingHorizontal: 24, marginTop: 40, marginBottom: 40 },
  genre: { fontSize: 13, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.1, fontWeight: "700" },
  title: { fontSize: 36, lineHeight: 42, marginBottom: 12 },
  chapterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chapterLabel: { fontSize: 14, letterSpacing: 2 },
  bodyContainer: { paddingHorizontal: 24, marginBottom: 40 },
  bodyText: { fontSize: 18 },
  chapterNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, borderTopWidth: 1, marginBottom: 60 },
  navBtn: { flexDirection: 'row', alignItems: 'center' },
  navBtnText: { fontSize: 14, marginHorizontal: 8 },
  navProgress: { fontSize: 16 },
  bottomBar: { borderTopWidth: 1, paddingTop: 16 },
  bottomBarContent: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingHorizontal: 20 },
  actionBtn: { flexDirection: "row", alignItems: "center", padding: 8 },
  actionLabel: { fontSize: 10, letterSpacing: 1, opacity: 0.7 },
  actionCount: { fontSize: 12, marginTop: -2 },
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
  commentItem: { marginBottom: 24 },
  commentUser: { fontSize: 12, marginBottom: 4 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1 },
  commentInput: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, marginLeft: 12, justifyContent: 'center', alignItems: 'center' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 24, justifyContent: 'space-between' },
  themeOption: { width: '48%', height: 60, borderRadius: 16, marginBottom: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  themeOptionText: { fontFamily: Fonts.heading, fontSize: 12, letterSpacing: 1 }
});
