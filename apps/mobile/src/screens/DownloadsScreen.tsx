import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Download, Trash2, Zap } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useNotice } from "../context/NoticeContext";
import { Colors } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { OfflineManager } from "../utils/OfflineManager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient, { BASE_URL } from "../api/apiClient";
import { Share } from "react-native";
import * as FileSystem from "expo-file-system";

const fmtBytes = (n: number) => {
  if (!n || n <= 0) return "0 KB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export const DownloadsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();
  const [stories, setStories] = React.useState<any[]>([]);
  const [info, setInfo] = React.useState({ totalBytes: 0, count: 0 });
  const [loading, setLoading] = React.useState(true);
  const [auto, setAuto] = React.useState(false);
  const [lite, setLite] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, storage, autoDl, liteMode] = await Promise.all([
        OfflineManager.getDownloadedStories(),
        OfflineManager.getStorageInfo().catch(() => ({ totalBytes: 0, count: 0 })),
        OfflineManager.getAutoDownload().catch(() => false),
        AsyncStorage.getItem("liteMode"),
      ]);
      setStories(list);
      setInfo({ totalBytes: storage.totalBytes || 0, count: storage.count || list.length });
      setAuto(autoDl === true);
      setLite(liteMode === "true");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string, title: string) => {
    await OfflineManager.removeStory(id).catch(() => {});
    setStories((s) => s.filter((x) => x.id !== id));
    showNotice({ title: "Removed", message: `"${title}" deleted from this device.`, variant: "info" });
    OfflineManager.getStorageInfo().then((st) => setInfo({ totalBytes: st.totalBytes || 0, count: st.count || 0 })).catch(() => {});
  };

  const clearFinished = async () => {
    try {
      const res = await apiClient.get("/users/me/bookmarks");
      const list = Array.isArray(res.data) ? res.data : [];
      const prog: Record<string, number> = {};
      list.forEach((b: any) => {
        prog[b.storyId || b.id] = b.progress ?? 0;
      });
      const n = await OfflineManager.clearFinished(prog);
      if (n > 0) load();
      showNotice({ title: "Cleanup done", message: n > 0 ? `${n} finished ${n === 1 ? "story" : "stories"} removed.` : "No finished downloads to remove.", variant: "success" });
    } catch {
      showNotice({ title: "Error", message: "Could not clean finished downloads.", variant: "error" });
    }
  };

  const exportEpub = async (id: string, title: string) => {
    try {
      showNotice({ title: "Building EPUB", message: "Packaging for your e-reader…", variant: "info" });
      const dest = `${FileSystem.documentDirectory}${id}.epub`;
      const dl = await FileSystem.downloadAsync(`${BASE_URL}/stories/${id}/epub`, dest);
      const shareUri = await FileSystem.getContentUriAsync(dl.uri).catch(() => dl.uri);
      await Share.share({ url: shareUri, title: `${title} (EPUB)` });
    } catch {
      showNotice({ title: "Error", message: "Could not build the EPUB.", variant: "error" });
    }
  };

  const clearAll = async () => {
    for (const s of stories) {
      await OfflineManager.removeStory(s.id).catch(() => {});
    }
    setStories([]);
    setInfo({ totalBytes: 0, count: 0 });
    showNotice({ title: "Storage cleared", message: "All offline stories were removed.", variant: "success" });
  };

  const toggleAuto = async (v: boolean) => {
    setAuto(v);
    await OfflineManager.setAutoDownload(v);
  };

  const toggleLite = async (v: boolean) => {
    setLite(v);
    await AsyncStorage.setItem("liteMode", v.toString());
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { top: insets.top + 20 }]}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DOWNLOADS</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />}
      >
        <View style={[styles.card, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
          <Text style={[styles.cardTitle, { color: theme.primary, fontFamily: fonts.heading }]}>STORAGE</Text>
          <Text style={[styles.storageBig, { color: theme.black, fontFamily: fonts.heading }]}>{fmtBytes(info.totalBytes)}</Text>
          <Text style={[styles.storageSub, { fontFamily: fonts.body }]}>{info.count} {info.count === 1 ? "story" : "stories"} saved for offline reading</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Download size={18} color={theme.primary} />
            <Text style={[styles.rowTitle, { color: theme.black, fontFamily: fonts.body }]}>Auto-download bookmarks</Text>
          </View>
          <Switch value={auto} onValueChange={toggleAuto} trackColor={{ false: "#767577", true: Colors.primary }} thumbColor={auto ? Colors.accent : "#f4f3f4"} />
        </View>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Zap size={18} color={theme.primary} />
            <Text style={[styles.rowTitle, { color: theme.black, fontFamily: fonts.body }]}>Lite mode (skip cover art)</Text>
          </View>
          <Switch value={lite} onValueChange={toggleLite} trackColor={{ false: "#767577", true: Colors.primary }} thumbColor={lite ? Colors.accent : "#f4f3f4"} />
        </View>

        <Text style={styles.sectionTitle}>SAVED STORIES</Text>
        {!loading && stories.length === 0 && (
          <Text style={[styles.empty, { fontFamily: fonts.body }]}>Nothing downloaded yet. Open a story and tap the download icon to read it offline.</Text>
        )}
        {stories.map((s) => (
          <View key={s.id} style={[styles.storyRow, { borderBottomColor: isDarkMode ? "rgba(255,255,255,0.08)" : Colors.paleGreen }]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("Reader", { storyId: s.id })}>
              <Text style={[styles.storyTitle, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{s.title}</Text>
              <Text style={[styles.storyMeta, { fontFamily: fonts.body }]}>{s.chapters?.length || 0} chapters · {fmtBytes(s.sizeBytes || 0)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => exportEpub(s.id, s.title)} style={styles.iconBtn} accessibilityLabel="Export as EPUB for e-reader">
              <Download size={18} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remove(s.id, s.title)} style={styles.iconBtn} accessibilityLabel="Remove download">
              <Trash2 size={18} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        ))}

        {stories.length > 0 && (
          <TouchableOpacity onPress={clearFinished} style={[styles.clearBtn, { borderColor: Colors.primary, marginTop: 24 }]}>
            <Trash2 size={18} color={Colors.primary} />
            <Text style={[styles.clearText, { color: Colors.primary }]}>CLEAR FINISHED</Text>
          </TouchableOpacity>
        )}

        {stories.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Trash2 size={18} color="#FF6B6B" />
            <Text style={styles.clearText}>CLEAR ALL DOWNLOADS</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  backBtn: { position: "absolute", left: 20 },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.accent, letterSpacing: 0.05, marginTop: 10 },
  content: { flex: 1, padding: 24 },
  card: { borderRadius: 14, padding: 18, marginBottom: 12 },
  cardTitle: { fontSize: 13, marginBottom: 6 },
  storageBig: { fontSize: 30 },
  storageSub: { fontSize: 13, color: Colors.mutedTeal, marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.paleGreen },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowTitle: { fontSize: 15, flex: 1 },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.mutedTeal, marginBottom: 8, marginTop: 24 },
  empty: { color: Colors.mutedTeal, fontSize: 14, lineHeight: 22 },
  storyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  storyTitle: { fontSize: 16 },
  storyMeta: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 },
  iconBtn: { padding: 8 },
  clearBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#FF6B6B" },
  clearText: { fontFamily: Fonts.heading, fontSize: 13, color: "#FF6B6B" },
});
