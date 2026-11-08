import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Reply,
  Search,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Headphones,
  Timer,
  Download,
  Share2,
  Flag,
  Highlighter,
  Quote,
  Focus,
  Music,
  StickyNote
} from "lucide-react-native";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import ViewShot from "react-native-view-shot";
import { setupAudioPlayer, playEpisodeQueue, togglePlayback } from "../audio/player";
import TrackPlayer, { State as PlayerState } from "react-native-track-player";
import * as FileSystem from "expo-file-system";
import NetInfo from "@react-native-community/netinfo";
import { PixelRatio, Share } from "react-native";
import { OfflineManager } from "../utils/OfflineManager";
import { Outbox } from "../utils/Outbox";
import { ReportSheet } from "../components/ReportSheet";
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
  oled: { bg: "#000000", text: "#FFFFFF", meta: "#7db8b2", primary: "#FFEDA8" },
  contrast: { bg: "#000000", text: "#FFE600", meta: "#FFE600", primary: "#FFE600" }
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
  const isReaderDark = readerThemeMode === "dark" || readerThemeMode === "oled" || readerThemeMode === "contrast";

  // Modals
  const [showTOC, setShowTOC] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "story" | "comment" | "user"; id: string; title?: string } | null>(null);
  const [mutedThreads, setMutedThreads] = useState<string[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  // Text-to-speech + readability
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsSleep, setTtsSleep] = useState(0); // minutes, 0 = off
  const ttsIndex = useRef(0);
  const ttsSleepTimer = useRef<any>(null);
  const ttsActive = useRef(false);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [matchSystem, setMatchSystem] = useState(true);

  // In-book search
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);

  // Paragraph discussion + reactions + similar stories
  const [discussMode, setDiscussMode] = useState(false);
  const [paraFilter, setParaFilter] = useState<number | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const paraLayouts = useRef<{ [idx: number]: number }>({});
  const bodyTop = useRef(0);

  // Annotations, focus mode, presets, transitions, narration, quote cards
  const [annotateMode, setAnnotateMode] = useState(false);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [highlights, setHighlights] = useState<Record<number, { color: string; note: string; text: string }>>({});
  const [noteTarget, setNoteTarget] = useState<{ idx: number; text: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [presets, setPresets] = useState<{ name: string; theme: string; fontSizeMode: string; letterSpacing: number; matchSystem: boolean }[]>([]);
  const [presetName, setPresetName] = useState("");
  const [transitionMode, setTransitionMode] = useState<"fade" | "slide">("fade");
  const chapterFade = useRef(new Animated.Value(1)).current;
  const chapterSlide = useRef(new Animated.Value(0)).current;
  const [narrating, setNarrating] = useState(false);
  const [quoteTarget, setQuoteTarget] = useState<{ idx: number; text: string } | null>(null);
  const quoteShot = useRef<any>(null);

  useEffect(() => {
    AsyncStorage.getItem(`annot:${storyId}`).then((raw) => { try { if (raw) setHighlights(JSON.parse(raw)); } catch {} }).catch(() => {});
    AsyncStorage.getItem("reader:presets").then((raw) => { try { if (raw) setPresets(JSON.parse(raw)); } catch {} }).catch(() => {});
    AsyncStorage.getItem("reader:transition").then((v) => { if (v === "slide" || v === "fade") setTransitionMode(v); }).catch(() => {});
  }, [storyId]);

  useEffect(() => {
    chapterFade.setValue(0);
    chapterSlide.setValue(transitionMode === "slide" ? 48 : 0);
    Animated.parallel([
      Animated.timing(chapterFade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(chapterSlide, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [currentChapter?.id]);

  const persistAnnot = (next: Record<number, { color: string; note: string; text: string }>) => {
    setHighlights(next);
    AsyncStorage.setItem(`annot:${storyId}`, JSON.stringify(next)).catch(() => {});
    AsyncStorage.getItem("annot:stories").then((raw) => {
      let list: any[] = [];
      try { if (raw) list = JSON.parse(raw); } catch {}
      const count = Object.keys(next).length;
      const rest = list.filter((s: any) => s.storyId !== storyId);
      if (count > 0) rest.unshift({ storyId, title: story?.title || "Untitled", count, updatedAt: new Date().toISOString() });
      AsyncStorage.setItem("annot:stories", JSON.stringify(rest.slice(0, 100))).catch(() => {});
    }).catch(() => {});
  };

  const toggleHighlight = (idx: number, text: string) => {
    const next = { ...highlights };
    if (next[idx]) delete next[idx];
    else next[idx] = { color: "#FFE58A", note: "", text: text.slice(0, 500) };
    persistAnnot(next);
    Haptics.selectionAsync().catch(() => {});
  };

  const openNote = (idx: number, text: string) => {
    setNoteDraft(highlights[idx]?.note || "");
    setNoteTarget({ idx, text });
  };

  const saveNote = () => {
    if (!noteTarget) return;
    const next = { ...highlights, [noteTarget.idx]: { color: "#FFE58A", note: noteDraft.slice(0, 2000), text: noteTarget.text.slice(0, 500) } };
    persistAnnot(next);
    setNoteTarget(null);
    setNoteDraft("");
    showNotice({ title: "Note saved", message: "Find it anytime in My Annotations.", variant: "success" });
  };

  const applyPreset = (p: { name: string; theme: string; fontSizeMode: string; letterSpacing: number; matchSystem: boolean }) => {
    updateReaderTheme(p.theme);
    setFontSizeMode(p.fontSizeMode as any);
    setLetterSpacing(p.letterSpacing);
    setMatchSystem(p.matchSystem !== false);
    AsyncStorage.multiSet([
      ["readerFontSize", p.fontSizeMode],
      ["readerLetterSpacing", String(p.letterSpacing)],
      ["readerMatchSystem", p.matchSystem !== false ? "true" : "false"],
    ]).catch(() => {});
    showNotice({ title: p.name, message: "Reading preset applied.", variant: "success" });
  };

  const savePreset = () => {
    const name = presetName.trim() || `Preset ${presets.length + 1}`;
    const next = [...presets.filter((p) => p.name !== name), { name, theme: readerThemeMode, fontSizeMode, letterSpacing, matchSystem }];
    setPresets(next);
    setPresetName("");
    AsyncStorage.setItem("reader:presets", JSON.stringify(next)).catch(() => {});
  };

  const cycleTransition = () => {
    const next = transitionMode === "fade" ? "slide" : "fade";
    setTransitionMode(next);
    AsyncStorage.setItem("reader:transition", next).catch(() => {});
  };

  const playNarration = async () => {
    const url = currentChapter?.audioUrl;
    if (!url) return;
    try {
      stopTts();
      await setupAudioPlayer().catch(() => {});
      await playEpisodeQueue(
        { id: `narr:${currentChapter.id}`, title: `${story?.title || "Story"} — ${currentChapter.title || "Chapter"}`, audioUrl: url, author: story?.authorName || "StoryNest" },
        []
      );
      setNarrating(true);
    } catch {
      showNotice({ title: "Playback error", message: "Could not play this narration.", variant: "error" });
    }
  };

  const stopNarration = async () => {
    try { await TrackPlayer.reset(); } catch {}
    setNarrating(false);
  };

  const toggleNarration = async () => {
    if (!narrating) return playNarration();
    try {
      const playing = await togglePlayback();
      setNarrating(playing);
    } catch { setNarrating(false); }
  };

  const downloadNarration = async () => {
    const url = currentChapter?.audioUrl;
    if (!url) return;
    try {
      const dest = `${FileSystem.documentDirectory}narr-${currentChapter.id}.mp3`;
      await FileSystem.downloadAsync(url, dest);
      showNotice({ title: "Saved", message: "Narration downloaded for offline listening.", variant: "success" });
    } catch {
      showNotice({ title: "Error", message: "Could not download the narration.", variant: "error" });
    }
  };

  const openQuote = (idx: number, text: string) => setQuoteTarget({ idx, text });

  const captureQuote = async () => {
    try {
      const uri = await quoteShot.current?.capture?.();
      if (!uri) return;
      const shareUri = Platform.OS === "android" ? await FileSystem.getContentUriAsync(uri) : uri;
      await Share.share({ url: shareUri, title: "StoryNest quote" });
    } catch {
      showNotice({ title: "Error", message: "Could not create the quote card.", variant: "error" });
    }
  };

  // Personal reading speed (words per minute, learned while reading)
  const [wpm, setWpm] = useState(200);
  const wpmRef = useRef(200);
  const measureRef = useRef<{ progress: number; time: number } | null>(null);
  const lastWpmPersist = useRef(0);

  // Auto-scroll
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1); // 1x, 2x, 3x
  const scrollOffset = useRef(0);
  const AUTO_SCROLL_RATES = [20, 45, 90]; // px per second per speed level

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

  const baseFontSize = FONT_SIZES[fontSizeMode];
  const fontSize = matchSystem ? Math.round(baseFontSize * Math.min(PixelRatio.getFontScale(), 1.35)) : baseFontSize;

  // Android back button closes the topmost sheet instead of leaving the reader.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showSearch) { closeSearch(); return true; }
      if (showComments) { setShowComments(false); return true; }
      if (showTOC) { setShowTOC(false); return true; }
      if (showTranslate) { setShowTranslate(false); return true; }
      if (showDictionary) { setShowDictionary(false); return true; }
      if (showThemePicker) { setShowThemePicker(false); return true; }
      if (showWarning) { setShowWarning(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [showSearch, showComments, showTOC, showTranslate, showDictionary, showThemePicker, showWarning]);

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

  const goalCelebrated = useRef(false);
  useEffect(() => {
    if (!storyId) return;
    const id = setInterval(() => {
      if (story?.canRead === false) return;
      apiClient.post(`/stories/${storyId}/read-time`, { seconds: 60 }).then((res) => {
        if (res.data?.goalHit && !goalCelebrated.current) {
          goalCelebrated.current = true;
          showNotice({ title: "Daily goal crushed", message: "You hit your reading goal today. Keep going!", variant: "success" });
        }
        (res.data?.newBadges || []).forEach((b: any) => {
          showNotice({ title: "Achievement unlocked", message: b.title, variant: "success" });
        });
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, [storyId, story?.canRead]);

  const loadSavedSettings = async () => {
    // Reader theme backup: this story's theme wins, then the global reader
    // theme, then the server preference. Never silently reset to a default.
    const [savedFont, storyTheme, globalTheme, savedWpm, savedSpeed, savedTtsRate, savedSpacing, savedMatch] = await Promise.all([
      AsyncStorage.getItem("readerFontSize"),
      AsyncStorage.getItem(`readerTheme:${storyId}`),
      AsyncStorage.getItem("readerTheme"),
      AsyncStorage.getItem("readerWpm"),
      AsyncStorage.getItem("autoScrollSpeed"),
      AsyncStorage.getItem("ttsRate"),
      AsyncStorage.getItem("readerLetterSpacing"),
      AsyncStorage.getItem("readerMatchSystem"),
    ]);
    if (savedFont) setFontSizeMode(savedFont as any);
    setReaderThemeMode(storyTheme || globalTheme || user?.readerTheme || "light");
    const parsedWpm = parseInt(savedWpm || "", 10);
    if (parsedWpm >= 60 && parsedWpm <= 600) {
      wpmRef.current = parsedWpm;
      setWpm(parsedWpm);
    }
    const parsedSpeed = parseInt(savedSpeed || "", 10);
    if (parsedSpeed >= 1 && parsedSpeed <= 3) setScrollSpeed(parsedSpeed);
    const parsedRate = parseFloat(savedTtsRate || "");
    if ([1, 1.25, 1.5, 2].includes(parsedRate)) { setTtsRate(parsedRate); ttsRateRef.current = parsedRate; }
    const parsedSpacing = parseFloat(savedSpacing || "");
    if (!isNaN(parsedSpacing) && parsedSpacing >= 0 && parsedSpacing <= 3) setLetterSpacing(parsedSpacing);
    if (savedMatch !== null) setMatchSystem(savedMatch !== "false");
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
        const dlStories = await OfflineManager.getDownloadedStories().catch(() => []);
        const dl = dlStories.find((s: any) => s.id === storyId);
        if (dl) {
          setStory({ ...dl, canRead: true, chapters: dl.chapters || [] });
          setChapters(dl.chapters || []);
          if (dl.chapters && dl.chapters.length > 0) {
            setCurrentChapter(dl.chapters[0]);
            setOriginalBody(dl.chapters[0].body || "");
          }
          showNotice({ title: "Offline mode", message: "Showing your downloaded copy.", variant: "info" });
        } else if (!story) {
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
      // New chapter: restart speed measurement and stop auto-scroll.
      measureRef.current = null;
      setAutoScroll(false);
      stopTts();
      stopNarration().catch(() => {});
      setFocusIdx(null);
      // Prefetch the next chapter while the reader is busy with this one.
      const chIdx = chapters.findIndex((c: any) => c.id === chapterId);
      const nextCh = chIdx >= 0 ? chapters[chIdx + 1] : null;
      if (nextCh?.id) {
        Cache.getStale<any>(`chapter:${nextCh.id}`).then((cached) => {
          if (!cached?.body) apiClient.get(`/chapters/${nextCh.id}`).then((r) => Cache.set(`chapter:${nextCh.id}`, r.data).catch(() => {})).catch(() => {});
        }).catch(() => {});
      }
      // Offline downloads win: no network needed at all.
      try {
        const dlList = await OfflineManager.getDownloadedStories().catch(() => []);
        const dlStory = dlList.find((s: any) => s.id === storyId);
        const dlCh = dlStory?.chapters?.find((c: any) => c.id === chapterId);
        if (dlCh?.body) {
          setCurrentChapter(dlCh);
          setOriginalBody(dlCh.body);
          setHasResumed(false);
          scrollViewRef.current?.scrollTo({ y: 0, animated: false });
          setScrollProgress(0);
          setShowTOC(false);
          return;
        }
      } catch {}
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
    Haptics.selectionAsync().catch(() => {});
    try {
      const progress = wasBookmarked ? -1 : Math.round(scrollProgress * 100);
      await apiClient.post(`/stories/${storyId}/bookmark`, { progress });
      if (!wasBookmarked) {
        showNotice({ title: "Saved", message: "Story added to your library.", variant: "success" });
        ActivityLog.log({ kind: "BOOKMARK", title: story?.title || "story", storyId, coverUrl: story?.coverUrl });
        Promise.all([OfflineManager.getAutoDownload().catch(() => false), AsyncStorage.getItem("autoDl:wifiOnly"), NetInfo.fetch().catch(() => null)]).then(([auto, wifiOnly, net]) => {
          if (!auto || !story) return;
          if (wifiOnly === "true" && net && net.type !== "wifi") {
            showNotice({ title: "On mobile data", message: "Auto-download waits for Wi-Fi (change in Settings).", variant: "info" });
            return;
          }
          OfflineManager.downloadStory({ ...story, id: storyId }).catch(() => {});
        }).catch(() => {});
      }
    } catch (error) {
      const online = await Outbox.isOnline().catch(() => true);
      if (!online) {
        Outbox.enqueue({ kind: wasBookmarked ? "unbookmark" : "bookmark", storyId, payload: { progress: wasBookmarked ? -1 : Math.round(scrollProgress * 100) } }).catch(() => {});
        showNotice({ title: "Saved offline", message: "Your library will sync when you reconnect.", variant: "info" });
      } else {
        setIsBookmarked(wasBookmarked);
      }
    }
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
          paragraphIndex: paraFilter,
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
              paragraphIndex: paraFilter,
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
          const online = await Outbox.isOnline().catch(() => true);
          if (!online) {
              Outbox.enqueue({ kind: "comment", storyId, payload: { content, parentId, paragraphIndex: paraFilter } }).catch(() => {});
              showNotice({ title: "Saved offline", message: "Your comment will post when you reconnect.", variant: "info" });
          } else {
              const rolledBack = withOptimistic.filter(c => c.id !== tempId);
              commentsQuery.setData(rolledBack);
              setNewComment(content);
              showNotice({ title: "Notice", message: getFriendlyErrorMessage(e, "Could not post comment. Please try again."), variant: "error" });
          }
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
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <TouchableOpacity style={styles.replyBtn} onPress={() => handleReplyPress(c)}>
                              <Reply size={14} color={appTheme.primary} />
                              <Text style={[styles.replyBtnText, { color: appTheme.primary, fontFamily: fonts.heading }]}>REPLY</Text>
                          </TouchableOpacity>
                          {depth === 0 && (
                          <TouchableOpacity style={[styles.replyBtn, { marginLeft: 12 }]} onPress={() => handleMuteThread(c.id)}>
                              <Text style={[styles.replyBtnText, { color: appTheme.primary, fontFamily: fonts.heading, opacity: 0.5 }]}>MUTE</Text>
                          </TouchableOpacity>
                          )}
                          <TouchableOpacity style={[styles.replyBtn, { marginLeft: 12 }]} onPress={() => setReportTarget({ type: "comment", id: c.id, title: String(c.content || "").slice(0, 60) })}>
                              <Text style={[styles.replyBtnText, { color: appTheme.primary, fontFamily: fonts.heading, opacity: 0.5 }]}>REPORT</Text>
                          </TouchableOpacity>
                          </View>
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const res = await apiClient.post(`/stories/${storyId}/like`);
      setIsLiked(res.data.isLiked);
      setLikeCount(res.data.likes);
      if (res.data.isLiked) {
        ActivityLog.log({ kind: "LIKE", title: story?.title || "story", storyId, coverUrl: story?.coverUrl });
      }
    } catch (error) {
      const online = await Outbox.isOnline().catch(() => true);
      if (!online) {
        Outbox.enqueue({ kind: wasLiked ? "unlike" : "like", storyId }).catch(() => {});
        showNotice({ title: "Saved offline", message: "Your like will sync when you reconnect.", variant: "info" });
      } else {
        setIsLiked(wasLiked);
        setLikeCount((prev) => wasLiked ? prev + 1 : prev - 1);
      }
    }
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

  // ---- Batch 3/4: reactions, paragraph discussion, similar stories ----
  const REACTION_EMOJI = ["❤️", "😂", "😮", "😢", "🔥"];

  useEffect(() => {
    if (!storyId) return;
    const chapterId = currentChapter?.id;
    apiClient.get(`/stories/${storyId}/reactions${chapterId ? `?chapterId=${chapterId}` : ""}`)
      .then((res) => {
        setReactionCounts(res.data.counts || {});
        setMyReactions(res.data.mine || []);
      })
      .catch(() => {});
  }, [storyId, currentChapter?.id]);

  useEffect(() => {
    if (!story?.genre) return;
    apiClient.get(`/stories?genre=${encodeURIComponent(story.genre)}&limit=8`)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setSimilar(list.filter((s: any) => s.id !== storyId).slice(0, 6));
      })
      .catch(() => {});
  }, [story?.genre, storyId]);

  const handleReact = async (emoji: string) => {
    if (!tapThrottle(`react:${storyId}:${currentChapter?.id || "story"}`, TAP_GAP_MS)) return;
    try {
      const res = await apiClient.post(`/stories/${storyId}/reactions`, { emoji, chapterId: currentChapter?.id || null });
      setReactionCounts(res.data.counts || {});
      setMyReactions(res.data.mine || []);
    } catch (e) {}
  };

  const paraCommentCount = (idx: number) => comments.filter((c: any) => c.paragraphIndex === idx && !c.parentId).length;

  const openParaDiscussion = (idx: number) => {
    setParaFilter(idx);
    setShowComments(true);
    commentsQuery.refresh();
  };

  const visibleComments = comments.filter((c: any) =>
    !c.parentId &&
    (paraFilter === null || c.paragraphIndex === paraFilter) &&
    !mutedThreads.includes(c.id) &&
    !blockedIds.includes(c.userId)
  );

  useEffect(() => {
    AsyncStorage.getItem("mutedThreads").then((raw) => { try { if (raw) setMutedThreads(JSON.parse(raw)); } catch {} }).catch(() => {});
    apiClient.get("/users/me/blocks").then((r) => { if (Array.isArray(r.data)) setBlockedIds(r.data); }).catch(() => {});
  }, [storyId]);

  const handleMuteThread = async (commentId: string) => {
    const next = [...mutedThreads, commentId];
    setMutedThreads(next);
    AsyncStorage.setItem("mutedThreads", JSON.stringify(next)).catch(() => {});
    showNotice({ title: "Thread muted", message: "You will no longer see this thread.", variant: "info" });
  };

  // ---- Batch 1: in-book search, time-left, auto-scroll ----
  const rawBody = currentChapter?.body || story?.body || "";
  const paragraphs: string[] = useMemo(
    () => rawBody.replace(/\r\n/g, "\n").split("\n\n").filter((p: string) => p.trim().length > 0),
    [rawBody]
  );
  const totalWords = useMemo(
    () => (rawBody.trim() ? rawBody.trim().split(/\s+/).length : 0),
    [rawBody]
  );

  // Global match index across all paragraphs for in-book search.
  const searchIndex = useMemo(() => {
    const matches: { paraIdx: number; start: number }[] = [];
    const paraStart: number[] = [];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      paragraphs.forEach((para: string, pi: number) => {
        paraStart[pi] = matches.length;
        const lower = para.toLowerCase();
        let from = 0;
        for (;;) {
          const at = lower.indexOf(q, from);
          if (at === -1) break;
          matches.push({ paraIdx: pi, start: at });
          from = at + Math.max(1, q.length);
        }
      });
    }
    return { matches, paraStart, qlen: q.length };
  }, [paragraphs, searchQuery]);

  const minsLeft = totalWords > 0 ? Math.ceil(((1 - scrollProgress) * totalWords) / Math.max(60, wpm)) : 0;

  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const totalHeight = contentSize.height - layoutMeasurement.height;
    const progress = totalHeight > 0 ? contentOffset.y / totalHeight : 0;
    scrollOffset.current = contentOffset.y;
    setScrollProgress(progress);
    // Learn personal reading speed from steady forward progress.
    const now = Date.now();
    const m = measureRef.current;
    if (!m) {
      measureRef.current = { progress, time: now };
    } else if (totalWords > 0) {
      const dp = progress - m.progress;
      const dt = (now - m.time) / 1000;
      if (dp > 0.005 && dt > 2) {
        const instant = (dp * totalWords) / (dt / 60);
        if (instant >= 40 && instant <= 800) {
          const next = Math.round(wpmRef.current * 0.8 + instant * 0.2);
          wpmRef.current = next;
          setWpm(next);
          if (now - lastWpmPersist.current > 15000) {
            lastWpmPersist.current = now;
            AsyncStorage.setItem("readerWpm", String(next)).catch(() => {});
          }
        }
        measureRef.current = { progress, time: now };
      } else if (dp < -0.05 || dt > 120) {
        measureRef.current = { progress, time: now };
      }
    }
  };

  const ttsRateRef = useRef(1);

  const stopTts = async () => {
    ttsActive.current = false;
    setTtsPlaying(false);
    if (ttsSleepTimer.current) { clearTimeout(ttsSleepTimer.current); ttsSleepTimer.current = null; }
    try { await Speech.stop(); } catch (e) {}
  };

  const speakPara = (idx: number, rate: number) => {
    if (!ttsActive.current) return;
    if (idx >= paragraphs.length) { stopTts(); return; }
    ttsIndex.current = idx;
    try {
      Speech.speak(paragraphs[idx], {
        rate,
        onDone: () => { if (ttsActive.current) speakPara(idx + 1, ttsRateRef.current); },
        onStopped: () => {},
        onError: () => { stopTts(); },
      });
    } catch (e) { stopTts(); }
  };

  const toggleTts = async () => {
    if (ttsPlaying) { stopTts(); return; }
    if (paragraphs.length === 0 || story?.canRead === false) return;
    try { if (await Speech.isSpeakingAsync().catch(() => false)) await Speech.stop(); } catch (e) {}
    ttsActive.current = true;
    setTtsPlaying(true);
    ttsRateRef.current = ttsRate;
    if (ttsSleep > 0) {
      if (ttsSleepTimer.current) clearTimeout(ttsSleepTimer.current);
      ttsSleepTimer.current = setTimeout(() => { stopTts(); }, ttsSleep * 60000);
    }
    speakPara(0, ttsRate);
  };

  const cycleTtsRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const next = rates[(rates.indexOf(ttsRate) + 1) % rates.length];
    setTtsRate(next);
    ttsRateRef.current = next;
    AsyncStorage.setItem("ttsRate", String(next)).catch(() => {});
  };

  const cycleTtsSleep = () => {
    const opts = [0, 15, 30, 60];
    setTtsSleep(opts[(opts.indexOf(ttsSleep) + 1) % opts.length]);
  };

  useEffect(() => () => {
    ttsActive.current = false;
    if (ttsSleepTimer.current) clearTimeout(ttsSleepTimer.current);
    Speech.stop().catch(() => {});
  }, []);

  const handleDownloadStory = async () => {
    if (!story) return;
    if (!tapThrottle(`download:${storyId}`, TAP_GAP_MS)) return;
    try {
      showNotice({ title: "Downloading", message: "Saving story for offline reading...", variant: "info" });
      await OfflineManager.downloadStory({ ...story, chapters });
      showNotice({ title: "Saved offline", message: "Find it in Library → Downloads.", variant: "success" });
    } catch (e) {
      showNotice({ title: "Download failed", message: "Check your connection and try again.", variant: "error" });
    }
  };

  const handleExportChapter = async () => {
    const text = paragraphs.join("\n\n");
    if (!text) return;
    try {
      await Share.share({ message: `${story?.title || "Story"} — ${currentChapter?.title || "Chapter"}\n\n${text}`, title: story?.title || "StoryNest export" });
    } catch (e) {}
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery("");
    setMatchIndex(0);
  };

  const goToMatch = (i: number) => {
    const n = searchIndex.matches.length;
    if (n === 0) return;
    const wrapped = ((i % n) + n) % n;
    setMatchIndex(wrapped);
    const m = searchIndex.matches[wrapped];
    const y = bodyTop.current + (paraLayouts.current[m.paraIdx] || 0) - 140;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  };

  const cycleSpeed = () => {
    setScrollSpeed((s) => {
      const next = s >= 3 ? 1 : s + 1;
      AsyncStorage.setItem("autoScrollSpeed", String(next)).catch(() => {});
      return next;
    });
  };

  useEffect(() => {
    if (!autoScroll) return;
    const rate = AUTO_SCROLL_RATES[scrollSpeed - 1] || 20;
    const id = setInterval(() => {
      const maxY = Math.max(0, contentHeight.current - WINDOW_HEIGHT);
      const next = Math.min(scrollOffset.current + rate / 10, maxY);
      scrollOffset.current = next;
      scrollViewRef.current?.scrollTo({ y: next, animated: false });
      if (next >= maxY) setAutoScroll(false);
    }, 100);
    return () => clearInterval(id);
  }, [autoScroll, scrollSpeed]);

  const wrapPara = (node: React.ReactNode, idx: number) => {
    const dimmed = focusIdx !== null && focusIdx !== idx;
    const text = paragraphs[idx] || "";
    const inner = annotateMode ? (
      <TouchableOpacity
        key={idx}
        activeOpacity={0.7}
        style={dimmed ? { opacity: 0.2 } : undefined}
        onPress={() => toggleHighlight(idx, text)}
        onLongPress={() => openNote(idx, text)}
        accessibilityLabel={`Paragraph ${idx + 1}. Tap to highlight, long press to add a note.`}
      >
        {node}
      </TouchableOpacity>
    ) : (
      <TouchableOpacity
        key={idx}
        activeOpacity={1}
        style={dimmed ? { opacity: 0.2 } : undefined}
        onLongPress={() => { setFocusIdx(idx); Haptics.selectionAsync().catch(() => {}); }}
        onPress={() => { if (focusIdx !== null) setFocusIdx(null); }}
        accessibilityLabel={`Paragraph ${idx + 1}. Long press to focus.`}
      >
        {node}
      </TouchableOpacity>
    );
    if (!discussMode) return inner;
    const count = paraCommentCount(idx);
    return (
      <View key={`d${idx}`} style={styles.paraRow}>
        <View style={{ flex: 1 }}>{inner}</View>
        <TouchableOpacity style={styles.paraBadge} onPress={() => openParaDiscussion(idx)} accessibilityLabel={`Discuss paragraph ${idx + 1}`}>
          <MessageSquare size={14} color={count > 0 ? Colors.accent : readerTheme.meta} />
          {count > 0 && <Text style={[styles.paraBadgeCount, { color: readerTheme.meta, fontFamily: fonts.body }]}>{count}</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  const renderBodyParagraph = (para: string, idx: number) => {
    const hl = highlights[idx];
    const style = [styles.bodyText, { color: hl ? "#003631" : readerTheme.text, fontFamily: fonts.body, fontSize, lineHeight: fontSize * 1.75 + letterSpacing * 2, letterSpacing, marginBottom: 20, ...(hl ? { backgroundColor: hl.color } : {}) }];
    const onLayout = (e: any) => { paraLayouts.current[idx] = e.nativeEvent.layout.y; };
    const q = searchQuery.trim();
    if (!q) {
      return wrapPara(<Text style={style} onLayout={onLayout}>{para}</Text>, idx);
    }
    const lq = q.toLowerCase();
    const lower = para.toLowerCase();
    const parts: React.ReactNode[] = [];
    let from = 0;
    let key = 0;
    let local = 0;
    for (;;) {
      const at = lower.indexOf(lq, from);
      if (at === -1) break;
      if (at > from) parts.push(<Text key={key++}>{para.slice(from, at)}</Text>);
      const globalIdx = (searchIndex.paraStart[idx] || 0) + local;
      const active = globalIdx === matchIndex;
      parts.push(
        <Text key={key++} style={{ backgroundColor: active ? "#FFB800" : "#FFE58A", color: "#003631" }}>
          {para.slice(at, at + q.length)}
        </Text>
      );
      local += 1;
      from = at + Math.max(1, q.length);
    }
    parts.push(<Text key={key++}>{para.slice(from)}</Text>);
    return wrapPara(<Text style={style} onLayout={onLayout}>{parts}</Text>, idx);
  };

  if (loading && !story) {
      return (
          <View style={[styles.container, { backgroundColor: appTheme.white }]}>
              <SkeletonReader />
          </View>
      );
  }

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
        {showSearch ? (
          <View style={styles.searchRow}>
            <TouchableOpacity onPress={closeSearch}><X size={22} color={readerTheme.text} /></TouchableOpacity>
            <TextInput
              style={[styles.searchInput, { color: readerTheme.text, backgroundColor: isReaderDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', fontFamily: fonts.body }]}
              placeholder="Find in chapter..."
              placeholderTextColor={readerTheme.meta}
              value={searchQuery}
              onChangeText={(t) => { setSearchQuery(t); setMatchIndex(0); }}
              onSubmitEditing={() => goToMatch(0)}
              returnKeyType="search"
              autoFocus
            />
            <Text style={[styles.searchCount, { color: readerTheme.meta, fontFamily: fonts.body }]}>
              {searchIndex.matches.length > 0 ? `${matchIndex + 1}/${searchIndex.matches.length}` : (searchQuery.trim() ? "0" : "")}
            </Text>
            <TouchableOpacity onPress={() => goToMatch(matchIndex - 1)} style={styles.iconBtn}><ChevronUp size={20} color={readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => goToMatch(matchIndex + 1)} style={styles.iconBtn}><ChevronDown size={20} color={readerTheme.text} /></TouchableOpacity>
          </View>
        ) : (
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft size={24} color={readerTheme.text} /></TouchableOpacity>
          <View style={styles.topBarIcons}>
            <TouchableOpacity onPress={() => setShowSearch(true)} style={styles.iconBtn} accessibilityLabel="Find in chapter" accessibilityRole="button"><Search size={20} color={readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setDiscussMode((v) => !v)} style={styles.iconBtn} accessibilityLabel="Paragraph discussion mode" accessibilityRole="button"><MessageSquare size={20} color={discussMode ? Colors.accent : readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowThemePicker(true)} style={styles.iconBtn} accessibilityLabel="Reading theme and presets" accessibilityRole="button">
                <Palette size={20} color={readerTheme.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTOC(true)} style={styles.iconBtn} accessibilityLabel="Chapter list" accessibilityRole="button"><List size={20} color={readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTranslate(true)} style={styles.iconBtn} accessibilityLabel="Translate chapter" accessibilityRole="button"><Globe size={20} color={readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDictionary(true)} style={styles.iconBtn} accessibilityLabel="Dictionary lookup" accessibilityRole="button"><Book size={20} color={readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setAnnotateMode((v) => !v)} style={styles.iconBtn} accessibilityLabel="Highlight and notes mode" accessibilityRole="button"><Highlighter size={20} color={annotateMode ? Colors.accent : readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("Annotations")} style={styles.iconBtn} accessibilityLabel="My annotations" accessibilityRole="button"><StickyNote size={20} color={readerTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={handleBookmark} style={styles.iconBtn} accessibilityLabel="Bookmark story"><Bookmark size={20} color={isBookmarked ? Colors.accent : readerTheme.text} fill={isBookmarked ? Colors.accent : "none"} /></TouchableOpacity>
            <TouchableOpacity onPress={toggleTts} style={styles.iconBtn} accessibilityLabel={ttsPlaying ? "Stop listening" : "Listen to chapter"}><Headphones size={20} color={ttsPlaying ? Colors.accent : readerTheme.text} /></TouchableOpacity>
          </View>
        </View>
        )}
        <View style={styles.progressContainer}><Animated.View style={[styles.progressBar, { width: progressBarWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: readerTheme.primary }]} /></View>
        {ttsPlaying && (
          <View style={styles.ttsStrip}>
            <TouchableOpacity onPress={cycleTtsRate} style={styles.ttsChip} accessibilityLabel="Playback speed">
              <Text style={[styles.ttsChipText, { color: readerTheme.text, fontFamily: fonts.heading }]}>{ttsRate}x</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cycleTtsSleep} style={styles.ttsChip} accessibilityLabel="Sleep timer">
              <Timer size={14} color={readerTheme.text} />
              <Text style={[styles.ttsChipText, { color: readerTheme.text, fontFamily: fonts.heading }]}>{ttsSleep === 0 ? "OFF" : `${ttsSleep}m`}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={stopTts} style={styles.ttsChip} accessibilityLabel="Stop listening">
              <Text style={[styles.ttsChipText, { color: readerTheme.text, fontFamily: fonts.heading }]}>STOP</Text>
            </TouchableOpacity>
          </View>
        )}
        {!!currentChapter?.audioUrl && (
          <View style={styles.ttsStrip}>
            <Music size={14} color={readerTheme.text} />
            <Text style={[styles.ttsChipText, { color: readerTheme.text, fontFamily: fonts.heading }]}>NARRATION</Text>
            <TouchableOpacity onPress={toggleNarration} style={styles.ttsChip} accessibilityLabel={narrating ? "Pause narration" : "Play narration"}>
              {narrating ? <Pause size={14} color={readerTheme.text} /> : <Play size={14} color={readerTheme.text} />}
              <Text style={[styles.ttsChipText, { color: readerTheme.text, fontFamily: fonts.heading }]}>{narrating ? "PAUSE" : "PLAY"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={downloadNarration} style={styles.ttsChip} accessibilityLabel="Download narration">
              <Download size={14} color={readerTheme.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={[styles.content, { opacity: chapterFade, transform: [{ translateX: chapterSlide }] }]}
        onScroll={handleScroll}
        onScrollBeginDrag={() => { if (autoScroll) setAutoScroll(false); }}
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
          {totalWords > 0 && story?.canRead !== false && (
            <Text style={[styles.readMeta, { color: readerTheme.meta, fontFamily: fonts.heading }]}>
              {minsLeft > 0 ? `${minsLeft} MIN LEFT` : "CHAPTER FINISHED"} • {totalWords.toLocaleString()} WORDS
            </Text>
          )}
        </View>

        <View style={styles.bodyContainer} onLayout={(e) => { bodyTop.current = e.nativeEvent.layout.y; }}>
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
                  <Text style={[styles.lockedTitle, { fontFamily: fonts.heading, color: readerTheme.text }]}>{story?.blockedReason === "age" ? "18+ ONLY" : "PREMIUM STORY"}</Text>
                  <Text style={[styles.lockedDesc, { fontFamily: fonts.body, color: readerTheme.meta }]}>
                      {story?.blockedReason === "age"
                        ? "This story is rated 18+. Add your date of birth in Edit Profile to verify your age."
                        : "This masterpiece is exclusive to StoryNest Premium members."}
                  </Text>
                  {story?.blockedReason !== "age" && (
                  <TouchableOpacity
                    style={[styles.upgradeBtn, { backgroundColor: Colors.accent }]}
                    onPress={handleUnlock}
                  >
                      <Text style={[styles.upgradeBtnText, { color: Colors.primary, fontFamily: fonts.heading }]}>UNLOCK NOW</Text>
                  </TouchableOpacity>
                  )}
              </View>
          ) : paragraphs.length > 0 ? paragraphs.map((para: string, idx: number) => renderBodyParagraph(para, idx)) : (
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

        {story?.canRead !== false && (
            <View style={styles.reactSection}>
                <Text style={[styles.reactTitle, { color: readerTheme.meta, fontFamily: fonts.heading }]}>REACT TO THIS CHAPTER</Text>
                <View style={styles.reactRow}>
                    {REACTION_EMOJI.map((emoji) => {
                        const active = myReactions.includes(emoji);
                        const count = reactionCounts[emoji] || 0;
                        return (
                            <TouchableOpacity
                                key={emoji}
                                style={[styles.reactBtn, active && { borderColor: Colors.accent, backgroundColor: Colors.accent + "22" }]}
                                onPress={() => handleReact(emoji)}
                            >
                                <Text style={styles.reactEmoji}>{emoji}</Text>
                                {count > 0 && <Text style={[styles.reactCount, { color: readerTheme.text, fontFamily: fonts.body }]}>{count}</Text>}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        )}

        {story?.canRead !== false && similar.length > 0 && (
            <View style={styles.similarSection}>
                <Text style={[styles.reactTitle, { color: readerTheme.meta, fontFamily: fonts.heading }]}>MORE LIKE THIS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                    {similar.map((s: any) => (
                        <TouchableOpacity key={s.id} style={styles.similarCard} onPress={() => navigation.push("Reader", { storyId: s.id, story: s })}>
                            {s.coverUrl
                              ? <Image source={{ uri: s.coverUrl }} style={styles.similarCover} resizeMode="cover" />
                              : <View style={[styles.similarCover, { backgroundColor: readerTheme.primary + "20", justifyContent: "center", alignItems: "center" }]}><Book size={24} color={readerTheme.primary} /></View>}
                            <Text style={[styles.similarTitle, { color: readerTheme.text, fontFamily: fonts.heading }]} numberOfLines={1}>{s.title}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
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

          <TouchableOpacity onPress={() => { setParaFilter(null); setShowComments(true); commentsQuery.refresh(); }} style={styles.actionBtn}>
            <MessageSquare size={22} color={readerTheme.text} />
            <View style={{ marginLeft: 8 }}>
                <Text style={[styles.actionLabel, { color: readerTheme.text, fontFamily: fonts.heading }]}>COMMENTS</Text>
                <Text style={[styles.actionCount, { color: readerTheme.text, fontFamily: fonts.body }]}>{story?._count?.comments || 0}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDownloadStory} style={styles.actionBtn} accessibilityLabel="Download for offline reading">
            <Download size={22} color={readerTheme.text} />
          </TouchableOpacity>
          {focusIdx !== null && !!paragraphs[focusIdx] && (
            <TouchableOpacity onPress={() => openQuote(focusIdx, paragraphs[focusIdx])} style={styles.actionBtn} accessibilityLabel="Make quote card from focused paragraph">
              <Quote size={22} color={readerTheme.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleExportChapter} style={styles.actionBtn} accessibilityLabel="Share chapter text">
            <Share2 size={22} color={readerTheme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setReportTarget({ type: "story", id: storyId, title: story?.title })} style={styles.actionBtn} accessibilityLabel="Report this story">
            <Flag size={22} color={readerTheme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Auto-scroll controls */}
      {story?.canRead !== false && paragraphs.length > 0 && (
        <>
          <TouchableOpacity
            style={[styles.autoScrollFab, { backgroundColor: readerTheme.primary, bottom: 120 }]}
            onPress={() => setAutoScroll((v) => !v)}
            accessibilityLabel={autoScroll ? "Pause auto-scroll" : "Start auto-scroll"}
          >
            {autoScroll
              ? <Pause size={20} color={readerTheme.bg} />
              : <Play size={20} color={readerTheme.bg} />}
          </TouchableOpacity>
          {autoScroll && (
            <TouchableOpacity
              style={[styles.autoScrollFab, { backgroundColor: readerTheme.primary, bottom: 180 }]}
              onPress={cycleSpeed}
              accessibilityLabel="Change auto-scroll speed"
            >
              <Text style={[styles.speedText, { color: readerTheme.bg, fontFamily: fonts.heading }]}>{scrollSpeed}x</Text>
            </TouchableOpacity>
          )}
        </>
      )}

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
                  <View style={styles.readabilityRow}>
                      <Text style={[styles.readabilityLabel, { color: appTheme.black, fontFamily: fonts.heading }]}>LETTER SPACING</Text>
                      <View style={styles.stepperRow}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => { const v = Math.max(0, letterSpacing - 0.5); setLetterSpacing(v); AsyncStorage.setItem("readerLetterSpacing", String(v)).catch(() => {}); }}
                            accessibilityLabel="Decrease letter spacing"
                          ><Text style={[styles.stepperText, { color: appTheme.black }]}>−</Text></TouchableOpacity>
                          <Text style={[styles.stepperValue, { color: appTheme.black, fontFamily: fonts.body }]}>{letterSpacing.toFixed(1)}</Text>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => { const v = Math.min(3, letterSpacing + 0.5); setLetterSpacing(v); AsyncStorage.setItem("readerLetterSpacing", String(v)).catch(() => {}); }}
                            accessibilityLabel="Increase letter spacing"
                          ><Text style={[styles.stepperText, { color: appTheme.black }]}>+</Text></TouchableOpacity>
                      </View>
                  </View>
                  <TouchableOpacity
                    style={styles.readabilityRow}
                    onPress={() => { const v = !matchSystem; setMatchSystem(v); AsyncStorage.setItem("readerMatchSystem", v ? "true" : "false").catch(() => {}); }}
                    accessibilityLabel="Match system text size"
                  >
                      <Text style={[styles.readabilityLabel, { color: appTheme.black, fontFamily: fonts.heading }]}>MATCH SYSTEM TEXT SIZE</Text>
                      <Text style={[styles.stepperValue, { color: matchSystem ? Colors.accent : Colors.mutedTeal, fontFamily: fonts.heading }]}>{matchSystem ? "ON" : "OFF"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.readabilityRow}
                    onPress={cycleTransition}
                    accessibilityLabel="Chapter transition animation"
                  >
                      <Text style={[styles.readabilityLabel, { color: appTheme.black, fontFamily: fonts.heading }]}>CHAPTER TRANSITION</Text>
                      <Text style={[styles.stepperValue, { color: appTheme.black, fontFamily: fonts.heading }]}>{transitionMode.toUpperCase()}</Text>
                  </TouchableOpacity>
                  <View style={styles.readabilityRow}>
                      <Text style={[styles.readabilityLabel, { color: appTheme.black, fontFamily: fonts.heading }]}>MY PRESETS</Text>
                  </View>
                  {presets.map((p) => (
                    <View key={p.name} style={[styles.readabilityRow, { paddingVertical: 6 }]}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => applyPreset(p)} accessibilityLabel={`Apply preset ${p.name}`}>
                        <Text style={[styles.stepperValue, { color: appTheme.black, fontFamily: fonts.body }]}>{p.name} <Text style={{ color: Colors.mutedTeal, fontSize: 12 }}>({p.theme} · {p.fontSizeMode})</Text></Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const next = presets.filter((x) => x.name !== p.name);
                          setPresets(next);
                          AsyncStorage.setItem("reader:presets", JSON.stringify(next)).catch(() => {});
                        }}
                        accessibilityLabel={`Delete preset ${p.name}`}
                      ><X size={18} color={Colors.mutedTeal} /></TouchableOpacity>
                    </View>
                  ))}
                  <View style={[styles.readabilityRow, { gap: 8 }]}>
                    <TextInput
                      style={[styles.searchInput, { flex: 1, color: appTheme.black, backgroundColor: isReaderDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', fontFamily: fonts.body }]}
                      placeholder="Preset name (e.g. Night bus)"
                      placeholderTextColor={Colors.mutedTeal}
                      value={presetName}
                      onChangeText={setPresetName}
                    />
                    <TouchableOpacity onPress={savePreset} style={[styles.ttsChip, { backgroundColor: appTheme.primary }]} accessibilityLabel="Save current settings as preset">
                      <Text style={[styles.ttsChipText, { color: "#fff", fontFamily: fonts.heading }]}>SAVE</Text>
                    </TouchableOpacity>
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

      <Modal visible={noteTarget !== null} animationType="slide" transparent onRequestClose={() => setNoteTarget(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }]}>
              <View style={[styles.modalContent, { backgroundColor: appTheme.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 32 }]}>
                  <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: appTheme.black, fontFamily: fonts.heading }]}>PARAGRAPH NOTE</Text><TouchableOpacity onPress={() => setNoteTarget(null)}><X size={24} color={appTheme.black} /></TouchableOpacity></View>
                  <Text style={[styles.modalDesc, { fontFamily: fonts.body, fontStyle: "italic" }]} numberOfLines={3}>"{noteTarget?.text}"</Text>
                  <TextInput
                    style={[styles.searchInput, { color: appTheme.black, backgroundColor: isReaderDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', fontFamily: fonts.body, minHeight: 90, textAlignVertical: "top", marginTop: 12 }]}
                    placeholder="Write a private note..."
                    placeholderTextColor={Colors.mutedTeal}
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    multiline
                  />
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                      <TouchableOpacity style={[styles.actionBtnPrimary, { flex: 1 }]} onPress={saveNote}>
                          <Text style={styles.actionBtnTextPrimary}>SAVE NOTE</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ttsChip, { backgroundColor: appTheme.primary, justifyContent: "center" }]}
                        onPress={() => { if (noteTarget) { setNoteTarget(null); openQuote(noteTarget.idx, noteTarget.text); } }}
                        accessibilityLabel="Make quote card from this paragraph"
                      >
                          <Quote size={14} color="#fff" />
                          <Text style={[styles.ttsChipText, { color: "#fff", fontFamily: fonts.heading }]}>QUOTE</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
          </KeyboardAvoidingView>
      </Modal>

      <Modal visible={quoteTarget !== null} animationType="fade" transparent onRequestClose={() => setQuoteTarget(null)}>
          <View style={[styles.centeredOverlay, { padding: 24 }]}>
              <ViewShot ref={quoteShot} options={{ format: "png", quality: 1 }} style={{ width: "100%", borderRadius: 16, overflow: "hidden" }}>
                  <View style={{ backgroundColor: "#003631", padding: 28, borderRadius: 16 }}>
                      <Quote size={28} color="#FFEDA8" />
                      <Text style={{ fontFamily: fonts.body, fontSize: 18, lineHeight: 28, color: "#FFFFFF", marginTop: 12 }}>"{quoteTarget?.text?.slice(0, 280)}"</Text>
                      <Text style={{ fontFamily: fonts.heading, fontSize: 13, color: "#FFEDA8", marginTop: 16 }}>— {story?.title || "StoryNest"}{story?.authorName ? ` by ${story.authorName}` : ""}</Text>
                      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4, letterSpacing: 2 }}>STORYNEST</Text>
                  </View>
              </ViewShot>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16, width: "100%" }}>
                  <TouchableOpacity style={[styles.ttsChip, { flex: 1, justifyContent: "center", backgroundColor: appTheme.primary }]} onPress={captureQuote} accessibilityLabel="Share quote card">
                      <Share2 size={14} color="#fff" />
                      <Text style={[styles.ttsChipText, { color: "#fff", fontFamily: fonts.heading }]}>SHARE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.ttsChip, { flex: 1, justifyContent: "center" }]} onPress={() => setQuoteTarget(null)}>
                      <Text style={[styles.ttsChipText, { color: appTheme.black, fontFamily: fonts.heading }]}>CLOSE</Text>
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

      <Modal visible={showComments} animationType="slide" transparent onRequestClose={() => { setParaFilter(null); setShowComments(false); }}>
          <View style={[styles.modalOverlay, { backgroundColor: appTheme.white, paddingTop: insets.top + 20 }]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: appTheme.black, fontFamily: fonts.heading }]}>COMMENTS</Text><TouchableOpacity onPress={() => { setParaFilter(null); setShowComments(false); }}><X size={24} color={appTheme.black} /></TouchableOpacity></View>
              {paraFilter !== null && (
                  <TouchableOpacity style={styles.paraFilterChip} onPress={() => setParaFilter(null)}>
                      <Text style={[styles.paraFilterText, { fontFamily: fonts.heading }]}>PARAGRAPH {paraFilter + 1} • SHOW ALL</Text>
                  </TouchableOpacity>
              )}
              <ScrollView style={{ padding: 24 }}>
                  {visibleComments.map((c: any) => renderComment(c))}
                  {visibleComments.length === 0 && (
                      <Text style={{ textAlign: 'center', marginTop: 40, opacity: 0.5 }}>
                          {commentsQuery.isFirstLoad ? "Loading comments..." : (paraFilter !== null ? "No discussion on this paragraph yet. Start it below." : "No comments yet.")}
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
                        placeholder={paraFilter !== null ? `Discuss paragraph ${paraFilter + 1}...` : "Add a comment..."}
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

      <ReportSheet
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type || "story"}
        targetId={reportTarget?.id || storyId}
        targetTitle={reportTarget?.title}
      />
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
  upgradeBtnText: { fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  searchInput: { flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 16, fontSize: 14, marginHorizontal: 10 },
  searchCount: { fontSize: 12, minWidth: 44, textAlign: "center" },
  readMeta: { fontSize: 11, letterSpacing: 1.5, marginTop: 8 },
  autoScrollFab: { position: "absolute", right: 16, width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
  speedText: { fontSize: 14, letterSpacing: 0.5 },
  paraRow: { flexDirection: "row", alignItems: "flex-start" },
  paraBadge: { flexDirection: "row", alignItems: "center", padding: 8, marginLeft: 4, marginTop: 2 },
  paraBadgeCount: { fontSize: 11, marginLeft: 4 },
  paraFilterChip: { alignSelf: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.primary, marginBottom: 8 },
  paraFilterText: { fontSize: 11, color: Colors.accent, letterSpacing: 1 },
  reactSection: { paddingHorizontal: 24, marginBottom: 32 },
  reactTitle: { fontSize: 11, letterSpacing: 1.5, marginBottom: 12 },
  reactRow: { flexDirection: "row", justifyContent: "space-between" },
  reactBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, marginHorizontal: 3, borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  reactEmoji: { fontSize: 18 },
  reactCount: { fontSize: 12, marginLeft: 6 },
  ttsStrip: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 8 },
  ttsChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.06)", marginHorizontal: 4 },
  ttsChipText: { fontSize: 11, letterSpacing: 1, marginLeft: 4 },
  readabilityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingVertical: 12 },
  readabilityLabel: { fontSize: 12, letterSpacing: 1 },
  stepperRow: { flexDirection: "row", alignItems: "center" },
  stepperBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.06)", justifyContent: "center", alignItems: "center" },
  stepperText: { fontSize: 18 },
  stepperValue: { fontSize: 14, marginHorizontal: 12, minWidth: 36, textAlign: "center" },
  similarSection: { marginBottom: 48 },
  similarCard: { width: 120, marginRight: 14 },
  similarCover: { width: 120, height: 170, borderRadius: 12, marginBottom: 8 },
  similarTitle: { fontSize: 13 },
});
