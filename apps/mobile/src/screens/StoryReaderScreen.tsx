import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Animated, Keyboard, Alert, Dimensions, Modal } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Bookmark, Heart, MessageSquare, Moon, Sun, Type, Send, Share2, Volume2, Square, Download, Trash, MousePointer2, StickyNote, Plus, X, AlertTriangle } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SkeletonCard } from "../components/SkeletonCard";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Speech from 'expo-speech';
import { OfflineManager } from "../utils/OfflineManager";

const { height: WINDOW_HEIGHT } = Dimensions.get("window");

const FONT_SIZES = {
  small: 15,
  medium: 18,
  large: 22,
};

export const StoryReaderScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { storyId } = route.params;
  const { user, refreshUser } = useAuth();
  const { theme, fonts, themeMode, setThemeMode, isDarkMode } = useTheme();
  
  const [story, setStory] = useState<any>(null);
  const [fontSizeMode, setFontSizeMode] = useState<"small" | "medium" | "large">("medium");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Feature 15: Note-taking
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);

  // Feature 25: Content Warnings
  const [showWarning, setShowWarning] = useState(false);

  // Feature 18: Auto-Scroll
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const autoScrollTimer = useRef<any>(null);
  const scrollY = useRef(0);

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);

  // Animations & Refs
  const likeScale = useRef(new Animated.Value(1)).current;
  const progressBarWidth = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const contentHeight = useRef(0);

  const fontSize = FONT_SIZES[fontSizeMode];

  useEffect(() => {
    loadSavedSettings();
    fetchStory();
    return () => {
        Speech.stop();
        stopAutoScroll();
    };
  }, [storyId]);

  useEffect(() => {
    Animated.timing(progressBarWidth, {
      toValue: scrollProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [scrollProgress]);

  const loadSavedSettings = async () => {
    try {
      const savedFont = await AsyncStorage.getItem("readerFontSize");
      if (savedFont) setFontSizeMode(savedFont as any);
    } catch (e) {}
  };

  const saveFontSize = async (newSize: string) => {
    setFontSizeMode(newSize as any);
    await AsyncStorage.setItem("readerFontSize", newSize);
  };

  const fetchStory = async () => {
    try {
      setLoading(true);
      const [storyRes, bookmarksRes, downloaded] = await Promise.all([
        apiClient.get(`/stories/${storyId}`),
        apiClient.get("/users/me/bookmarks"),
        OfflineManager.isDownloaded(storyId)
      ]);
      
      setStory(storyRes.data);
      setLikeCount(storyRes.data._count?.likes || 0);
      setIsLiked(storyRes.data.isLiked);
      setIsDownloaded(downloaded);
      
      if (storyRes.data.contentWarnings || storyRes.data.isAdult) {
          setShowWarning(true);
      }

      const bookmark = bookmarksRes.data.find((b: any) => b.storyId === storyId);
      setIsBookmarked(!!bookmark);

      if (bookmark && bookmark.progress > 5 && bookmark.progress < 95) {
          Alert.alert(
              "Resume Story?",
              `You were at ${bookmark.progress}% in this story. Would you like to resume?`,
              [
                  { text: "Start Over", style: "cancel" },
                  { text: "Resume", onPress: () => resumeProgress(bookmark.progress) }
              ]
          );
      }
      
      await apiClient.post(`/stories/${storyId}/read`);
      await refreshUser();
    } catch (error) {
        const offlineStories = await OfflineManager.getDownloadedStories();
        const found = offlineStories.find(s => s.id === storyId);
        if (found) {
            setStory(found);
            setIsDownloaded(true);
        }
    } finally {
      setLoading(false);
    }
  };

  const resumeProgress = (percent: number) => {
    setTimeout(() => {
        const target = (percent / 100) * (contentHeight.current - WINDOW_HEIGHT);
        scrollViewRef.current?.scrollTo({ y: target, animated: true });
    }, 500);
  };

  const toggleAutoScroll = () => {
    if (isAutoScrolling) stopAutoScroll();
    else startAutoScroll();
  };

  const startAutoScroll = () => {
    setIsAutoScrolling(true);
    autoScrollTimer.current = setInterval(() => {
        scrollY.current += 1;
        scrollViewRef.current?.scrollTo({ y: scrollY.current, animated: false });
    }, 50);
  };

  const stopAutoScroll = () => {
    setIsAutoScrolling(false);
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await apiClient.get(`/stories/${storyId}/comments`);
      setComments(res.data);
    } catch (error) { console.log(error); } 
    finally { setCommentsLoading(false); }
  };

  const fetchNotes = async () => {
    setNotesLoading(true);
    try {
        const res = await apiClient.get(`/stories/${storyId}/notes`);
        setNotes(res.data);
    } catch (e) { console.log(e); }
    finally { setNotesLoading(false); }
  };

  useEffect(() => {
    if (showComments) fetchComments();
    if (showNotes) fetchNotes();
  }, [showComments, showNotes]);

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    try {
      const res = await apiClient.post(`/stories/${storyId}/comments`, { content: newComment });
      setComments([res.data, ...comments]);
      setNewComment("");
      Keyboard.dismiss();
    } catch (error) { console.log(error); }
  };

  const handleSaveNote = async () => {
    if (!newNote.trim()) return;
    try {
        const res = await apiClient.post(`/stories/${storyId}/notes`, { content: newNote });
        setNotes([res.data, ...notes]);
        setNewNote("");
    } catch (e) { console.log(e); }
  };

  const deleteNote = async (id: string) => {
    try {
        await apiClient.delete(`/notes/${id}`);
        setNotes(notes.filter(n => n.id !== id));
    } catch (e) { console.log(e); }
  };

  const handleLike = async () => {
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

    if (!wasLiked) {
      Animated.sequence([
        Animated.timing(likeScale, { toValue: 1.5, duration: 150, useNativeDriver: true }),
        Animated.spring(likeScale, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();
    }

    try {
      const res = await apiClient.post(`/stories/${storyId}/like`);
      setIsLiked(res.data.isLiked);
      setLikeCount(res.data.likes);
    } catch (error) {
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
    }
  };

  const handleBookmark = async () => {
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);
    try {
      const progress = wasBookmarked ? -1 : Math.round(scrollProgress * 100);
      await apiClient.post(`/stories/${storyId}/bookmark`, { progress });
    } catch (error) {
      setIsBookmarked(wasBookmarked);
      Alert.alert("Error", "Failed to update your library.");
    }
  };

  const handleDownload = async () => {
    if (isDownloaded) {
        await OfflineManager.removeStory(storyId);
        setIsDownloaded(false);
        Alert.alert("Removed", "Story removed from offline downloads.");
    } else {
        const success = await OfflineManager.downloadStory(story);
        if (success) {
            setIsDownloaded(true);
            Alert.alert("Downloaded!", "You can now read this story without internet.");
        }
    }
  };

  const toggleTheme = () => {
    const modes: any[] = ["light", "sepia", "solarized", "dark", "oled"];
    const nextIndex = (modes.indexOf(themeMode) + 1) % modes.length;
    setThemeMode(modes[nextIndex]);
  };

  const toggleFontSize = () => {
    const sizeOrder: ("small" | "medium" | "large")[] = ["small", "medium", "large"];
    const nextIndex = (sizeOrder.indexOf(fontSizeMode) + 1) % sizeOrder.length;
    saveFontSize(sizeOrder[nextIndex]);
  };

  const toggleSpeech = async () => {
    if (isSpeaking) {
        Speech.stop();
        setIsSpeaking(false);
    } else {
        setIsSpeaking(true);
        Speech.speak(story.body, {
            rate: speechRate,
            onDone: () => setIsSpeaking(false),
            onStopped: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
        });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.white, paddingTop: insets.top }]}>
        <StatusBar style={isDarkMode ? "light" : "dark"} />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingLeft: 20 }}>
            <ArrowLeft size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
        <View style={{ padding: Spacing.l }}>
          <View style={[styles.skeletonTitle, { backgroundColor: Colors.paleGreen }]} />
          <View style={[styles.skeletonMeta, { backgroundColor: Colors.paleGreen }]} />
          <View style={[styles.skeletonLine, { backgroundColor: Colors.paleGreen }]} />
          <View style={[styles.skeletonLine, { backgroundColor: Colors.paleGreen, width: '90%' }]} />
          <View style={[styles.skeletonLine, { backgroundColor: Colors.paleGreen, width: '95%' }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <View style={[styles.topBar, { backgroundColor: theme.white, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft size={24} color={theme.black} /></TouchableOpacity>
          <View style={styles.topBarIcons}>
            <TouchableOpacity onPress={toggleAutoScroll} style={styles.iconBtn}>
                <MousePointer2 size={20} color={isAutoScrolling ? Colors.accent : theme.black} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDownload} style={styles.iconBtn}>
                {isDownloaded ? <Trash size={20} color={theme.primary} /> : <Download size={20} color={theme.black} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSpeech} style={styles.iconBtn}>
                {isSpeaking ? <Square size={20} color={Colors.error} /> : <Volume2 size={20} color={theme.black} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleFontSize} style={styles.iconBtn}><Type size={20} color={theme.black} /></TouchableOpacity>
            <TouchableOpacity onPress={handleBookmark} style={styles.iconBtn}>
              <Bookmark size={20} color={isBookmarked ? Colors.accent : theme.black} fill={isBookmarked ? Colors.accent : "none"} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.progressContainer}>
          <Animated.View style={[
            styles.progressBar, 
            { 
              width: progressBarWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%']
              }), 
              backgroundColor: theme.primary 
            }
          ]} />
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        showsVerticalScrollIndicator={false} 
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          contentHeight.current = contentSize.height;
          scrollY.current = contentOffset.y;
          const totalHeight = contentSize.height - layoutMeasurement.height;
          setScrollProgress(totalHeight > 0 ? contentOffset.y / totalHeight : 0);
        }} 
        scrollEventThrottle={16}
        onScrollBeginDrag={stopAutoScroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={styles.header}>
          <Text style={[styles.genre, { color: theme.primary, fontFamily: fonts.body }]}>{story.genre}</Text>
          <Text style={[styles.title, { color: theme.black, fontFamily: fonts.heading }]}>{story.title}</Text>
          <View style={styles.authorRow}>
            <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: theme.black, fontFamily: fonts.heading }]}>{story.authorName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[styles.authorName, { color: theme.black, fontFamily: fonts.body }]}>{story.authorName}</Text>
              <Text style={[styles.readTime, { color: Colors.mutedTeal, fontFamily: fonts.body }]}>{story.readingTime} min read</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.bodyContainer}>
          <Text style={[
            styles.bodyText, 
            { 
              color: theme.black, 
              fontFamily: fonts.body,
              fontSize, 
              lineHeight: fontSize * 1.75,
              letterSpacing: 0.2
            }
          ]}>
            {story.body}
          </Text>
        </View>
        
        <View style={styles.endOfStory}>
          <View style={[styles.endDot, { backgroundColor: theme.primary + '40' }]} />
          <Text style={[styles.endText, { color: Colors.mutedTeal, fontFamily: fonts.heading }]}>End of Story</Text>
          <View style={[styles.endDot, { backgroundColor: theme.primary + '40' }]} />
        </View>
      </ScrollView>

      {/* Feature 25: Content Warning Modal */}
      <Modal visible={showWarning} animationType="fade" transparent>
          <View style={styles.warningOverlay}>
              <View style={[styles.warningContent, { backgroundColor: theme.white }]}>
                  <AlertTriangle size={48} color={Colors.error} style={{ marginBottom: 20 }} />
                  <Text style={[styles.warningTitle, { color: theme.black, fontFamily: fonts.heading }]}>CONTENT ADVISORY</Text>
                  <Text style={[styles.warningText, { color: theme.black, fontFamily: fonts.body }]}>
                      This story contains themes that some readers may find sensitive:{"\n\n"}
                      <Text style={{ fontWeight: 'bold', color: Colors.error }}>
                          {story?.contentWarnings || "General adult themes"}
                      </Text>
                  </Text>
                  <TouchableOpacity 
                    style={[styles.warningBtn, { backgroundColor: theme.primary }]} 
                    onPress={() => setShowWarning(false)}
                  >
                      <Text style={[styles.warningBtnText, { fontFamily: fonts.heading }]}>I UNDERSTAND</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                      <Text style={[styles.backLink, { fontFamily: fonts.body }]}>Go Back</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      {/* Feature 15: Notes Overlay */}
      <Modal visible={showNotes} animationType="slide" transparent>
        <View style={[styles.notesModal, { backgroundColor: theme.white, paddingTop: insets.top + 20 }]}>
            <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <StickyNote size={20} color={theme.primary} style={{ marginRight: 10 }} />
                    <Text style={[styles.modalTitle, { color: theme.black, fontFamily: fonts.heading }]}>READING NOTES</Text>
                </View>
                <TouchableOpacity onPress={() => setShowNotes(false)}><X size={24} color={theme.black} /></TouchableOpacity>
            </View>
            
            <ScrollView style={styles.notesList}>
                <View style={styles.addNoteSection}>
                    <TextInput 
                        style={[styles.noteInput, { color: theme.black, fontFamily: fonts.body, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} 
                        placeholder="Write a thought..." 
                        placeholderTextColor={Colors.mutedTeal}
                        value={newNote}
                        onChangeText={setNewNote}
                        multiline
                    />
                    <TouchableOpacity style={[styles.addNoteBtn, { backgroundColor: theme.primary }]} onPress={handleSaveNote}>
                        <Plus size={20} color={theme.white} />
                    </TouchableOpacity>
                </View>

                {notesLoading ? <ActivityIndicator color={theme.primary} /> : (
                    notes.map(n => (
                        <View key={n.id} style={[styles.noteItem, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                            <Text style={[styles.noteText, { color: theme.black, fontFamily: fonts.body }]}>{n.content}</Text>
                            <View style={styles.noteFooter}>
                                <Text style={styles.noteDate}>{new Date(n.createdAt).toLocaleDateString()}</Text>
                                <TouchableOpacity onPress={() => deleteNote(n.id)}><Trash size={16} color={Colors.error} /></TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
      </Modal>

      {showComments && (
        <View style={[styles.commentsOverlay, { backgroundColor: theme.white, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
          >
            <View style={styles.commentsHeader}>
              <Text style={[styles.commentsTitle, { color: theme.black, fontFamily: fonts.heading }]}>Discussion ({comments.length})</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}><Text style={[styles.closeComments, { color: theme.black, fontFamily: fonts.body }]}>Close</Text></TouchableOpacity>
            </View>
            
            <ScrollView style={{ flex: 1 }}>
              {commentsLoading ? <ActivityIndicator color={theme.primary} /> : (
                comments.map(c => (
                  <View key={c.id} style={[styles.commentItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                    <Text style={[styles.commentUser, { color: theme.black, fontFamily: fonts.heading }]}>{c?.user?.username || "Story Reader"}</Text>
                    <Text style={[styles.commentText, { color: theme.black, opacity: 0.8, fontFamily: fonts.body }]}>{c?.content}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[styles.commentInputRow, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <TextInput 
                style={[styles.commentInput, { color: theme.black, fontFamily: fonts.body }, Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })]} 
                placeholder="Share your thoughts..." 
                placeholderTextColor={isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} 
                value={newComment} 
                onChangeText={setNewComment}
                multiline
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity onPress={handlePostComment} style={styles.sendBtn}>
                <Send size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      <View style={[styles.bottomBar, { backgroundColor: theme.white, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bottomBarContent}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Heart size={22} color={isLiked ? "red" : theme.black} fill={isLiked ? "red" : "none"} />
            </Animated.View>
            <Text style={[styles.actionCount, { color: theme.black, fontFamily: fonts.body }]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowComments(!showComments)} style={styles.actionBtn}>
            <MessageSquare size={22} color={theme.black} />
            <Text style={[styles.actionCount, { color: theme.black, fontFamily: fonts.body }]}>{story?._count?.comments || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowNotes(true)} style={styles.actionBtn}>
            <StickyNote size={22} color={theme.black} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} style={styles.actionBtn}>
            {isDarkMode ? <Sun size={22} color={theme.black} /> : <Moon size={22} color={theme.black} />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { borderBottomWidth: 1 },
  topBarContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  topBarIcons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { marginLeft: 20 },
  progressContainer: { height: 2, backgroundColor: 'transparent', width: "100%" },
  progressBar: { height: "100%" },
  content: { flex: 1 },
  header: { paddingHorizontal: 24, marginTop: 40, marginBottom: 40 },
  genre: { fontSize: 13, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.1, fontWeight: "700" },
  title: { fontSize: 36, lineHeight: 42, marginBottom: 24 },
  authorRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14 },
  avatarText: { fontSize: 14 },
  authorName: { fontSize: 16, fontWeight: "600" },
  readTime: { fontSize: 13, marginTop: 2 },
  bodyContainer: { paddingHorizontal: 24, marginBottom: 60 },
  bodyText: {},
  endOfStory: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 150 },
  endDot: { width: 4, height: 4, borderRadius: 2, marginHorizontal: 12 },
  endText: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.2 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingTop: 16 },
  bottomBarContent: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingHorizontal: 20 },
  actionBtn: { flexDirection: "row", alignItems: "center", padding: 8 },
  actionCount: { fontSize: 13, marginLeft: 8, fontWeight: "500" },
  commentsOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, paddingHorizontal: 24, zIndex: 100 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  commentsTitle: { fontSize: 20 },
  closeComments: { fontSize: 14 },
  commentItem: { marginBottom: 20, borderBottomWidth: 1, paddingBottom: 16 },
  commentUser: { fontSize: 15, marginBottom: 6 },
  commentText: { fontSize: 15, lineHeight: 22 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, minHeight: 56, maxHeight: 120 },
  commentInput: { flex: 1, fontSize: 16, paddingVertical: 12 },
  sendBtn: { marginLeft: 12, padding: 4 },
  notesModal: { flex: 1, paddingHorizontal: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, letterSpacing: 1 },
  notesList: { flex: 1 },
  addNoteSection: { flexDirection: 'row', marginBottom: 24, alignItems: 'flex-end' },
  noteInput: { flex: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 50, maxHeight: 100 },
  addNoteBtn: { width: 50, height: 50, borderRadius: 12, marginLeft: 12, justifyContent: 'center', alignItems: 'center' },
  noteItem: { padding: 16, borderRadius: 16, marginBottom: 16 },
  noteText: { fontSize: 14, lineHeight: 22 },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  noteDate: { fontSize: 10, color: Colors.mutedTeal },
  warningOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  warningContent: { width: '100%', borderRadius: 32, padding: 32, alignItems: 'center' },
  warningTitle: { fontSize: 20, letterSpacing: 2, marginBottom: 16 },
  warningText: { fontSize: 15, lineHeight: 24, textAlign: 'center', marginBottom: 40 },
  warningBtn: { paddingVertical: 18, paddingHorizontal: 40, borderRadius: 30, width: '100%', alignItems: 'center' },
  warningBtnText: { color: Colors.white, fontSize: 14, letterSpacing: 1 },
  backLink: { fontSize: 14, color: Colors.mutedTeal },
  skeletonTitle: { height: 40, width: '80%', borderRadius: 8, marginBottom: 20 },
  skeletonMeta: { height: 20, width: '40%', borderRadius: 4, marginBottom: 40 },
  skeletonLine: { height: 16, width: '100%', borderRadius: 4, marginBottom: 12 },
});
