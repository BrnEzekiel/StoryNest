import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Animated, Keyboard, Alert, Dimensions } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Bookmark, Heart, MessageSquare, Moon, Sun, Type, Send, Share2 } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SkeletonCard } from "../components/SkeletonCard";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const THEMES = {
  light: { bg: Colors.white, text: Colors.darkTextGreen, accent: Colors.primary, muted: Colors.mutedTeal, bar: "dark" as const },
  sepia: { bg: Colors.paleCream, text: Colors.darkTextCream, accent: Colors.primary, muted: "#8C7B6E", bar: "dark" as const },
  dark: { bg: Colors.primary, text: Colors.accent, accent: Colors.accent, muted: Colors.paleGreen, bar: "light" as const },
};

const FONT_SIZES = {
  small: 15,
  medium: 18,
  large: 22,
};

export const StoryReaderScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { storyId } = route.params;
  const { user, refreshUser } = useAuth();
  const { isDarkMode } = useTheme();
  
  const [story, setStory] = useState<any>(null);
  const [theme, setTheme] = useState<"light" | "sepia" | "dark">("light");
  const [fontSizeMode, setFontSizeMode] = useState<"small" | "medium" | "large">("medium");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Animations
  const likeScale = useRef(new Animated.Value(1)).current;
  const progressBarWidth = useRef(new Animated.Value(0)).current;

  const currentTheme = THEMES[theme];
  const fontSize = FONT_SIZES[fontSizeMode];

  useEffect(() => {
    loadSavedSettings();
    fetchStory();
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
      const savedTheme = await AsyncStorage.getItem("readerTheme");
      const savedFont = await AsyncStorage.getItem("readerFontSize");
      if (savedTheme && (savedTheme === "light" || savedTheme === "sepia" || savedTheme === "dark")) {
        setTheme(savedTheme);
      }
      if (savedFont) setFontSizeMode(savedFont as any);
    } catch (e) {}
  };

  const saveTheme = async (newTheme: "light" | "sepia" | "dark") => {
    setTheme(newTheme);
    await AsyncStorage.setItem("readerTheme", newTheme);
  };

  const saveFontSize = async (newSize: string) => {
    setFontSizeMode(newSize as any);
    await AsyncStorage.setItem("readerFontSize", newSize);
  };

  const fetchStory = async () => {
    try {
      setLoading(true);
      const [storyRes, bookmarksRes] = await Promise.all([
        apiClient.get(`/stories/${storyId}`),
        apiClient.get("/users/me/bookmarks")
      ]);
      
      setStory(storyRes.data);
      setLikeCount(storyRes.data._count?.likes || 0);
      setIsLiked(storyRes.data.isLiked);
      
      // Check if this story is already bookmarked
      const isSaved = bookmarksRes.data.some((b: any) => b.storyId === storyId);
      setIsBookmarked(isSaved);
      
      await apiClient.post(`/stories/${storyId}/read`);
      await refreshUser();
    } catch (error) {
      console.log("Error fetching story:", error);
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
      // progress: -1 means remove, 0 means add/save
      const progress = wasBookmarked ? -1 : Math.round(scrollProgress * 100);
      await apiClient.post(`/stories/${storyId}/bookmark`, { progress });
    } catch (error) {
      setIsBookmarked(wasBookmarked);
      Alert.alert("Error", "Failed to update your library.");
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
    const themeOrder: ("light" | "sepia" | "dark")[] = ["light", "sepia", "dark"];
    const nextIndex = (themeOrder.indexOf(theme) + 1) % themeOrder.length;
    saveTheme(themeOrder[nextIndex]);
  };

  const toggleFontSize = () => {
    const sizeOrder: ("small" | "medium" | "large")[] = ["small", "medium", "large"];
    const nextIndex = (sizeOrder.indexOf(fontSizeMode) + 1) % sizeOrder.length;
    saveFontSize(sizeOrder[nextIndex]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: THEMES.light.bg, paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingLeft: 20 }}>
            <ArrowLeft size={24} color={Colors.primary} />
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
    <View style={[styles.container, { backgroundColor: currentTheme.bg }]}>
      <StatusBar style={currentTheme.bar} />
      <View style={[styles.topBar, { backgroundColor: currentTheme.bg, borderBottomColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft size={24} color={currentTheme.text} /></TouchableOpacity>
          <View style={styles.topBarIcons}>
            <TouchableOpacity onPress={toggleFontSize} style={styles.iconBtn}><Type size={20} color={currentTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.iconBtn}><Share2 size={20} color={currentTheme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={handleBookmark} style={styles.iconBtn}>
              <Bookmark size={20} color={isBookmarked ? Colors.accent : currentTheme.text} fill={isBookmarked ? Colors.accent : "none"} />
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
              backgroundColor: theme === 'dark' ? Colors.accent : Colors.primary 
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
          <Text style={[styles.genre, { color: currentTheme.accent }]}>{story.genre}</Text>
          <Text style={[styles.title, { color: currentTheme.text }]}>{story.title}</Text>
          <View style={styles.authorRow}>
            <View style={[styles.avatar, { backgroundColor: currentTheme.muted + '20' }]}>
              <Text style={[styles.avatarText, { color: currentTheme.text }]}>{story.authorName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[styles.authorName, { color: currentTheme.text }]}>{story.authorName}</Text>
              <Text style={[styles.readTime, { color: currentTheme.muted }]}>{story.readingTime} min read</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.bodyContainer}>
          <Text style={[
            styles.bodyText, 
            { 
              color: currentTheme.text, 
              fontSize, 
              lineHeight: fontSize * 1.75,
              letterSpacing: 0.2
            }
          ]}>
            {story.body}
          </Text>
        </View>
        
        <View style={styles.endOfStory}>
          <View style={[styles.endDot, { backgroundColor: currentTheme.muted + '40' }]} />
          <Text style={[styles.endText, { color: currentTheme.muted }]}>End of Story</Text>
          <View style={[styles.endDot, { backgroundColor: currentTheme.muted + '40' }]} />
        </View>
      </ScrollView>

      {showComments && (
        <View style={[styles.commentsOverlay, { backgroundColor: currentTheme.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
          >
            <View style={styles.commentsHeader}>
              <Text style={[styles.commentsTitle, { color: currentTheme.text }]}>Discussion ({comments.length})</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}><Text style={[styles.closeComments, { color: currentTheme.text }]}>Close</Text></TouchableOpacity>
            </View>
            
            <ScrollView style={{ flex: 1 }}>
              {commentsLoading ? <ActivityIndicator color={currentTheme.accent} /> : (
                comments.map(c => (
                  <View key={c.id} style={[styles.commentItem, { borderBottomColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                    <Text style={[styles.commentUser, { color: currentTheme.text }]}>{c?.user?.username || "Story Reader"}</Text>
                    <Text style={[styles.commentText, { color: currentTheme.text, opacity: 0.8 }]}>{c?.content}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[styles.commentInputRow, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <TextInput 
                style={[styles.commentInput, { color: currentTheme.text }, Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })]} 
                placeholder="Share your thoughts..." 
                placeholderTextColor={currentTheme.text + '60'} 
                value={newComment} 
                onChangeText={setNewComment}
                multiline
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity onPress={handlePostComment} style={styles.sendBtn}>
                <Send size={20} color={currentTheme.accent} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      <View style={[styles.bottomBar, { backgroundColor: currentTheme.bg, borderTopColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bottomBarContent}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Heart size={22} color={isLiked ? "red" : currentTheme.text} fill={isLiked ? "red" : "none"} />
            </Animated.View>
            <Text style={[styles.actionCount, { color: currentTheme.text }]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowComments(!showComments)} style={styles.actionBtn}>
            <MessageSquare size={22} color={currentTheme.text} />
            <Text style={[styles.actionCount, { color: currentTheme.text }]}>{story?._count?.comments || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} style={styles.actionBtn}>
            {theme === "dark" ? <Sun size={22} color={currentTheme.text} /> : <Moon size={22} color={currentTheme.text} />}
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
  genre: { fontFamily: Fonts.body, fontSize: 13, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.1, fontWeight: "700" },
  title: { fontFamily: Fonts.heading, fontSize: 36, lineHeight: 42, marginBottom: 24 },
  authorRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14 },
  avatarText: { fontFamily: Fonts.heading, fontSize: 14 },
  authorName: { fontFamily: Fonts.body, fontSize: 16, fontWeight: "600" },
  readTime: { fontFamily: Fonts.body, fontSize: 13, marginTop: 2 },
  bodyContainer: { paddingHorizontal: 24, marginBottom: 60 },
  bodyText: { fontFamily: Fonts.body },
  endOfStory: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 150 },
  endDot: { width: 4, height: 4, borderRadius: 2, marginHorizontal: 12 },
  endText: { fontFamily: Fonts.heading, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.2 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingTop: 16 },
  bottomBarContent: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingHorizontal: 20 },
  actionBtn: { flexDirection: "row", alignItems: "center", padding: 8 },
  actionCount: { fontFamily: Fonts.body, fontSize: 13, marginLeft: 8, fontWeight: "500" },
  commentsOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, paddingHorizontal: 24, zIndex: 100 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  commentsTitle: { fontFamily: Fonts.heading, fontSize: 20 },
  closeComments: { fontFamily: Fonts.body, fontSize: 14 },
  commentItem: { marginBottom: 20, borderBottomWidth: 1, paddingBottom: 16 },
  commentUser: { fontFamily: Fonts.heading, fontSize: 15, marginBottom: 6 },
  commentText: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, minHeight: 56, maxHeight: 120 },
  commentInput: { flex: 1, fontFamily: Fonts.body, fontSize: 16, paddingVertical: 12 },
  sendBtn: { marginLeft: 12, padding: 4 },
  skeletonTitle: { height: 40, width: '80%', borderRadius: 8, marginBottom: 20 },
  skeletonMeta: { height: 20, width: '40%', borderRadius: 4, marginBottom: 40 },
  skeletonLine: { height: 16, width: '100%', borderRadius: 4, marginBottom: 12 },
});