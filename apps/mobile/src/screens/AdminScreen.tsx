import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, Platform, Modal, TextInput, RefreshControl, Dimensions, KeyboardAvoidingView } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Trash2, Edit2, ArrowLeft, Camera, ChevronDown, Plus, X, FolderPlus, Zap, Bold, Italic, Heading, Quote, List, Eye, Edit3, Globe, Sparkles, Wand2, History, RotateCcw, UserPlus, Users, FileText, BarChart3 } from "lucide-react-native";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { SkeletonCard } from "../components/SkeletonCard";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const { width } = Dimensions.get("window");

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
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");

  // Genre management
  const [availableGenres, setAvailableGenres] = useState(["Fiction", "Romance", "Thriller", "Faith", "Mystery", "Poetry", "Sci-Fi"]);
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showAddGenreModal, setShowGenreModal] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Feature 30: AI Cover Studio
  const [showCoverStudio, setShowCoverStudio] = useState(false);
  const [coverPrompt, setCoverPrompt] = useState("");
  const [generatingCover, setGeneratingCover] = useState(false);

  // Feature 31: Version History
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Feature 32: Collaboration
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabUsername, setCollabUsername] = useState("");
  const [collabLoading, setCollabLoading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Fiction");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [image, setImage] = useState<string | null>(null);

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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handleGenerateCover = async () => {
      if (!coverPrompt.trim()) return;
      setGeneratingCover(true);
      try {
          const encoded = encodeURIComponent(coverPrompt + " digital art book cover high resolution 4k style");
          const url = `https://image.pollinations.ai/prompt/${encoded}?width=600&height=800&nologo=true`;
          setImage(url);
          setShowCoverStudio(false);
          setCoverPrompt("");
      } catch (e) {
          Alert.alert("Generation Failed", "Could not generate cover. Try a different prompt.");
      } finally {
          setGeneratingCover(false);
      }
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
      Alert.alert("Restore Version", "This will replace the current story content. Continue?", [
          { text: "Cancel", style: "cancel" },
          { text: "Restore", onPress: async () => {
              try {
                  await apiClient.post(`/versions/${version.id}/restore`);
                  Alert.alert("Restored", "Story content has been reverted.");
                  setShowVersionHistory(false);
                  fetchAdminData();
              } catch (e) { Alert.alert("Error", "Restoration failed."); }
          }}
      ]);
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
      } catch (e) { Alert.alert("Error", "User not found or already a co-author."); }
      finally { setCollabLoading(false); }
  };

  const handleSave = async () => {
    if (!title || !genre || !authorName) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    setSubmitLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("genre", genre);
      formData.append("authorName", authorName);

      if (image) {
          if (image.startsWith('http')) {
              formData.append("coverUrl", image);
          } else {
              const filename = image.split("/").pop() || "cover.jpg";
              const match = /\.(\w+)$/.exec(filename);
              const type = match ? `image/${match[1]}` : `image/jpeg`;
              const name = filename.includes(".") ? filename : `${filename}.jpg`;
              
              formData.append("cover", { 
                uri: image,
                name,
                type 
              } as any);
          }
      }

      if (isEditing && editingId) {
        await apiClient.put(`/stories/${editingId}`, formData);
      } else {
        if (body) formData.append("body", body);
        await apiClient.post("/stories", formData);
      }
      
      Alert.alert("Success", `Story ${isEditing ? 'updated' : 'uploaded'} successfully!`);
      setIsAdding(false);
      setIsEditing(false);
      resetForm();
      fetchAdminData();
    } catch (error: any) {
      Alert.alert("Error", "Action failed. Please try again.");
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

  const insertMarkdown = (prefix: string, suffix = "") => {
      setBody(prev => prev + prefix + suffix);
  };

  const handleAiAssist = async (type: "continue" | "twist") => {
      if (!body.trim()) {
          Alert.alert("Input needed", "Write some text first so the AI can understand your story's context.");
          return;
      }
      setAiLoading(true);
      try {
          const res = await apiClient.post("/ai/assist", { text: body, type });
          if (type === "continue") {
              setBody(prev => prev + "\n\n" + res.data.result);
          } else {
              Alert.alert("AI Plot Twist", res.data.result);
          }
      } catch (e) {
          Alert.alert("AI Error", "Failed to get AI assistance. Check your connection.");
      } finally {
          setAiLoading(false);
      }
  };

  if (isAdding) {
    return (
      <View style={[styles.container, { backgroundColor: theme.white }]}>
        <StatusBar style="light" />
        <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
          <TouchableOpacity onPress={() => { setIsAdding(false); resetForm(); }} style={[styles.backBtnHeader, { top: insets.top + 20 }]}>
            <ArrowLeft size={24} color={Colors.accent} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>{isEditing ? 'EDIT STORY' : 'UPLOAD'}</Text>
        </View>

        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
        >
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
                <View style={styles.imageContainer}>
                    <TouchableOpacity style={[styles.imagePicker, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.mutedTeal }]} onPress={pickImage}>
                        {image ? <Image source={{ uri: image }} style={styles.previewImage} /> : (
                        <View style={styles.imagePlaceholder}>
                            <Camera size={32} color={Colors.mutedTeal} />
                            <Text style={[styles.imagePlaceholderText, { fontFamily: fonts.body }]}>Upload Cover Image</Text>
                        </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.aiGenBtn, { backgroundColor: theme.primary }]} onPress={() => setShowCoverStudio(true)}>
                        <Wand2 size={16} color={theme.white} />
                    </TouchableOpacity>
                </View>
                
                <TextField label="Story Title" value={title} onChangeText={setTitle} placeholder="Enter title" />
                <TextField label="Author Name" value={authorName} onChangeText={setAuthorName} placeholder="Author name" />
                
                <Text style={[styles.dropdownLabel, { color: theme.primary, fontFamily: fonts.heading }]}>GENRE</Text>
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
                    <>
                    <View style={styles.richToolbar}>
                        <TouchableOpacity style={styles.toolBtn} onPress={() => insertMarkdown("**", "**")}><Bold size={18} color={theme.black} /></TouchableOpacity>
                        <TouchableOpacity style={styles.toolBtn} onPress={() => insertMarkdown("*", "*")}><Italic size={18} color={theme.black} /></TouchableOpacity>
                        <TouchableOpacity style={styles.toolBtn} onPress={() => insertMarkdown("# ")}><Heading size={18} color={theme.black} /></TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity style={[styles.toolBtn, { backgroundColor: theme.primary + '10' }]} onPress={() => handleAiAssist("continue")} disabled={aiLoading}>
                            {aiLoading ? <ActivityIndicator size="small" color={Colors.accent} /> : <Sparkles size={18} color={Colors.accent} />}
                        </TouchableOpacity>
                    </View>
                    <TextField label="Initial Content (First Chapter)" value={body} onChangeText={setBody} placeholder="Once upon a time..." multiline style={{ height: 200, textAlignVertical: "top" }} />
                    </>
                )}

            {submitLoading ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: 20 }} /> : (
                <View style={{ marginBottom: 40 }}>
                <Button title={isEditing ? "UPDATE METADATA" : "PUBLISH STORY"} onPress={handleSave} type="primary" />
                <Button title="CANCEL" onPress={() => { setIsAdding(false); resetForm(); }} type="ghost" style={{ marginTop: 12 }} />
                </View>
            )}
            </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={showCoverStudio} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { fontFamily: fonts.heading, color: theme.black }]}>AI COVER STUDIO</Text>
                        <TouchableOpacity onPress={() => setShowCoverStudio(false)}><X size={20} color={theme.black} /></TouchableOpacity>
                    </View>
                    <TextInput style={[styles.modalInput, { fontFamily: fonts.body, color: theme.black, height: 100, textAlignVertical: 'top', paddingTop: 16 }]} placeholder="e.g. A dark forest..." placeholderTextColor={Colors.mutedTeal} value={coverPrompt} onChangeText={setCoverPrompt} multiline />
                    <Button title={generatingCover ? "GENERATING..." : "GENERATE ART"} onPress={handleGenerateCover} disabled={generatingCover} type="primary" style={{ backgroundColor: theme.primary }} />
                </View>
            </View>
        </Modal>
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
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>MANAGE CONTENT</Text>
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
          <Button title="ADD NEW STORY" onPress={() => setIsAdding(true)} type="primary" style={{ marginBottom: 24 }} />
          <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>MY STORIES</Text>
          <View style={{ paddingBottom: insets.bottom + 40 }}>
            {loading && !refreshing ? [1, 2, 3].map(i => <SkeletonCard key={i} />) : (
              stories.map((story) => (
                <View key={story.id} style={[styles.storyRow, { borderBottomColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
                  <View style={styles.storyInfo}>
                    <Text style={[styles.storyTitle, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{story.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.storyMeta, { fontFamily: fonts.body }]}>{story.genre}</Text>
                        {story.coAuthors?.length > 0 && <Users size={12} color={Colors.mutedTeal} style={{ marginLeft: 8 }} />}
                    </View>
                  </View>
                  <View style={styles.storyActions}>
                    <TouchableOpacity onPress={() => navigation.navigate("ManageChapters", { storyId: story.id, storyTitle: story.title })} style={styles.actionBtn}><FileText size={18} color={theme.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingId(story.id); setShowCollabModal(true); }} style={styles.actionBtn}><UserPlus size={18} color={theme.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => fetchVersions(story.id)} style={styles.actionBtn}><History size={18} color={Colors.mutedTeal} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate("CreativeSuite", { storyId: story.id, storyTitle: story.title })} style={styles.actionBtn}><Globe size={18} color={Colors.accent} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => startEdit(story)} style={styles.actionBtn}><Edit2 size={18} color={theme.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(story.id)} style={styles.actionBtn}><Trash2 size={18} color="red" /></TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            {!loading && stories.length === 0 && <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No stories found.</Text>}
          </View>
        </View>
      </ScrollView>

      {/* Modals omitted for brevity - logic same as before */}
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
  imageContainer: { width: '100%', marginBottom: 24, position: 'relative' },
  imagePicker: { width: "100%", aspectRatio: 1.5, borderRadius: 16, overflow: "hidden", justifyContent: "center", alignItems: "center", borderWidth: 1, borderStyle: "dashed" },
  previewImage: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center" },
  imagePlaceholderText: { fontSize: 12, color: Colors.mutedTeal, marginTop: 8 },
  aiGenBtn: { position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', ...Shadows.s },
  dropdownLabel: { fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.05 },
  dropdown: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 8, marginBottom: 20, borderWidth: 0.5 },
  dropdownText: { fontSize: 14 },
  dropdownMenu: { borderRadius: 8, borderWidth: 1, marginTop: -15, marginBottom: 20, padding: 8, elevation: 4 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownItemText: { fontSize: 14 },
  richToolbar: { flexDirection: 'row', backgroundColor: 'rgba(0,54,49,0.05)', borderRadius: 12, padding: 8, marginBottom: 12 },
  toolBtn: { padding: 10, marginRight: 8, borderRadius: 8 },
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
  actionBtn: { marginLeft: 10, padding: 4 },
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
