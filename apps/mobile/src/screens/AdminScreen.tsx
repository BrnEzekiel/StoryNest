import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Modal, TextInput, RefreshControl, Dimensions, KeyboardAvoidingView } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { useAuth } from "../context/AuthContext";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Trash2, Edit2, ArrowLeft, Camera, ChevronDown, Plus, X, FolderPlus, Zap, Bold, Italic, Heading, Quote, List, Eye, Edit3, Globe, Sparkles, Wand2, History, RotateCcw, UserPlus, Users, FileText, BarChart3, RefreshCw, Image as ImageIcon } from "lucide-react-native";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { SkeletonCard } from "../components/SkeletonCard";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { tapThrottle, TAP_GAP_MS } from "../utils/rateLimit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { validateStoryCover } from "../utils/storyCover";

const { width } = Dimensions.get("window");

export const AdminScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme, isDarkMode } = useTheme();
  const { showNotice } = useNotice();
  const { user } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const adminQuery = useCachedQuery<{ stories: any[]; stats: any }>("admin:dashboard", async () => {
    try {
      const [storiesRes, statsRes] = await Promise.all([
        apiClient.get("/admin/my-stories"),
        apiClient.get("/admin/stats")
      ]);
      return { stories: storiesRes.data, stats: statsRes.data };
    } catch {
      // Fallback until the backend ships the admin endpoints: list from the
      // public catalog filtered to this author.
      const res = await apiClient.get("/stories");
      const all = Array.isArray(res.data) ? res.data : [];
      const mine = user ? all.filter((s: any) => s.ownerId === user.id) : [];
      const list = user?.role === "ADMIN" ? all : mine;
      return {
        stories: list,
        stats: {
          storyCount: list.length,
          totalReads: list.reduce((n: number, s: any) => n + (s.readCount || 0), 0),
          userCount: 0,
        },
      };
    }
  });
  const stories = adminQuery.data?.stories || [];
  const stats = adminQuery.data?.stats || { storyCount: 0, totalReads: 0, userCount: 0 };
  const isFirstLoad = adminQuery.isFirstLoad && !adminQuery.data;

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
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);

  const fetchAdminData = () => adminQuery.refresh();

  const onRefresh = useCallback(() => {
    if (!tapThrottle("admin:refresh", TAP_GAP_MS)) return;
    adminQuery.refresh({ showIndicator: true });
  }, [adminQuery]);

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!title || !genre || !authorName) {
      showNotice({ title: "Error", message: "Please fill in all required fields.", variant: "error" });
      return;
    }
    const coverError = validateStoryCover({ isEditing, coverUri, existingCoverUrl });
    if (coverError) {
      showNotice({ title: "Cover Required", message: coverError, variant: "error" });
      return;
    }
    if (submitLoading || !tapThrottle("admin:save", TAP_GAP_MS)) return;
    setSubmitLoading(true);
    try {
      if (coverUri) {
        // Newly picked image: multipart upload, the server stores it as coverUrl.
        const formData = new FormData();
        formData.append("title", title);
        formData.append("genre", genre);
        formData.append("authorName", authorName);
        formData.append("summary", "");
        if (body) formData.append("body", body);
        const filename = coverUri.split('/').pop() || 'cover.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        // @ts-ignore
        formData.append("cover", { uri: coverUri, name: filename, type });
        const headers = { 'Content-Type': 'multipart/form-data' };
        if (isEditing && editingId) {
          await apiClient.put(`/stories/${editingId}`, formData, { headers });
        } else {
          await apiClient.post("/stories", formData, { headers });
        }
      } else if (isEditing && editingId) {
        // Edit without a new pick: keep the existing cover.
        const payload: any = { title, genre, authorName, summary: "" };
        await apiClient.put(`/stories/${editingId}`, payload);
      }

      showNotice({ title: "Success", message: `Story ${isEditing ? 'updated' : 'published'} successfully!`, variant: "success" });
      setIsAdding(false);
      setIsEditing(false);
      resetForm();
      fetchAdminData();
    } catch (error: any) {
      console.error("[Admin] Save Error:", error.response?.data || error.message);
      showNotice({ title: "Error", message: "Action failed. Check your connection.", variant: "error" });
    } finally { setSubmitLoading(false); }
  };

  const startEdit = (story: any) => {
    setTitle(story.title);
    setGenre(story.genre);
    setAuthorName(story.authorName);
    setEditingId(story.id);
    setIsEditing(true);
    setIsAdding(true);
    setCoverUri(null);
    setExistingCoverUrl(story.coverUrl || null);
  };

  const resetForm = () => {
    setTitle(""); setGenre("Fiction"); setBody(""); setAuthorName(""); setEditingId(null); setIsEditing(false);
    setCoverUri(null); setExistingCoverUrl(null);
  };

  const handleDelete = (id: string) => {
    showNotice({
      title: "Delete Story",
      message: "Are you sure?",
      variant: "error",
      actions: [
        { label: "Cancel", kind: "ghost" },
        { label: "Delete", kind: "destructive", onPress: async () => {
            try { await apiClient.delete(`/stories/${id}`); fetchAdminData(); } catch (e) { showNotice({ title: "Error", message: "Failed to delete.", variant: "error" }); }
        }},
      ],
    });
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
      if (!tapThrottle(`admin:restore:${version.id}`, TAP_GAP_MS)) return;
      try {
          await apiClient.post(`/versions/${version.id}/restore`);
          showNotice({ title: "Restored", message: "Content reverted.", variant: "success" });
          setShowVersionHistory(false);
          fetchAdminData();
      } catch (e) { showNotice({ title: "Error", message: "Failed.", variant: "error" }); }
  };

  const handleAddCollaborator = async () => {
      if (!collabUsername.trim()) return;
      if (collabLoading || !tapThrottle("admin:collab", TAP_GAP_MS)) return;
      setCollabLoading(true);
      try {
          await apiClient.post(`/stories/${editingId}/collaborators`, { username: collabUsername });
          showNotice({ title: "Added", message: `${collabUsername} is now a co-author.`, variant: "success" });
          setCollabUsername("");
          setShowCollabModal(false);
          fetchAdminData();
      } catch (e) { showNotice({ title: "Error", message: "Failed.", variant: "error" }); }
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

                <Text style={[styles.dropdownLabel, { color: theme.primary, fontFamily: fonts.heading, marginTop: 10 }]}>COVER IMAGE (REQUIRED)</Text>
                <TouchableOpacity
                    style={[styles.coverPicker, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.lightForest }]}
                    onPress={pickCover}
                    activeOpacity={0.8}
                >
                    {coverUri || existingCoverUrl ? (
                        <Image source={{ uri: (coverUri || existingCoverUrl) as string }} style={styles.coverPreview} resizeMode="cover" />
                    ) : (
                        <View style={styles.coverPlaceholder}>
                            <Camera size={28} color={Colors.mutedTeal} />
                            <Text style={[styles.coverHint, { fontFamily: fonts.body }]}>Tap to choose a cover image</Text>
                        </View>
                    )}
                    {(coverUri || existingCoverUrl) ? (
                        <View style={styles.coverBadge}>
                            <Text style={[styles.coverBadgeText, { fontFamily: fonts.heading }]}>TAP TO CHANGE</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>

                {!isEditing && (
                    <TextField label="First Chapter Content" value={body} onChangeText={setBody} placeholder="Once upon a time..." multiline style={{ height: 250, textAlignVertical: "top", marginTop: 20 }} />
                )}

                <View style={{ marginTop: 20, marginBottom: 40 }}>
                    <Button
                        title={submitLoading ? "OPTIMIZING & PUBLISHING..." : (isEditing ? "UPDATE STORY" : "PUBLISH TO NEST")}
                        onPress={handleSave}
                        type="primary"
                        disabled={submitLoading}
                    />
                    <Button title="CANCEL" onPress={() => { setIsAdding(false); resetForm(); }} type="ghost" style={{ marginTop: 12 }} />
                </View>
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

      <ScrollView refreshControl={<RefreshControl refreshing={adminQuery.refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />} showsVerticalScrollIndicator={false}>
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
            {isFirstLoad ? [1, 2, 3].map(i => <SkeletonCard key={i} />) : (
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
            {!isFirstLoad && stories.length === 0 && <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No stories published yet.</Text>}
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
  coverPicker: { height: 190, borderRadius: 12, borderWidth: 0.5, marginBottom: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  coverPreview: { width: '100%', height: '100%' },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverHint: { fontSize: 13, color: Colors.mutedTeal, marginTop: 10 },
  coverBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  coverBadgeText: { fontSize: 10, color: Colors.white, letterSpacing: 1 },
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
