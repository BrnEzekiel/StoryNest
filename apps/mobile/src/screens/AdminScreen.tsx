import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator, Image, Platform } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Trash2, Edit2, ArrowLeft, Camera, ChevronDown, Plus } from "lucide-react-native";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { SkeletonCard } from "../components/SkeletonCard";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import * as ImagePicker from "expo-image-picker";

const GENRES = ["Fiction", "Romance", "Thriller", "Faith", "Mystery"];

export const AdminScreen = ({ navigation }: any) => {
  const { isDarkMode, theme } = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [stories, setStories] = useState<any[]>([]);
  const [stats, setStats] = useState({ storyCount: 0, totalReads: 0, userCount: 0 });
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Fiction");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [storiesRes, statsRes] = await Promise.all([
        apiClient.get("/stories"),
        apiClient.get("/admin/stats")
      ]);
      setStories(storiesRes.data);
      setStats(statsRes.data);
    } catch (error) { console.log("Error fetching admin data:", error); }
    finally { setLoading(false); }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!title || !genre || !body || !authorName) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    setSubmitLoading(true);
    try {
      const words = body.split(/\s+/).length;
      const readingTime = Math.max(1, Math.ceil(words / 200));

      const formData = new FormData();
      formData.append("title", title);
      formData.append("genre", genre);
      formData.append("body", body);
      formData.append("authorName", authorName);
      formData.append("readingTime", readingTime.toString());

      if (image && !image.startsWith('http')) {
        const filename = image.split("/").pop();
        const match = /\.(\w+)$/.exec(filename || "");
        const type = match ? `image/${match[1]}` : `image`;
        formData.append("cover", { uri: image, name: filename, type } as any);
      }

      if (isEditing && editingId) {
        await apiClient.put(`/stories/${editingId}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        await apiClient.post("/stories", formData, { headers: { "Content-Type": "multipart/form-data" } });
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
    setBody(story.body);
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

  if (isAdding) {
    return (
      <View style={[styles.container, { backgroundColor: theme.white }]}>
        <SafeAreaView style={[styles.headerSection, { backgroundColor: Colors.primary }]}>
          <TouchableOpacity onPress={() => { setIsAdding(false); resetForm(); }} style={styles.backBtnHeader}>
            <ArrowLeft size={24} color={Colors.accent} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? 'EDIT STORY' : 'UPLOAD'}</Text>
        </SafeAreaView>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={[styles.imagePicker, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.mutedTeal }]} onPress={pickImage}>
            {image ? <Image source={{ uri: image }} style={styles.previewImage} /> : (
              <View style={styles.imagePlaceholder}><Camera size={32} color={Colors.mutedTeal} /><Text style={styles.imagePlaceholderText}>Upload Cover Image</Text></View>
            )}
          </TouchableOpacity>
          
          <TextField 
            label="Story Title" 
            value={title} 
            onChangeText={setTitle} 
            placeholder="Enter title" 
            variant={isDarkMode ? "dark" : "light"}
          />
          <TextField 
            label="Author Name" 
            value={authorName} 
            onChangeText={setAuthorName} 
            placeholder="Author name" 
            variant={isDarkMode ? "dark" : "light"}
          />
          
          <Text style={[styles.dropdownLabel, { color: isDarkMode ? Colors.mutedTeal : Colors.primary }]}>GENRE</Text>
          <TouchableOpacity style={[styles.dropdown, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.lightForest }]} onPress={() => setShowGenreDropdown(!showGenreDropdown)}>
            <Text style={[styles.dropdownText, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{genre}</Text>
            <ChevronDown size={20} color={isDarkMode ? Colors.accent : Colors.primary} />
          </TouchableOpacity>
          
          {showGenreDropdown && (
            <View style={[styles.dropdownMenu, { backgroundColor: isDarkMode ? "#1a2e2c" : Colors.white, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}>
              {GENRES.map((g) => (
                <TouchableOpacity key={g} style={styles.dropdownItem} onPress={() => { setGenre(g); setShowGenreDropdown(false); }}>
                  <Text style={[styles.dropdownItemText, { color: isDarkMode ? Colors.paleGreen : Colors.mutedTeal }, g === genre && { color: Colors.accent, fontWeight: "700" }]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TextField 
            label="Story Content" 
            value={body} 
            onChangeText={setBody} 
            placeholder="Paste story here..." 
            multiline 
            style={{ height: 300, textAlignVertical: "top" }} 
            variant={isDarkMode ? "dark" : "light"}
          />

          {submitLoading ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: 20 }} /> : (
            <View style={{ marginBottom: 40 }}>
              <Button title={isEditing ? "UPDATE STORY" : "UPLOAD STORY"} onPress={handleSave} type="primary" />
              <Button title="CANCEL" onPress={() => { setIsAdding(false); resetForm(); }} type="ghost" style={{ marginTop: 12 }} />
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <SafeAreaView style={[styles.headerSection, { backgroundColor: Colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnHeader}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MANAGE CONTENT</Text>
      </SafeAreaView>

      <View style={styles.statsGrid}>
        <View style={[styles.statBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
          <Text style={[styles.statValue, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{stats.storyCount}</Text>
          <Text style={styles.statLabel}>Stories</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
          <Text style={[styles.statValue, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{stats.totalReads}</Text>
          <Text style={styles.statLabel}>Reads</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
          <Text style={[styles.statValue, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{stats.userCount}</Text>
          <Text style={styles.statLabel}>Users</Text>
        </View>
      </View>

      <View style={styles.actionSection}>
        <Button title="ADD NEW STORY" onPress={() => setIsAdding(true)} type="secondary" style={{ marginBottom: 24 }} />
        <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.accent : Colors.primary }]}>ALL STORIES</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {loading ? [1, 2, 3].map(i => <SkeletonCard key={i} />) : (
            stories.map((story) => (
              <View key={story.id} style={[styles.storyRow, { borderBottomColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
                <View style={styles.storyInfo}>
                  <Text style={[styles.storyTitle, { color: isDarkMode ? Colors.white : Colors.primary }]} numberOfLines={1}>{story.title}</Text>
                  <Text style={styles.storyMeta}>{story.genre} • {story.readingTime} min</Text>
                </View>
                <View style={styles.storyActions}>
                  <TouchableOpacity onPress={() => startEdit(story)} style={styles.actionBtn}>
                    <Edit2 size={18} color={isDarkMode ? Colors.accent : Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(story.id)} style={styles.actionBtn}>
                    <Trash2 size={18} color="red" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          {!loading && stories.length === 0 && <Text style={styles.emptyText}>No stories found.</Text>}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingBottom: 24, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.accent, textAlign: "center", marginTop: 10, letterSpacing: 0.05 },
  backBtnHeader: { position: "absolute", left: 24, top: Platform.OS === 'android' ? 20 : 10 },
  content: { padding: 24 },
  imagePicker: { width: "100%", aspectRatio: 1.5, borderRadius: 16, marginBottom: 24, overflow: "hidden", justifyContent: "center", alignItems: "center", borderWidth: 1, borderStyle: "dashed" },
  previewImage: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center" },
  imagePlaceholderText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.mutedTeal, marginTop: 8 },
  dropdownLabel: { fontFamily: Fonts.body, fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.05 },
  dropdown: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 8, marginBottom: 20, borderWidth: 0.5 },
  dropdownText: { fontFamily: Fonts.body, fontSize: 14 },
  dropdownMenu: { borderRadius: 8, borderWidth: 1, marginTop: -15, marginBottom: 20, padding: 8, elevation: 4 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownItemText: { fontFamily: Fonts.body, fontSize: 14 },
  statsGrid: { flexDirection: "row", paddingHorizontal: 24, paddingVertical: 20, justifyContent: "space-between" },
  statBox: { width: "31%", padding: 12, borderRadius: 12, alignItems: "center" },
  statValue: { fontFamily: Fonts.heading, fontSize: 18 },
  statLabel: { fontFamily: Fonts.body, fontSize: 10, color: Colors.mutedTeal },
  actionSection: { flex: 1, paddingHorizontal: 24 },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: 16, marginBottom: 16 },
  storyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1 },
  storyInfo: { flex: 1 },
  storyTitle: { fontFamily: Fonts.heading, fontSize: 14 },
  storyMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.mutedTeal },
  storyActions: { flexDirection: "row" },
  actionBtn: { marginLeft: 16, padding: 8 },
  emptyText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 20 },
});
