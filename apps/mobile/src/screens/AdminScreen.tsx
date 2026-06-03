import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, Platform, Modal, TextInput, RefreshControl, Dimensions, KeyboardAvoidingView } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Trash2, Edit2, ArrowLeft, Camera, ChevronDown, Plus, X, FolderPlus, Zap, Bold, Italic, Heading, Quote, List, Eye, Edit3, Globe, Sparkles, Wand2, History, RotateCcw, UserPlus, Users, FileText, BarChart3, RefreshCw, Image as ImageIcon } from "lucide-react-native";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { SkeletonCard } from "../components/SkeletonCard";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import axios from "axios";

const { width } = Dimensions.get("window");
const PEXELS_API_KEY = process.env.EXPO_PUBLIC_PEXELS_API_KEY;

export const AdminScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme, isDarkMode } = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [stories, setStories] = useState<any[]>([]);
  const [stats, setStats] = useState({ storyCount: 0, totalReads: 0, userCount: 0 });
  
  // Editor State
  const [availableGenres, setAvailableGenres] = useState(["Fiction", "Romance", "Thriller", "Faith", "Mystery", "Poetry", "Sci-Fi"]);
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Version History & Collaboration
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabUsername, setCollabUsername] = useState("");
  const [collabLoading, setCollabLoading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Fiction");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [fetchingPexels, setFetchingPexels] = useState(false);

  useEffect(() => {
    fetchAdminData();
    loadUniqueGenres();
  }, []);

  const loadUniqueGenres = async () => {
    try {
        const res = await apiClient.get("/stories");
        const unique = [...new Set([...availableGenres, ...res.data.map((s: any) => s.genre)])];
        setAvailableGenres(unique);
    } catch (e) {}
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [storiesRes, statsRes] = await Promise.all([
        apiClient.get("/admin/my-stories"),
        apiClient.get("/admin/stats")
      ]);
      setStories(storiesRes.data);
      setStats(statsRes.data);
    } catch (error) { console.log("Error fetching admin data:", error); }
    finally { 
        setLoading(false); 
        setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAdminData();
    loadUniqueGenres();
  }, []);

  const handleFetchPexelsCover = async () => {
    const query = title.trim() || genre;
    if (!query) return;
    
    setFetchingPexels(true);
    try {
        const res = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query + " cinematic book cover")}&per_page=1&orientation=portrait`, {
            headers: { Authorization: PEXELS_API_KEY }
        });
        if (res.data.photos?.length > 0) {
            setImage(res.data.photos[0].src.large2x);
        } else {
            // Fallback search with just genre
            const fallback = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(genre + " aesthetic")}&per_page=1&orientation=portrait`, {
                headers: { Authorization: PEXELS_API_KEY }
            });
            if (fallback.data.photos?.length > 0) {
                setImage(fallback.data.photos[0].src.large2x);
            }
        }
    } catch (e) {
        console.log("[Pexels] Fetch failed", e);
        Alert.alert("Cover error", "Could not fetch automated cover from Pexels.");
    } finally {
        setFetchingPexels(false);
    }
  };

  const handleSave = async () => {
    if (!title || !genre || !authorName) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    setSubmitLoading(true);
    try {
      const payload: any = { title, genre, authorName, summary: "" };
      if (image) payload.coverUrl = image;
      if (body) payload.body = body;

      if (isEditing && editingId) {
        await apiClient.put(`/stories/${editingId}`, payload);
      } else {
        await apiClient.post("/stories", payload);
      }
      
      Alert.alert("Success", `Story ${isEditing ? 'updated' : 'published'} successfully!`);
      setIsAdding(false);
      setIsEditing(false);
      resetForm();
      fetchAdminData();
    } catch (error: any) {
      Alert.alert("Error", "Action failed. Please check your connection.");
    } finally { setSubmitLoading(false); }
  };

  const startEdit = (story: any) => {
    setTitle(story.title);
    setGenre(story.genre);
    setAuthorName(story.authorName);
    setImage(story.coverUrl);
    setEditingId(story.id);
    setIsEditing(true);
    setIsAdding(true);
  };

  const resetForm = () => {
    setTitle(""); setGenre("Fiction"); setBody(""); setAuthorName(""); setImage(null); setEditingId(null); setIsEditing(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Story", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try { await apiClient.delete(`/stories/${id}`); fetchAdminData(); } catch (e) { Alert.alert("Error", "Failed to delete."); }
      }}
    ]);
  };

  const handleAiAssist = async (type: "continue" | "twist") => {
      if (!body.trim()) return;
      setAiLoading(true);
      try {
          const res = await apiClient.post("/ai/assist", { text: body, type });
          if (type === "continue") setBody(prev => prev + "\n\n" + res.data.result);
          else Alert.alert("AI Plot Twist", res.data.result);
      } catch (e) { Alert.alert("AI Error", "Failed to get AI assistance."); }
      finally { setAiLoading(false); }
  };

  if (isAdding) {
    return (
      <View style={[styles.container, { backgroundColor: theme.white }]}>
        <StatusBar style="light" />
        <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
          <TouchableOpacity onPress={() => { setIsAdding(false); resetForm(); }} style={[styles.backBtnHeader, { top: insets.top + 20 }]}>
            <ArrowLeft size={24} color={Colors.accent} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>{isEditing ? 'EDIT STORY' : 'NEW STORY'}</Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
                <View style={styles.imageContainer}>
                    <View style={[styles.imagePicker, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.mutedTeal }]}>
                        {image ? <Image source={{ uri: image }} style={styles.previewImage} resizeMode="cover" /> : (
                        <View style={styles.imagePlaceholder}>
                            <ImageIcon size={40} color={Colors.mutedTeal} />
                            <Text style={[styles.imagePlaceholderText, { fontFamily: fonts.body }]}>Pexels Automated Cover</Text>
                        </View>
                        )}
                        {fetchingPexels && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center' }]}><ActivityIndicator color={Colors.accent} /></View>}
                    </View>
                    <TouchableOpacity style={[styles.aiGenBtn, { backgroundColor: theme.primary }]} onPress={handleFetchPexelsCover}>
                        <RefreshCw size={18} color={theme.white} />
                    </TouchableOpacity>
                </View>
                
                <TextField label="Story Title" value={title} onChangeText={setTitle} placeholder="Enter title" onBlur={() => { if (!image) handleFetchPexelsCover(); }} />
                <TextField label="Author Name" value={authorName} onChangeText={setAuthorName} placeholder="Author name" />
                
                <Text style={[styles.dropdownLabel, { color: theme.primary, fontFamily: fonts.heading }]}>GENRE</Text>
                <TouchableOpacity style={[styles.dropdown, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.lightForest }]} onPress={() => setShowGenreDropdown(!showGenreDropdown)}>
                    <Text style={[styles.dropdownText, { color: theme.black, fontFamily: fonts.body }]}>{genre}</Text>
                    <ChevronDown size={20} color={theme.primary} />
                </TouchableOpacity>
                
                {showGenreDropdown && (
                    <View style={[styles.dropdownMenu, { backgroundColor: isDarkMode ? "#1a2e2c" : Colors.white, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}>
                    {availableGenres.map((g) => (
                        <TouchableOpacity key={g} style={styles.dropdownItem} onPress={() => { setGenre(g); setShowGenreDropdown(false); handleFetchPexelsCover(); }}>
                        <Text style={[styles.dropdownItemText, { color: theme.black, fontFamily: fonts.body }, g === genre && { color: Colors.accent, fontWeight: "700" }]}>{g}</Text>
                        </TouchableOpacity>
                    ))}
                    </View>
                )}

                {!isEditing && (
                    <TextField label="First Chapter Content" value={body} onChangeText={setBody} placeholder="Once upon a time..." multiline style={{ height: 200, textAlignVertical: "top", marginTop: 20 }} />
                )}

            {submitLoading ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: 20 }} /> : (
                <View style={{ marginTop: 20, marginBottom: 40 }}>
                <Button title={isEditing ? "UPDATE STORY" : "PUBLISH TO NEST"} onPress={handleSave} type="primary" />
                <Button title="CANCEL" onPress={() => { setIsAdding(false); resetForm(); }} type="ghost" style={{ marginTop: 12 }} />
                </View>
            )}
            </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtnHeader, { top: insets.top + 20 }]}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>CREATOR HUB</Text>
        <TouchableOpacity onPress={() => navigation.navigate("AuthorAnalytics")} style={styles.analyticsBtn}>
            <BarChart3 size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
            <Text style={[styles.statValue, { color: theme.primary, fontFamily: fonts.heading }]}>{stats.storyCount}</Text>
            <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>Stories</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
            <Text style={[styles.statValue, { color: theme.primary, fontFamily: fonts.heading }]}>{stats.totalReads}</Text>
            <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>Reads</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
            <Text style={[styles.statValue, { color: theme.primary, fontFamily: fonts.heading }]}>{stats.userCount}</Text>
            <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>Users</Text>
          </View>
        </View>

        <View style={styles.actionSection}>
          <Button title="UPLOAD NEW STORY" onPress={() => setIsAdding(true)} type="primary" style={{ marginBottom: 24 }} />
          <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>PUBLISHED WORKS</Text>
          <View style={{ paddingBottom: insets.bottom + 40 }}>
            {loading && !refreshing ? [1, 2, 3].map(i => <SkeletonCard key={i} />) : (
              stories.map((story) => (
                <View key={story.id} style={[styles.storyRow, { borderBottomColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
                  <View style={styles.storyInfo}>
                    <Text style={[styles.storyTitle, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{story.title}</Text>
                    <Text style={[styles.storyMeta, { fontFamily: fonts.body }]}>{story.genre}</Text>
                  </View>
                  <View style={styles.storyActions}>
                    <TouchableOpacity onPress={() => navigation.navigate("ManageChapters", { storyId: story.id, storyTitle: story.title })} style={styles.actionBtn}><FileText size={18} color={theme.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => startEdit(story)} style={styles.actionBtn}><Edit2 size={18} color={theme.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(story.id)} style={styles.actionBtn}><Trash2 size={18} color="red" /></TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            {!loading && stories.length === 0 && <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No stories published yet.</Text>}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingBottom: 24, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, color: Colors.accent, textAlign: "center", marginTop: 10, letterSpacing: 0.05 },
  backBtnHeader: { position: "absolute", left: 24 },
  analyticsBtn: { position: 'absolute', right: 24, top: 45 },
  content: { padding: 24 },
  imageContainer: { width: '100%', marginBottom: 24, position: 'relative' },
  imagePicker: { width: "100%", aspectRatio: 1.5, borderRadius: 16, overflow: "hidden", justifyContent: "center", alignItems: "center", borderBottomWidth: 2, borderBottomColor: Colors.accent },
  previewImage: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center" },
  imagePlaceholderText: { fontSize: 12, color: Colors.mutedTeal, marginTop: 8 },
  aiGenBtn: { position: 'absolute', right: 12, bottom: 12, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', ...Shadows.m },
  dropdownLabel: { fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.05 },
  dropdown: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 8, marginBottom: 20, borderWidth: 0.5 },
  dropdownText: { fontSize: 14 },
  dropdownMenu: { borderRadius: 8, borderWidth: 1, marginTop: -15, marginBottom: 20, padding: 8, elevation: 4 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownItemText: { fontSize: 14 },
  statsGrid: { flexDirection: "row", paddingHorizontal: 24, paddingVertical: 20, justifyContent: "space-between" },
  statBox: { width: "31%", padding: 12, borderRadius: 12, alignItems: "center" },
  statValue: { fontSize: 18 },
  statLabel: { fontSize: 10, color: Colors.mutedTeal },
  actionSection: { flex: 1, paddingHorizontal: 24 },
  sectionTitle: { fontSize: 16, marginBottom: 16 },
  storyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1 },
  storyInfo: { flex: 1 },
  storyTitle: { fontSize: 14 },
  storyMeta: { fontSize: 12, color: Colors.mutedTeal },
  storyActions: { flexDirection: "row" },
  actionBtn: { marginLeft: 15, padding: 4 },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 24, padding: 24, ...Shadows.m },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 16, letterSpacing: 1 },
  modalInput: { height: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, marginBottom: 20, fontSize: 16 },
  versionItem: { flexDirection: 'row', padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)' },
  versionDate: { fontSize: 12, marginBottom: 4 },
  versionSnippet: { fontSize: 11, opacity: 0.7 },
  restoreBtn: { padding: 8, marginLeft: 12 }
});
