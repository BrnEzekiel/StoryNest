import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, StickyNote, Trash2 } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useNotice } from "../context/NoticeContext";
import { Colors } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ShelfEntry {
  storyId: string;
  title: string;
  count: number;
  updatedAt: string;
}

export const AnnotationsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();
  const [entries, setEntries] = React.useState<ShelfEntry[]>([]);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Record<string, { color: string; note: string; text: string }>>({});
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem("annot:stories");
      setEntries(raw ? JSON.parse(raw) : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const openEntry = async (storyId: string) => {
    if (openId === storyId) {
      setOpenId(null);
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(`annot:${storyId}`);
      setItems(raw ? JSON.parse(raw) : {});
      setOpenId(storyId);
    } catch {
      setItems({});
      setOpenId(storyId);
    }
  };

  const removeOne = async (storyId: string, idx: string) => {
    const next = { ...items };
    delete next[idx];
    setItems(next);
    await AsyncStorage.setItem(`annot:${storyId}`, JSON.stringify(next));
    const count = Object.keys(next).length;
    const rest = entries.filter((e) => e.storyId !== storyId);
    if (count > 0) {
      const kept = entries.find((e) => e.storyId === storyId);
      if (kept) rest.unshift({ ...kept, count });
    }
    setEntries(rest);
    await AsyncStorage.setItem("annot:stories", JSON.stringify(rest));
    showNotice({ title: "Removed", message: "Annotation deleted.", variant: "info" });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { top: insets.top + 20 }]} accessibilityLabel="Go back" accessibilityRole="button">
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MY ANNOTATIONS</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />}
      >
        {!loading && entries.length === 0 && (
          <Text style={[styles.empty, { fontFamily: fonts.body }]}>
            No highlights yet. Open any story, tap the highlighter icon, then tap a paragraph to highlight it or long-press to add a note.
          </Text>
        )}
        {entries.map((e) => (
          <View key={e.storyId} style={[styles.card, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
            <TouchableOpacity onPress={() => openEntry(e.storyId)} accessibilityLabel={`${e.title}, ${e.count} annotations`} accessibilityRole="button">
              <View style={styles.cardHead}>
                <StickyNote size={16} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{e.title}</Text>
              </View>
              <Text style={[styles.cardSub, { fontFamily: fonts.body }]}>{e.count} {e.count === 1 ? "annotation" : "annotations"}</Text>
            </TouchableOpacity>
            {openId === e.storyId && (
              <View style={{ marginTop: 10, gap: 10 }}>
                {Object.entries(items).map(([idx, a]) => (
                  <View key={idx} style={[styles.annot, { borderLeftColor: "#FFE58A" }]}>
                    <Text style={[styles.annotText, { fontFamily: fonts.body }]}>"{a.text}"</Text>
                    {!!a.note && <Text style={[styles.annotNote, { fontFamily: fonts.body }]}>{a.note}</Text>}
                    <View style={styles.annotRow}>
                      <TouchableOpacity onPress={() => navigation.navigate("Reader", { storyId: e.storyId })} accessibilityLabel="Open story" accessibilityRole="button">
                        <Text style={[styles.annotLink, { fontFamily: fonts.heading }]}>OPEN STORY</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeOne(e.storyId, idx)} accessibilityLabel="Delete annotation" accessibilityRole="button">
                        <Trash2 size={16} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
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
  empty: { color: Colors.mutedTeal, fontSize: 14, lineHeight: 22 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 16, flex: 1 },
  cardSub: { fontSize: 12, color: Colors.mutedTeal, marginTop: 4 },
  annot: { borderLeftWidth: 3, paddingLeft: 10 },
  annotText: { fontSize: 14, fontStyle: "italic", color: Colors.mutedTeal },
  annotNote: { fontSize: 14, marginTop: 4 },
  annotRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  annotLink: { fontSize: 12, color: Colors.primary },
});
