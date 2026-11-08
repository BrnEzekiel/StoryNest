import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Eye } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { Colors } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { useHiddenStories } from "../hooks/useHiddenStories";
import apiClient from "../api/apiClient";

export const HiddenScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts, isDarkMode } = useTheme();
  const { hidden, unhide } = useHiddenStories();
  const [titles, setTitles] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    hidden.forEach((id) => {
      if (!titles[id]) {
        apiClient.get(`/stories/${id}`).then((r) => setTitles((t) => ({ ...t, [id]: r.data?.title || id }))).catch(() => setTitles((t) => ({ ...t, [id]: id })));
      }
    });
  }, [hidden]);

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { top: insets.top + 20 }]} accessibilityLabel="Go back" accessibilityRole="button">
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HIDDEN STORIES</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {hidden.length === 0 && (
          <Text style={[styles.empty, { fontFamily: fonts.body }]}>Nothing hidden. Tap the eye-off icon on any story card to hide it from Home and Explore.</Text>
        )}
        {hidden.map((id) => (
          <View key={id} style={[styles.row, { borderBottomColor: isDarkMode ? "rgba(255,255,255,0.08)" : Colors.paleGreen }]}>
            <Text style={[styles.title, { color: theme.black, fontFamily: fonts.body }]} numberOfLines={1}>{titles[id] || id}</Text>
            <TouchableOpacity onPress={() => unhide(id)} style={styles.unhide} accessibilityLabel={`Unhide ${titles[id] || "story"}`} accessibilityRole="button">
              <Eye size={16} color={theme.primary} />
              <Text style={[styles.unhideText, { color: theme.primary, fontFamily: fonts.heading }]}>UNHIDE</Text>
            </TouchableOpacity>
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
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  title: { fontSize: 15, flex: 1 },
  unhide: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  unhideText: { fontSize: 12 },
});
