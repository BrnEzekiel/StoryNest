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

  useEffect(() => {
    fetchAdminData();
  }, []);

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
  }, []);

  const fetchPexelsUrl = async (query: string, storyGenre: string) => {
    const key = PEXELS_API_KEY || "cKmC9mSkKyOKfmCA9PNqTm19LZthrh8xOJfXske5adPwhN4R5bpSrt0c";
    if (!key) {
        console.error("[Pexels] API Key is missing!");
        return null;
    }
    try {
        // Attempt 1: Title + cinematic
        const randomPage = Math.floor(Math.random() * 10) + 1;
        const res = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&page=${randomPage}&orientation=portrait`, {
            headers: { Authorization: key }
        });
        
        if (res.data.photos?.length > 0) {
            const randomIndex = Math.floor(Math.random() * res.data.photos.length);
            return res.data.photos[randomIndex].src.large2x;
        }
        
        // Attempt 2: Genre + aesthetic
        const fallback = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(storyGenre + " cinematic")}&per_page=10&orientation=portrait`, {
            headers: { Authorization: key }
        });
        if (fallback.data.photos?.length > 0) {
            const randomIndex = Math.floor(Math.random() * fallback.data.photos.length);
            return fallback.data.photos[randomIndex].src.large2x;
        }
        
        // Attempt 3: Pure Atmosphere
        const atmosphere = await axios.get(`https://api.pexels.com/v1/search?query=cinematic+atmosphere&per_page=15&orientation=portrait`, {
            headers: { Authorization: key }
        });
        if (atmosphere.data.photos?.length > 0) {
            const randomIndex = Math.floor(Math.random() * atmosphere.data.photos.length);
            return atmosphere.data.photos[randomIndex].src.large2x;
        }
        
        return null;
    } catch (e) {
        console.log("[Pexels] Fetch failed:", (e as any).message);
        return null;
    }
  };

  const handleSave = async () => {
    if (!title || !genre || !authorName) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    setSubmitLoading(true);
    try {
      // SILENTLY FETCH UNIQUE COVER FROM PEXELS
      let coverUrl = await fetchPexelsUrl(title, genre);
      
      const payload: any = { 
        title, 
        genre, 
        authorName, 
        summary: "",
        coverUrl: coverUrl
      };
      if (body) payload.body = body;

      if (isEditing && editingId) {
        // If editing and no new cover was fetched (failed), keep old one if exists
        const currentStory = stories.find(s => s.id === editingId);
        if (!payload.coverUrl && currentStory?.coverUrl) {
            payload.coverUrl = currentStory.coverUrl;
        }
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
      console.error("[Admin] Save Error:", error.response?.data || error.message);
      Alert.alert("Error", "Action failed. Check your connection.");
    } finally { setSubmitLoading(false); }
  };

  const startEdit = (story: any) => {
    setTitle(story.title);
    setGenre(story.genre);
    setAuthorName(story.authorName);
    setEditingId(story.id);
    setIsEditing(true);
    setIsAdding(true);
  };

  const resetForm = () => {
    setTitle(""); setGenre("Fiction"); setBody(""); setAuthorName(""); setEditingId(null); setIsEditing(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Story", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try { await apiClient.delete(`/stories/${id}`); fetchAdminData(); } catch (e) { Alert.alert("Error", "Failed to delete."); }
      }}
    ]);
  };

  const fetchVersions = async (storyId: string) => {
      setVersionsLoading(true);
      setShowVersionHistory(true);
      try {
          const res = await apiClient.get(`/stories/${storyId}/versions`);
          setVersions(res.data);
          setEditingId(storyId);
      } catch (e) { console.log(e); }
      finally { setVersionsLoading(false); }
  };

  const handleRestoreVersion = async (version: any) => {
      try {
          await apiClient.post(`/versions/${version.id}/restore`);
          Alert.alert("Restored", "Content reverted.");
          setShowVersionHistory(false);
          fetchAdminData();
      } catch (e) { Alert.alert("Error", "Failed."); }
  };

  const handleAddCollaborator = async () => {
      if (!collabUsername.trim()) return;
      setCollabLoading(true);
      try {
          await apiClient.post(`/stories/${editingId}/collaborators`, { username: collabUsername });
          Alert.alert("Added", `${collabUsername} is now a co-author.`);
          setCollabUsername("");
          setShowCollabModal(false);
          fetchAdminData();
      } catch (e) { Alert.alert("Error", "Failed."); }
      finally { setCollabLoading(false); }
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
                <TextField label="Story Title" value={title} onChangeText={setTitle} placeholder="Enter title" />
                <TextField label="Author Name" value={authorName} onChangeText={setAuthorName} placeholder="Author name" />
                
                <Text style={[styles.dropdownLabel, { color: theme.primary, fontFamily: fonts.heading, marginTop: 10 }]}>GENRE</Text>
                <TouchableOpacity style={[styles.dropdown, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.lightForest }]} onPress={() => setShowGenreDropdown(!showGenreDropdown)}>
                    <Text style={[styles.dropdownText, { color: theme.black, fontFamily: fonts.body }]}>{genre}</Text>
                    <ChevronDown size={20} color={theme.primary} />
                </TouchableOpacity>
                
                {showGenreDropdown && (
                    <View style={[styles.dropdownMenu, { backgroundColor: isDarkMode ? "#1a2e2c" : Colors.white, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}>
                    {availableGenres.map((g) => (
                        <TouchableOpacity key={g} style={styles.dropdownItem} onPress={() => { setGenre(g); setShowGenreDropdown(false); }}>
                        <Text style={[styles.dropdownItemText, { color: theme.black, fontFamily: fonts.body }, g === genre && { color: Colors.accent, fontWeight: "700" }]}>{g}</Text>
                        </TouchableOpacity>
                    ))}
                    </View>
                )}

                {!isEditing && (
                    <TextField label="First Chapter Content" value={body} onChangeText={setBody} placeholder="Once upon a time..." multiline style={{ height: 250, textAlignVertical: "top", marginTop: 20 }} />
                )}

            {submitLoading ? (
                <View style={{ marginVertical: 30, alignItems: 'center' }}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                    <Text style={{ marginTop: 12, fontFamily: fonts.body, color: theme.primary }}>Optimizing & Publishing...</Text>
                </View>
            ) : (
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

      <Modal visible={showVersionHistory} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
              <View style={[styles.modalContent, { backgroundColor: theme.white, maxHeight: '80%' }]}>
                  <View style={styles.modalHeader}><Text style={[styles.modalTitle, { fontFamily: fonts.heading, color: theme.black }]}>VERSION HISTORY</Text><TouchableOpacity onPress={() => setShowVersionHistory(false)}><X size={20} color={theme.black} /></TouchableOpacity></View>
                  <ScrollView style={{ marginTop: 20 }}>{versions.map(v => (<View key={v.id} style={styles.versionItem}><View style={{ flex: 1 }}><Text style={styles.versionDate}>{new Date(v.createdAt).toLocaleString()}</Text><Text style={styles.versionSnippet} numberOfLines={2}>{v.body}</Text></View><TouchableOpacity style={styles.restoreBtn} onPress={() => handleRestoreVersion(v)}><RotateCcw size={18} color={theme.primary} /></TouchableOpacity></View>))}</ScrollView>
              </View>
          </View>
      </Modal>

      <Modal visible={showCollabModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
                  <View style={styles.modalHeader}><Text style={[styles.modalTitle, { fontFamily: fonts.heading, color: theme.black }]}>ADD CO-AUTHOR</Text><TouchableOpacity onPress={() => setShowCollabModal(false)}><X size={20} color={theme.black} /></TouchableOpacity></View>
                  <TextInput style={styles.modalInput} placeholder="Username" placeholderTextColor={Colors.mutedTeal} value={collabUsername} onChangeText={setCollabUsername} autoCapitalize="none" />
                  <Button title={collabLoading ? "ADDING..." : "INVITE"} onPress={handleAddCollaborator} disabled={collabLoading} type="primary" style={{ backgroundColor: theme.primary }} />
              </View>
          </View>
      </Modal>
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
