import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Animated, Keyboard, Alert, Dimensions } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Bookmark, Heart, MessageSquare, Moon, Sun, Type, Send, Share2, Volume2, Square, Download, Trash } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SkeletonCard } from "../components/SkeletonCard";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Speech from 'expo-speech';
import { OfflineManager } from "../utils/OfflineManager";

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

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);

  // Animations
  const likeScale = useRef(new Animated.Value(1)).current;
  const progressBarWidth = useRef(new Animated.Value(0)).current;

  const fontSize = FONT_SIZES[fontSizeMode];

  useEffect(() => {
    loadSavedSettings();
    fetchStory();
    return () => {
        Speech.stop();
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
      
      const isSaved = bookmarksRes.data.some((b: any) => b.storyId === storyId);
      setIsBookmarked(isSaved);
      
      await apiClient.post(`/stories/${storyId}/read`);
      await refreshUser();
    } catch (error) {
        // Fallback for offline mode if API fails
        const offlineStories = await OfflineManager.getDownloadedStories();
        const found = offlineStories.find(s => s.id === storyId);
        if (found) {
            setStory(found);
            setIsDownloaded(true);
        } else {
            console.log("Error fetching story:", error);
        }
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await apiClient.get(`/stories/${storyId}/comments`);
      setComments(res.data);
    } catch (error) { console.log(error); } 
    finally { setCommentsLoading(false); }
  };

  useEffect(() => {
    if (showComments) fetchComments();
  }, [showComments]);

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    try {
      const res = await apiClient.post(`/stories/${storyId}/comments`, { content: newComment });
      setComments([res.data, ...comments]);
      setNewComment("");
      Keyboard.dismiss();
    } catch (error) { console.log(error); }
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

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Reading "${story.title}" on StoryNest! Check it out.`,
        url: `https://storynest.app/read/${story.id}`,
      });
    } catch (error) { console.log(error); }
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
            <TouchableOpacity onPress={handleDownload} style={styles.iconBtn}>
                {isDownloaded ? <Trash size={20} color={theme.primary} /> : <Download size={20} color={theme.black} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSpeech} style={styles.iconBtn}>
                {isSpeaking ? <Square size={20} color={Colors.error} /> : <Volume2 size={20} color={theme.black} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleFontSize} style={styles.iconBtn}><Type size={20} color={theme.black} /></TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.iconBtn}><Share2 size={20} color={theme.black} /></TouchableOpacity>
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
        style={styles.content} 
        showsVerticalScrollIndicator={false} 
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          const totalHeight = contentSize.height - layoutMeasurement.height;
          setScrollProgress(totalHeight > 0 ? contentOffset.y / totalHeight : 0);
        }} 
        scrollEventThrottle={16}
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
  iconBtn: { marginLeft: 24 },
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
  skeletonTitle: { height: 40, width: '80%', borderRadius: 8, marginBottom: 20 },
  skeletonMeta: { height: 20, width: '40%', borderRadius: 4, marginBottom: 40 },
  skeletonLine: { height: 16, width: '100%', borderRadius: 4, marginBottom: 12 },
});
