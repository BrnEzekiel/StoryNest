import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { useNotice } from "../context/NoticeContext";
import { ActivityLog } from "../utils/activityLog";
import { Colors, Shadows, Spacing, Radii } from "../theme/colors";
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
  Palette,
  Reply
} from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import axios from "axios";
import { SkeletonReader } from "../components/SkeletonReader";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { Cache } from "../utils/Cache";
import { checkLimit, tapThrottle, LIMITS, TAP_GAP_MS } from "../utils/rateLimit";
import { getFriendlyErrorMessage } from "../utils/ErrorHandler";

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
  const { storyId, story: seedStory } = route.params;
  const { user, refreshUser } = useAuth();
  const { theme: appTheme, fonts, isDarkMode: appIsDarkMode, setThemeMode } = useTheme();
  const { showNotice } = useNotice();

  const [story, setStory] = useState<any>(seedStory || null);
  const [chapters, setChapters] = useState<any[]>(seedStory?.chapters || []);
  const [currentChapter, setCurrentChapter] = useState<any>(null);
  const [originalBody, setOriginalBody] = useState("");
  const [fontSizeMode, setFontSizeMode] = useState<"small" | "medium" | "large">("medium");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(!seedStory);
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

  // Comments logic (cached per story; paints instantly, syncs silently)
  const commentsQuery = useCachedQuery<any[]>(`comments:${storyId}`, async () => {
    const res = await apiClient.get(`/stories/${storyId}/comments`);
    return res.data;
  });
  const comments = commentsQuery.data || [];
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);

  // Dictionary/Translate
  const [showDictionary, setShowDictionary] = useState(false);
  const [lookupWord, setLookupWord] = useState("");
  const [definition, setDefinition] = useState<any>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);

  const progressBarWidth = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const contentHeight = useRef(0);
  const commentInputRef = useRef<TextInput>(null);
  const postingRef = useRef(false);
  const loggedReadRef = useRef(false);

  const fontSize = FONT_SIZES[fontSizeMode];

  // Android back button closes the topmost sheet instead of leaving the reader.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showComments) { setShowComments(false); return true; }
      if (showTOC) { setShowTOC(false); return true; }
      if (showTranslate) { setShowTranslate(false); return true; }
      if (showDictionary) { setShowDictionary(false); return true; }
      if (showThemePicker) { setShowThemePicker(false); return true; }
      if (showWarning) { setShowWarning(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [showComments, showTOC, showTranslate, showDictionary, showThemePicker, showWarning]);

  useEffect(() => {
    loadSavedSettings();
    if (seedStory) {
      // Seed the cache so revisits paint instantly even before navigation params.
      Cache.getStale(`story:${storyId}`).then((cached) => {
        if (!cached) Cache.set(`story:${storyId}`, seedStory).catch(() => {});
      }).catch(() => {});
    }
    hydrateStoryCache();
    fetchStory();
  }, [storyId]);

  useEffect(() => {
    Animated.timing(progressBarWidth, { toValue: scrollProgress, duration: 300, useNativeDriver: false }).start();
  }, [scrollProgress]);

  const loadSavedSettings = async () => {
    // Reader theme backup: this story's theme wins, then the global reader
    // theme, then the server preference. Never silently reset to a default.
    const [savedFont, storyTheme, globalTheme] = await Promise.all([
      AsyncStorage.getItem("readerFontSize"),
      AsyncStorage.getItem(`readerTheme:${storyId}`),
      AsyncStorage.getItem("readerTheme"),
    ]);
    if (savedFont) setFontSizeMode(savedFont as any);
    setReaderThemeMode(storyTheme || globalTheme || user?.readerTheme || "light");
  };

  /** Instant paint of the last-known story + chapter while fresh data loads. */
  const hydrateStoryCache = async () => {
    try {
      const cached = await Cache.getStale<any>(`story:${storyId}`);
      if (!cached) return;
      setStory(cached);
      setChapters(cached.chapters || []);
      setLikeCount(cached._count?.likes || 0);
      setIsLiked(cached.isLiked);
      setTargetProgress(cached.bookmarkProgress || 0);
      if (cached.chapters?.length > 0) {
        const first = cached.chapters[0];
        if (first.body) {
          setCurrentChapter(first);
          setOriginalBody(first.body);
        } else {
          const cachedChapter = await Cache.getStale<any>(`chapter:${first.id}`);
          if (cachedChapter?.body) {
            setCurrentChapter(cachedChapter);
            setOriginalBody(cachedChapter.body);
          }
        }
      }
      setLoading(false);
    } catch {}
  };

  const fetchStory = async () => {
    const url = `/stories/${storyId}`;
    try {
      if (!story) setLoading(true);
      // Story + bookmarks load in parallel: one wait instead of two.
      const [res, bookmarksRes] = await Promise.all([
        apiClient.get(url),
        apiClient.get("/users/me/bookmarks").catch(() => ({ data: [] })),
      ]);
      setStory(res.data);
      setChapters(res.data.chapters || []);
      setLikeCount(res.data._count?.likes || 0);
      setIsLiked(res.data.isLiked);
      setTargetProgress(res.data.bookmarkProgress || 0);
      Cache.set(`story:${storyId}`, res.data).catch(() => {});

      const bookmark = (bookmarksRes.data || []).find((b: any) => b.storyId === storyId);
      setIsBookmarked(!!bookmark);

      if (!loggedReadRef.current) {
        loggedReadRef.current = true;
        ActivityLog.log({ kind: "READ", title: res.data.title, storyId, coverUrl: res.data.coverUrl });
      }

      if (res.data.contentWarnings || res.data.isAdult) {
          setShowWarning(true);
      }

      // Use pre-fetched chapter bodies if available
      if (res.data.chapters?.length > 0) {
          const firstChapter = res.data.chapters[0];
          if (firstChapter.body) {
              setCurrentChapter(firstChapter);
              setOriginalBody(firstChapter.body);
          } else if (!currentChapter) {
              await loadChapter(firstChapter.id);
          }
      }

      apiClient.post(`/stories/${storyId}/read`).catch(() => {});
    } catch (error: any) {
        console.log("[Reader] Fetch error:", error.response?.status, error.message);
        if (!story) {
          showNotice({
            title: "Connection Error",
            message: "We couldn't load this story. Please try again.",
            variant: "error",
            actions: [
              { label: "Retry", kind: "primary", onPress: fetchStory },
              { label: "Go Back", kind: "ghost", onPress: () => navigation.goBack() },
            ],
          });
        }
    } finally {
        setLoading(false);
    }
  };

  const loadChapter = async (chapterId: string) => {
      const url = `/chapters/${chapterId}`;
      // Paint the cached chapter instantly when available; sync fresh below.
      try {
        const cachedChapter = await Cache.getStale<any>(`chapter:${chapterId}`);
        if (cachedChapter?.body) {
          setCurrentChapter(cachedChapter);
          setOriginalBody(cachedChapter.body);
          setHasResumed(false);
          scrollViewRef.current?.scrollTo({ y: 0, animated: false });
          setScrollProgress(0);
          setShowTOC(false);
        } else {
          setLoading(true);
        }
      } catch {
        setLoading(true);
      }
      try {
          const res = await apiClient.get(url);
          if (res.data) {
            setCurrentChapter(res.data);
            setOriginalBody(res.data.body);
            setHasResumed(false);
            Cache.set(`chapter:${chapterId}`, res.data).catch(() => {});
          }
          scrollViewRef.current?.scrollTo({ y: 0, animated: false });
          setScrollProgress(0);
          setShowTOC(false);
      } catch (e: any) {
          console.log("[Reader] Load chapter error:", e.response?.status, e.message);
          if (!currentChapter?.body) showNotice({ title: "Chapter error", message: "Failed to load content.", variant: "error" });
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
    if (!tapThrottle(`bookmark:${storyId}`, TAP_GAP_MS)) return;
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);
    try {
      const progress = wasBookmarked ? -1 : Math.round(scrollProgress * 100);
      await apiClient.post(`/stories/${storyId}/bookmark`, { progress });
      if (!wasBookmarked) {
        showNotice({ title: "Saved", message: "Story added to your library.", variant: "success" });
        ActivityLog.log({ kind: "BOOKMARK", title: story?.title || "story", storyId, coverUrl: story?.coverUrl });
      }
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
      // Back up locally first (per-story + global) so the choice survives
      // restarts and offline reads even if the server sync fails.
      AsyncStorage.setItem(`readerTheme:${storyId}`, mode).catch(() => {});
      AsyncStorage.setItem("readerTheme", mode).catch(() => {});
      try {
          await apiClient.post("/users/me/preferences", { readerTheme: mode });
          refreshUser();
      } catch (e) { console.log("Failed to sync preference"); }
  };

  const handlePostComment = async () => {
      const content = newComment.trim();
      if (!content || postingRef.current) return;

      const verdict = checkLimit(`comments:post:${storyId}`, LIMITS.comment.max, LIMITS.comment.windowMs);
      if (!verdict.allowed) {
          showNotice({ title: "Slow down", message: "You're commenting very fast. Please wait a moment and try again.", variant: "info" });
          return;
      }

      // Double-tap guard: one in-flight post at a time (no duplicates).
      postingRef.current = true;
      setPosting(true);
      const parentId = replyTo?.id || null;
      setNewComment("");
      setReplyTo(null);

      // Optimistic comment: appears instantly, reconciled with the server copy.
      const tempId = `pending-${Date.now()}`;
      const optimistic = {
          id: tempId,
          content,
          parentId,
          createdAt: new Date().toISOString(),
          user: { id: user?.id, username: user?.username, avatarUrl: user?.avatarUrl },
          _pending: true,
      };
      const withOptimistic = [...comments, optimistic];
      commentsQuery.setData(withOptimistic);

      try {
          const res = await apiClient.post(`/stories/${storyId}/comments`, {
              content,
              parentId,
          });
          const reconciled = withOptimistic.map(c => (c.id === tempId ? res.data : c));
          commentsQuery.setData(reconciled);
          Cache.set(`comments:${storyId}`, reconciled).catch(() => {});
          ActivityLog.log({
            kind: "COMMENT",
            title: story?.title || "story",
            sub: content.length > 90 ? content.slice(0, 90) + "..." : content,
            storyId,
            coverUrl: story?.coverUrl,
          });
      } catch (e: any) {
          const rolledBack = withOptimistic.filter(c => c.id !== tempId);
          commentsQuery.setData(rolledBack);
          setNewComment(content);
          showNotice({ title: "Notice", message: getFriendlyErrorMessage(e, "Could not post comment. Please try again."), variant: "error" });
      } finally {
          postingRef.current = false;
          setPosting(false);
      }
  };

  const handleReplyPress = (c: any) => {
      setReplyTo(c);
      setNewComment(`@${c.user.username} `);
      // Pull the keyboard up immediately; the user should not have to tap again.
      setTimeout(() => commentInputRef.current?.focus(), 50);
  };

  const handleUserDM = (targetUser: any) => {
      if (!targetUser || targetUser.id === user?.id) return;
      setShowComments(false);
      navigation.navigate("Messages", { targetUser });
  };

  const renderComment = (c: any, depth = 0) => {
      const replies = comments.filter(r => r.parentId === c.id);
      return (
          <View key={c.id} style={[styles.commentWrapper, { marginLeft: depth > 0 ? 16 : 0, borderLeftWidth: depth > 0 ? 1 : 0, borderLeftColor: 'rgba(0,0,0,0.05)', opacity: c._pending ? 0.6 : 1 }]}>
              <View style={styles.commentMain}>
                  <TouchableOpacity onPress={() => handleUserDM(c.user)} style={styles.commentAvatar}>
                      {c.user?.avatarUrl ? <Image source={{ uri: c.user.avatarUrl }} style={styles.avatarImg} /> : <View style={[styles.avatarInitials, { backgroundColor: appTheme.primary + '15' }]}><Text style={[styles.avatarTextSmall, { color: appTheme.primary }]}>{c.user?.username ? c.user.username[0].toUpperCase() : '?'}</Text></View>}
                  </TouchableOpacity>
                  <View style={styles.commentBody}>
                      <View style={styles.commentHeader}>
                          <TouchableOpacity onPress={() => handleUserDM(c.user)}><Text style={[styles.commentUser, { fontFamily: fonts.heading, color: appTheme.primary }]}>{c.user?.username}</Text></TouchableOpacity>
                          <Text style={[styles.commentTime, { color: Colors.mutedTeal }]}>{c._pending ? "Sending..." : new Date(c.createdAt).toLocaleDateString()}</Text>
                      </View>
                      <Text style={[styles.commentText, { fontFamily: fonts.body, color: appTheme.black }]}>{c.content}</Text>
                      {!c._pending && (
                          <TouchableOpacity style={styles.replyBtn} onPress={() => handleReplyPress(c)}>
                              <Reply size={14} color={appTheme.primary} />
                              <Text style={[styles.replyBtnText, { color: appTheme.primary, fontFamily: fonts.heading }]}>REPLY</Text>
                          </TouchableOpacity>
                      )}
                  </View>
              </View>
              {replies.map(r => renderComment(r, depth + 1))}
          </View>
      );
  };

  const handleLookup = async () => {
      if (!lookupWord.trim()) return;
      setDictLoading(true);
      try {
          const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${lookupWord.trim()}`);
          setDefinition(res.data[0]);
      } catch (e) { showNotice({ title: "Not found", message: "Definition not found.", variant: "info" }); }
      finally { setDictLoading(false); }
  };

  const [translating, setTranslating] = useState(false);
  const handleTranslate = async (lang: string) => {
      if (lang === "Original") { setCurrentChapter({ ...currentChapter, body: originalBody }); setShowTranslate(false); return; }
      if (!originalBody.trim()) { setShowTranslate(false); showNotice({ title: "Nothing to translate", message: "This chapter has no text yet.", variant: "info" }); return; }
      setShowTranslate(false);
      setTranslating(true);
      try {
          const res = await apiClient.post("/ai/translate", { text: originalBody, targetLanguage: lang }, { timeout: 180000 });
          setCurrentChapter({ ...currentChapter, body: res.data.result });
      } catch (e) {
          showNotice({
              title: "Translation failed",
              message: "The translation service is busy. Retry — finished parts are cached, so the second try is faster.",
              variant: "error",
              actions: [
                  { label: "Cancel", kind: "ghost" },
                  { label: "Retry", kind: "primary", onPress: () => handleTranslate(lang) },
              ],
          });
      }
      finally { setTranslating(false); }
  };

  const handleLike = async () => {
    if (!tapThrottle(`like:${storyId}`, TAP_GAP_MS)) return;
    const verdict = checkLimit(`like:${storyId}`, LIMITS.like.max, LIMITS.like.windowMs);
    if (!verdict.allowed) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      const res = await apiClient.post(`/stories/${storyId}/like`);
      setIsLiked(res.data.isLiked);
      setLikeCount(res.data.likes);
      if (res.data.isLiked) {
        ActivityLog.log({ kind: "LIKE", title: story?.title || "story", storyId, coverUrl: story?.coverUrl });
      }
    } catch (error) { setIsLiked(wasLiked); }
  };

  const handleUnlock = async () => {
      if (!user) {
          showNotice({ title: "Login Required", message: "Please log in to unlock premium content.", variant: "info" });
          return;
      }

      const price = story?.price || 50;
      if ((user?.coins || 0) < price) {
          showNotice({
              title: "Insufficient Coins",
              message: `You need ${price} coins to unlock this story. You currently have ${user?.coins || 0} coins.`,
              variant: "info",
              actions: [
                  { label: "Go to Shop", kind: "primary", onPress: () => navigation.navigate("Shop") },
                  { label: "Cancel", kind: "ghost" },
              ],
          });
          return;
      }

      showNotice({
          title: "Unlock Story",
          message: `Use ${price} coins to unlock "${story.title}" forever?`,
          variant: "info",
          actions: [
              { label: "Cancel", kind: "ghost" },
              {
                  label: "Unlock",
                  kind: "primary",
                  onPress: async () => {
                      try {
                          setLoading(true);
                          const res = await apiClient.post(`/stories/${storyId}/unlock`);
                          if (res.data.success) {
                              showNotice({ title: "Success", message: "Story unlocked! Enjoy your read.", variant: "success" });
                              ActivityLog.log({ kind: "UNLOCK", title: story?.title || "story", storyId, coverUrl: story?.coverUrl });
                              await refreshUser();
                              fetchStory();
                          }
                      } catch (e: any) {
                          showNotice({ title: "Error", message: e.response?.data?.error || "Failed to unlock story.", variant: "error" });
                      } finally {
                          setLoading(false);
                      }
                  }
              }
          ]
      });
  };

  if (loading && !story) {
      return (
          <View style={[styles.container, { backgroundColor: appTheme.white }]}>
              <SkeletonReader />
          </View>
      );
  }

  const paragraphs = (currentChapter?.body || story?.body || "").replace(/\r\n/g, '\n').split('\n\n').filter((p: string) => p.trim().length > 0);
  const currentChapterIdx = chapters.findIndex(c => c.id === currentChapter?.id);

  return (
    <View style={[styles.container, { backgroundColor: readerTheme.bg }]}>
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
              <TouchableOpacity onPress={() => handleUserDM({ id: story?.ownerId, username: story?.authorName })}>
                  <Text style={[styles.authorName, { color: readerTheme.meta, fontFamily: fonts.body }]}>by {story?.authorName} (Message)</Text>
              </TouchableOpacity>
              <Text style={[styles.chapterLabel, { color: readerTheme.meta, fontFamily: fonts.heading }]}>
                  {currentChapter?.title ? currentChapter.title.toUpperCase() : "CHAPTER 1"}
              </Text>
          </View>
        </View>

        <View style={styles.bodyContainer}>
          {translating && (
            <Text style={[styles.bodyText, { color: readerTheme.meta, opacity: 0.8, fontStyle: 'italic', textAlign: 'center', marginBottom: 20 }]}>
              Translating chapter...
            </Text>
          )}
          {story?.canRead === false ? (
              <View style={styles.lockedContainer}>
                  <View style={styles.lockIconHUD}>
                      <Lock size={48} color={Colors.accent} />
                  </View>
                  <Text style={[styles.lockedTitle, { fontFamily: fonts.heading, color: readerTheme.text }]}>PREMIUM STORY</Text>
                  <Text style={[styles.lockedDesc, { fontFamily: fonts.body, color: readerTheme.meta }]}>
                      This masterpiece is exclusive to StoryNest Premium members.
                  </Text>
                  <TouchableOpacity
                    style={[styles.upgradeBtn, { backgroundColor: Colors.accent }]}
                    onPress={handleUnlock}
                  >
                      <Text style={[styles.upgradeBtnText, { color: Colors.primary, fontFamily: fonts.heading }]}>UNLOCK NOW</Text>
                  </TouchableOpacity>
              </View>
          ) : paragraphs.length > 0 ? paragraphs.map((para: string, idx: number) => (
            <Text key={idx} style={[styles.bodyText, { color: readerTheme.text, fontFamily: fonts.body, fontSize, lineHeight: fontSize * 1.75, marginBottom: 20 }]}>{para}</Text>
          )) : (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
                <Text style={[styles.bodyText, { color: readerTheme.text, opacity: 0.5, fontStyle: 'italic', textAlign: 'center', marginTop: 20 }]}>Restoring story content...</Text>
            </View>
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

          <TouchableOpacity onPress={() => { setShowComments(true); commentsQuery.refresh(); }} style={styles.actionBtn}>
            <MessageSquare size={22} color={readerTheme.text} />
            <View style={{ marginLeft: 8 }}>
                <Text style={[styles.actionLabel, { color: readerTheme.text, fontFamily: fonts.heading }]}>COMMENTS</Text>
                <Text style={[styles.actionCount, { color: readerTheme.text, fontFamily: fonts.body }]}>{story?._count?.comments || 0}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals: Warning, TOC, Comments, Theme Picker */}
      <Modal visible={showThemePicker} animationType="slide" transparent onRequestClose={() => setShowThemePicker(false)}>
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

      <Modal visible={showWarning} animationType="fade" transparent onRequestClose={() => setShowWarning(false)}>
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

      <Modal visible={showTOC} animationType="slide" transparent onRequestClose={() => setShowTOC(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: appTheme.white, paddingTop: insets.top + 20 }]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: appTheme.black, fontFamily: fonts.heading }]}>CHAPTERS</Text><TouchableOpacity onPress={() => setShowTOC(false)}><X size={24} color={appTheme.black} /></TouchableOpacity></View>
              <ScrollView style={{ padding: 24 }}>{chapters.map((c, i) => (<TouchableOpacity key={c.id} style={[styles.tocItem, currentChapter?.id === c.id && { backgroundColor: appTheme.primary + '10' }]} onPress={() => loadChapter(c.id)}><Text style={[styles.tocOrder, { color: appTheme.primary }]}>{i + 1}</Text><Text style={[styles.tocTitle, { color: appTheme.black }]}>{c.title}</Text></TouchableOpacity>))}</ScrollView>
          </View>
      </Modal>

      <Modal visible={showComments} animationType="slide" transparent onRequestClose={() => setShowComments(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: appTheme.white, paddingTop: insets.top + 20 }]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: appTheme.black, fontFamily: fonts.heading }]}>COMMENTS</Text><TouchableOpacity onPress={() => setShowComments(false)}><X size={24} color={appTheme.black} /></TouchableOpacity></View>
              <ScrollView style={{ padding: 24 }}>
                  {comments.filter(c => !c.parentId).map(c => renderComment(c))}
                  {comments.length === 0 && (
                      <Text style={{ textAlign: 'center', marginTop: 40, opacity: 0.5 }}>
                          {commentsQuery.isFirstLoad ? "Loading comments..." : "No comments yet."}
                      </Text>
                  )}
              </ScrollView>

              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
                  {replyTo && (
                      <View style={[styles.replyIndicator, { backgroundColor: appTheme.primary + '10' }]}>
                          <Text style={[styles.replyToText, { color: appTheme.primary }]}>Replying to {replyTo.user.username}</Text>
                          <TouchableOpacity onPress={() => { setReplyTo(null); setNewComment(""); }}><X size={14} color={appTheme.primary} /></TouchableOpacity>
                      </View>
                  )}
                  <View style={[styles.commentInputRow, { borderTopColor: 'rgba(0,0,0,0.05)', paddingBottom: insets.bottom + 20 }]}>
                      <TextInput
                        ref={commentInputRef}
                        style={[styles.commentInput, { fontFamily: fonts.body, color: appTheme.black, backgroundColor: appIsDarkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }]}
                        placeholder="Add a comment..."
                        value={newComment}
                        onChangeText={setNewComment}
                        onSubmitEditing={handlePostComment}
                        returnKeyType="send"
                        blurOnSubmit={false}
                      />
                      <TouchableOpacity
                        onPress={handlePostComment}
                        disabled={posting || !newComment.trim()}
                        style={[styles.sendBtn, { backgroundColor: appTheme.primary, opacity: posting || !newComment.trim() ? 0.5 : 1 }]}
                      >
                          <Send size={18} color={appTheme.white} />
                      </TouchableOpacity>
                  </View>
              </KeyboardAvoidingView>
          </View>
      </Modal>

      <Modal visible={showTranslate} animationType="slide" transparent onRequestClose={() => setShowTranslate(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }]}>
              <View style={[styles.modalContent, { backgroundColor: appTheme.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: insets.bottom + 40, maxHeight: '70%' }]}>
                  <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: appTheme.black, fontFamily: fonts.heading }]}>TRANSLATE CHAPTER</Text><TouchableOpacity onPress={() => setShowTranslate(false)}><X size={24} color={appTheme.black} /></TouchableOpacity></View>
                  <ScrollView style={{ paddingHorizontal: 24 }}>
                      {["Original", "English", "Swahili", "French", "Spanish", "German", "Portuguese", "Arabic", "Hindi"].map((lang) => (
                          <TouchableOpacity key={lang} style={styles.tocItem} onPress={() => handleTranslate(lang)}>
                              <Globe size={18} color={appTheme.primary} />
                              <Text style={[styles.tocTitle, { color: appTheme.black, fontFamily: fonts.body, marginLeft: 12 }]}>{lang}</Text>
                          </TouchableOpacity>
                      ))}
                  </ScrollView>
              </View>
          </View>
      </Modal>

      <Modal visible={showDictionary} animationType="slide" transparent onRequestClose={() => setShowDictionary(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }]}>
              <View style={[styles.modalContent, { backgroundColor: appTheme.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: insets.bottom + 40, maxHeight: '75%' }]}>
                  <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: appTheme.black, fontFamily: fonts.heading }]}>DICTIONARY</Text><TouchableOpacity onPress={() => setShowDictionary(false)}><X size={24} color={appTheme.black} /></TouchableOpacity></View>
                  <View style={{ paddingHorizontal: 24 }}>
                      <View style={[styles.commentInputRow, { borderTopWidth: 0, paddingBottom: 0 }]}>
                          <TextInput
                            style={[styles.commentInput, { fontFamily: fonts.body, color: appTheme.black, backgroundColor: appIsDarkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f5', flex: 1 }]}
                            placeholder="Look up a word..."
                            placeholderTextColor={Colors.mutedTeal}
                            value={lookupWord}
                            onChangeText={setLookupWord}
                            onSubmitEditing={handleLookup}
                            returnKeyType="search"
                          />
                          <TouchableOpacity onPress={handleLookup} disabled={dictLoading} style={[styles.sendBtn, { backgroundColor: appTheme.primary, opacity: dictLoading ? 0.5 : 1 }]}>
                              <Book size={18} color={appTheme.white} />
                          </TouchableOpacity>
                      </View>
                      {dictLoading && <Text style={{ textAlign: 'center', marginTop: 16, opacity: 0.5 }}>Looking up...</Text>}
                      {definition && (
                          <ScrollView style={{ marginTop: 16 }}>
                              <Text style={[styles.modalTitle, { color: appTheme.primary, fontFamily: fonts.heading }]}>
                                  {definition.word}{definition.phonetic ? `  ${definition.phonetic}` : ""}
                              </Text>
                              {(definition.meanings || []).slice(0, 3).map((m: any, i: number) => (
                                  <View key={i} style={{ marginTop: 10 }}>
                                      <Text style={[styles.tocOrder, { color: appTheme.primary, fontFamily: fonts.heading }]}>{m.partOfSpeech}</Text>
                                      {(m.definitions || []).slice(0, 2).map((d: any, j: number) => (
                                          <Text key={j} style={[styles.commentText, { fontFamily: fonts.body, color: appTheme.black, marginTop: 4 }]}>• {d.definition}</Text>
                                      ))}
                                  </View>
                              ))}
                          </ScrollView>
                      )}
                  </View>
              </View>
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
  authorName: { fontSize: 12, marginBottom: 8, opacity: 0.8 },
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
  modalContent: { padding: 20 },
  modalDesc: { color: Colors.mutedTeal, marginBottom: 24, paddingHorizontal: 40 },
  centeredOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)' },
  warningContent: { width: WINDOW_WIDTH - 64, borderRadius: 32, padding: 32, alignItems: 'center' },
  actionBtnPrimary: { backgroundColor: Colors.primary, width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 24 },
  actionBtnTextPrimary: { color: Colors.accent, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  tocItem: { flexDirection: 'row', alignItems: 'center', padding: 20, justifyContent: 'space-between' },
  tocOrder: { fontSize: 20, width: 40, opacity: 0.3 },
  tocTitle: { fontSize: 16 },

  // Comments
  commentWrapper: { marginBottom: 12, paddingVertical: 8 },
  commentMain: { flexDirection: 'row', paddingRight: 24 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitials: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarTextSmall: { fontSize: 12, fontWeight: '700' },
  commentBody: { flex: 1, marginLeft: 12 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentUser: { fontSize: 13 },
  commentTime: { fontSize: 10, opacity: 0.5 },
  commentText: { fontSize: 14, lineHeight: 20 },
  replyBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  replyBtnText: { fontSize: 10, marginLeft: 4, letterSpacing: 1 },
  replyIndicator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  replyToText: { fontSize: 12, fontStyle: 'italic' },

  commentInputRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1 },
  commentInput: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, marginLeft: 12, justifyContent: 'center', alignItems: 'center' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 24, justifyContent: 'space-between' },
  themeOption: { width: '48%', height: 60, borderRadius: 16, marginBottom: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  themeOptionText: { fontFamily: Fonts.heading, fontSize: 12, letterSpacing: 1 },
  lockedContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 60 },
  lockIconHUD: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,237,168,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,237,168,0.3)', marginBottom: 24 },
  lockedTitle: { fontSize: 24, letterSpacing: 3, marginBottom: 12 },
  lockedDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22, opacity: 0.7, marginBottom: 32 },
  upgradeBtn: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  upgradeBtnText: { fontSize: 12, letterSpacing: 2, fontWeight: '700' }
});
