import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Animated, Keyboard, Alert, Dimensions, Modal, FlatList } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Bookmark, Heart, MessageSquare, Moon, Sun, Type, Send, Share2, Volume2, Square, Download, Trash, MousePointer2, StickyNote, Plus, X, AlertTriangle, Reply, Lock, Zap, Highlighter, Book, Search, Globe, ChevronLeft, ChevronRight, List, Star, Coins, BarChart2, FolderPlus } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SkeletonCard } from "../components/SkeletonCard";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Speech from 'expo-speech';
import { OfflineManager } from "../utils/OfflineManager";
import axios from "axios";

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get("window");

const FONT_SIZES = { small: 15, medium: 18, large: 22 };
const HIGHLIGHT_COLORS = [{ name: 'yellow', hex: '#FFEB3B' }, { name: 'green', hex: '#8BC34A' }, { name: 'blue', hex: '#03A9F4' }, { name: 'pink', hex: '#E91E63' }];

export const StoryReaderScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { storyId } = route.params;
  const { user, refreshUser } = useAuth();
  const { theme, fonts, themeMode, setThemeMode, isDarkMode } = useTheme();
  
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
  
  // Feature 67: Playlists
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);

  // Feature 59: Polls
  const [showPolls, setShowPolls] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);

  // Feature 60: Reviews
  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");

  // Feature 35: Tip Jar
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState(10);

  // Other features
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showDictionary, setShowDictionary] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [showTOC, setShowTOC] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const progressBarWidth = useRef(new Animated.Value(0)).current;
  const fontSize = FONT_SIZES[fontSizeMode];

  useEffect(() => {
    fetchStory();
  }, [storyId]);

  useEffect(() => {
    Animated.timing(progressBarWidth, { toValue: scrollProgress, duration: 300, useNativeDriver: false }).start();
  }, [scrollProgress]);

  const fetchStory = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/stories/${storyId}`);
      setStory(res.data);
      setChapters(res.data.chapters || []);
      setLikeCount(res.data._count?.likes || 0);
      setIsLiked(res.data.isLiked);
      if (res.data.chapters?.length > 0) await loadChapter(res.data.chapters[0].id);
    } catch (error) { console.log(error); } 
    finally { setLoading(false); }
  };

  const loadChapter = async (chapterId: string) => {
      setLoading(true);
      try {
          const res = await apiClient.get(`/chapters/${chapterId}`);
          setCurrentChapter(res.data);
          setOriginalBody(res.data.body);
          scrollViewRef.current?.scrollTo({ y: 0, animated: false });
          setShowTOC(false);
      } catch (e) { console.log(e); }
      finally { setLoading(false); }
  };

  const fetchPlaylists = async () => {
      try {
          const res = await apiClient.get("/playlists/me");
          setUserPlaylists(res.data);
          setShowPlaylistPicker(true);
      } catch (e) { console.log(e); }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
      try {
          await apiClient.post(`/playlists/${playlistId}/stories`, { storyId });
          Alert.alert("Success", "Added to your playlist!");
          setShowPlaylistPicker(false);
      } catch (e) { Alert.alert("Already in playlist"); }
  };

  const paragraphs = currentChapter?.body ? currentChapter.body.split('\n\n') : [];
  const currentChapterIdx = chapters.findIndex(c => c.id === currentChapter?.id);

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <View style={[styles.topBar, { backgroundColor: theme.white, paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft size={24} color={theme.black} /></TouchableOpacity>
          <View style={styles.topBarIcons}>
            <TouchableOpacity onPress={fetchPlaylists} style={styles.iconBtn}><FolderPlus size={20} color={theme.black} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTipModal(true)} style={styles.iconBtn}><Coins size={20} color={Colors.accent} /></TouchableOpacity>
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
        }} 
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={styles.header}>
          <Text style={[styles.genre, { color: theme.primary, fontFamily: fonts.body }]}>{story?.genre}</Text>
          <Text style={[styles.title, { color: theme.black, fontFamily: fonts.heading }]}>{story?.title}</Text>
          <View style={styles.chapterHeader}>
              <Text style={[styles.chapterLabel, { color: Colors.mutedTeal, fontFamily: fonts.heading }]}>{currentChapter?.title.toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setShowReviews(true)} style={styles.ratingBox}><Star size={14} color="#FFD700" fill="#FFD700" /><Text style={[styles.ratingText, { fontFamily: fonts.heading }]}>{story?._count?.reviews || 0} reviews</Text></TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.bodyContainer}>
          {paragraphs.map((para, idx) => (
            <Text key={idx} style={[styles.bodyText, { color: theme.black, fontFamily: fonts.body, fontSize, lineHeight: fontSize * 1.75, marginBottom: 20 }]}>{para}</Text>
          ))}
        </View>
        
        {chapters.length > 1 && (
            <View style={styles.chapterNav}>
                <TouchableOpacity style={[styles.navBtn, currentChapterIdx === 0 && { opacity: 0.3 }]} disabled={currentChapterIdx === 0} onPress={() => loadChapter(chapters[currentChapterIdx - 1].id)}><ChevronLeft size={24} color={theme.black} /><Text style={styles.navBtnText}>Previous</Text></TouchableOpacity>
                <Text style={[styles.navProgress, { fontFamily: fonts.heading }]}>{currentChapterIdx + 1} / {chapters.length}</Text>
                <TouchableOpacity style={[styles.navBtn, currentChapterIdx === chapters.length - 1 && { opacity: 0.3 }]} disabled={currentChapterIdx === chapters.length - 1} onPress={() => loadChapter(chapters[currentChapterIdx + 1].id)}><Text style={styles.navBtnText}>Next</Text><ChevronRight size={24} color={theme.black} /></TouchableOpacity>
            </View>
        )}
      </ScrollView>

      {/* Playlist Picker Modal */}
      <Modal visible={showPlaylistPicker} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: theme.white, paddingTop: insets.top + 20 }]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.black, fontFamily: fonts.heading }]}>ADD TO PLAYLIST</Text><TouchableOpacity onPress={() => setShowPlaylistPicker(false)}><X size={24} color={theme.black} /></TouchableOpacity></View>
              <ScrollView style={{ padding: 24 }}>
                  {userPlaylists.map(p => (
                      <TouchableOpacity key={p.id} style={[styles.tocItem, { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }]} onPress={() => handleAddToPlaylist(p.id)}>
                          <Text style={[styles.tocTitle, { color: theme.black, fontFamily: fonts.body }]}>{p.title}</Text>
                          <Plus size={18} color={theme.primary} />
                      </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.createFirstBtn} onPress={() => { setShowPlaylistPicker(false); navigation.navigate("Playlists"); }}><Text style={[styles.createFirstText, { color: theme.primary, fontFamily: fonts.heading }]}>Create New Playlist</Text></TouchableOpacity>
              </ScrollView>
          </View>
      </Modal>

      {/* Tip Modal, TOC Modal - Omitted for brevity */}
      <Modal visible={showTipModal} animationType="fade" transparent>
          <View style={styles.centeredOverlay}>
              <View style={[styles.tipContent, { backgroundColor: theme.white }]}>
                  <Coins size={48} color={Colors.accent} style={{ marginBottom: 20 }} />
                  <Text style={[styles.modalTitle, { color: theme.black, fontFamily: fonts.heading }]}>SUPPORT AUTHOR</Text>
                  <View style={styles.tipRow}>{[10, 50, 100].map(amt => <TouchableOpacity key={amt} style={styles.tipAmt} onPress={() => { setShowTipModal(false); Alert.alert("Success", `Tipped ${amt} coins!`); }}><Text style={styles.tipAmtText}>{amt}</Text></TouchableOpacity>)}</View>
                  <TouchableOpacity onPress={() => setShowTipModal(false)}><Text style={{ color: Colors.mutedTeal, marginTop: 20 }}>Cancel</Text></TouchableOpacity>
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
          <TouchableOpacity style={styles.actionBtn}><Heart size={22} color={isLiked ? "red" : theme.black} fill={isLiked ? "red" : "none"} /><Text style={styles.actionCount}>{likeCount}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}><MessageSquare size={22} color={theme.black} /><Text style={styles.actionCount}>{story?._count?.comments || 0}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setShowNotes(true)} style={styles.actionBtn}><StickyNote size={22} color={theme.black} /></TouchableOpacity>
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
  centeredOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  tipContent: { width: WINDOW_WIDTH - 64, borderRadius: 32, padding: 32, alignItems: 'center' },
  tipRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 32, marginTop: 10 },
  tipAmt: { width: '30%', height: 60, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  tipAmtText: { fontSize: 18, fontWeight: '700' },
  tocItem: { flexDirection: 'row', alignItems: 'center', padding: 20, justifyContent: 'space-between' },
  tocOrder: { fontSize: 20, width: 40, opacity: 0.3 },
  tocTitle: { fontSize: 16 },
  createFirstBtn: { padding: 20, alignItems: 'center', marginTop: 20 },
  createFirstText: { fontSize: 14, letterSpacing: 1 },
});
