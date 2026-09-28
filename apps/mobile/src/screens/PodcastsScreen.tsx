import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Headphones } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";

/**
 * Phase C placeholder — audio episodes will attach to series / standalone shows.
 */
export const PodcastsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.white, paddingTop: insets.top + 24 }]}>
      <StatusBar style="dark" />
      <View style={styles.iconWrap}>
        <Headphones size={48} color={Colors.primary} />
      </View>
      <Text style={[styles.title, { fontFamily: fonts.heading, color: Colors.primary }]}>PODCASTS</Text>
      <Text style={[styles.body, { fontFamily: fonts.body, color: Colors.mutedTeal }]}>
        Audio stories and author talks are coming next. For now, keep reading in the Read tab —
        long-form is live on production.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation.navigate("Read")}
        activeOpacity={0.85}
      >
        <Text style={[styles.btnText, { fontFamily: fonts.heading }]}>GO TO READ</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 32, alignItems: "center", justifyContent: "center" },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(0,54,49,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 18, letterSpacing: 3, marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 28 },
  btn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  btnText: { color: Colors.accent, fontSize: 12, letterSpacing: 1.5 },
});
