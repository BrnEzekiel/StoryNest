import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Megaphone } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { Colors } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import apiClient from "../api/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SEEN_KEY = "inbox:seenAt";

export const InboxScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [seenAt, setSeenAt] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [res, seen] = await Promise.all([
        apiClient.get("/announcements").catch(() => ({ data: [] })),
        AsyncStorage.getItem(SEEN_KEY),
      ]);
      setItems(Array.isArray(res.data) ? res.data : []);
      setSeenAt(seen || "");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    AsyncStorage.setItem(SEEN_KEY, new Date().toISOString()).catch(() => {});
  }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { top: insets.top + 20 }]}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>INBOX</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />}
      >
        {!loading && items.length === 0 && (
          <Text style={[styles.empty, { fontFamily: fonts.body }]}>
            No announcements yet. New releases, events, and digest highlights will land here.
          </Text>
        )}
        {items.map((a) => {
          const fresh = seenAt && a.createdAt ? a.createdAt > seenAt : true;
          return (
            <View
              key={a.id}
              style={[
                styles.card,
                { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, borderLeftColor: fresh ? Colors.primary : "transparent" },
              ]}
            >
              <View style={styles.cardHead}>
                <Megaphone size={16} color={theme.primary} />
                <Text style={[styles.date, { fontFamily: fonts.body }]}>
                  {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ""}
                </Text>
              </View>
              <Text style={[styles.title, { color: theme.black, fontFamily: fonts.heading }]}>{a.title}</Text>
              <Text style={[styles.body, { fontFamily: fonts.body }]}>{a.body}</Text>
            </View>
          );
        })}
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
  card: { borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 3 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  date: { fontSize: 12, color: Colors.mutedTeal },
  title: { fontSize: 16, marginBottom: 6 },
  body: { fontSize: 14, color: Colors.mutedTeal, lineHeight: 21 },
});
