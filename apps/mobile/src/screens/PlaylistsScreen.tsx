import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, Image } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { ActivityLog } from "../utils/activityLog";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Plus, X, FolderHeart, Bookmark, ChevronRight, LayoutList } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { Cache } from "../utils/Cache";
import { tapThrottle, TAP_GAP_MS } from "../utils/rateLimit";

export const PlaylistsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();

  const playlistsQuery = useCachedQuery<any[]>("playlists:me", async () => {
    const res = await apiClient.get("/playlists/me");
    return res.data;
  });
  const playlists = playlistsQuery.data || [];

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    if (!tapThrottle("playlists:create", TAP_GAP_MS)) return;
    try {
        const res = await apiClient.post("/playlists", { title: newTitle, description: newDesc });
        const next = [res.data, ...playlists];
        playlistsQuery.setData(next);
        Cache.set("playlists:me", next).catch(() => {});
        setNewTitle(""); setNewDesc(""); setIsAdding(false);
        ActivityLog.log({ kind: "PLAYLIST", title: res.data?.title || newTitle });
    } catch (e) { showNotice({ title: "Error", message: "Could not create playlist.", variant: "error" }); }
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
          {playlists.length === 0 ? (
              <View style={styles.emptyContainer}>
                  <FolderHeart size={64} color={Colors.mutedTeal} strokeWidth={1} />
                  <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>
                      {playlistsQuery.isFirstLoad ? "Opening your playlists..." : "No playlists yet. Create one to organize your favorites!"}
                  </Text>
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
