import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, FlatList, Image } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Plus, X, FolderHeart, Bookmark, ChevronRight, LayoutList } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";

export const PlaylistsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/playlists/me");
      setPlaylists(res.data);
    } catch (error) { console.log(error); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
        await apiClient.post("/playlists", { title: newTitle, description: newDesc });
        setNewTitle(""); setNewDesc(""); setIsAdding(false);
        fetchPlaylists();
    } catch (e) { Alert.alert("Error", "Could not create playlist."); }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><ArrowLeft size={24} color={Colors.accent} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>MY PLAYLISTS</Text>
        <TouchableOpacity onPress={() => setIsAdding(true)} style={styles.addBtn}><Plus size={24} color={Colors.accent} /></TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} /> : (
              playlists.length === 0 ? (
                  <View style={styles.emptyContainer}>
                      <FolderHeart size={64} color={Colors.mutedTeal} strokeWidth={1} />
                      <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No playlists yet. Create one to organize your favorites!</Text>
                  </View>
              ) : (
                  playlists.map(p => (
                      <TouchableOpacity key={p.id} style={[styles.playlistCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : Colors.paleGreen }]}>
                          <View style={styles.playlistIcon}><LayoutList size={24} color={theme.primary} /></View>
                          <View style={{ flex: 1, marginLeft: 16 }}>
                              <Text style={[styles.playlistTitle, { color: theme.black, fontFamily: fonts.heading }]}>{p.title}</Text>
                              <Text style={[styles.playlistCount, { fontFamily: fonts.body }]}>{p.stories.length} stories</Text>
                          </View>
                          <ChevronRight size={20} color={Colors.mutedTeal} />
                      </TouchableOpacity>
                  ))
              )
          )}
      </ScrollView>

      <Modal visible={isAdding} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
                  <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.black, fontFamily: fonts.heading }]}>NEW PLAYLIST</Text><TouchableOpacity onPress={() => setIsAdding(false)}><X size={24} color={theme.black} /></TouchableOpacity></View>
                  <TextField label="Title" value={newTitle} onChangeText={setNewTitle} placeholder="Fantasy Gems..." />
                  <TextField label="Description" value={newDesc} onChangeText={setNewDesc} placeholder="Optional..." multiline />
                  <Button title="CREATE" onPress={handleCreate} type="primary" style={{ marginTop: 20 }} />
              </View>
          </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 24, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  headerTitle: { fontSize: 18, color: Colors.accent, letterSpacing: 2 },
  backBtn: { marginRight: 20 },
  addBtn: { marginLeft: 'auto' },
  content: { flex: 1, padding: 24 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: Colors.mutedTeal, marginTop: 20, textAlign: 'center', paddingHorizontal: 40 },
  playlistCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, marginBottom: 16, ...Shadows.s },
  playlistIcon: { width: 50, height: 50, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  playlistTitle: { fontSize: 16 },
  playlistCount: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18 },
});
