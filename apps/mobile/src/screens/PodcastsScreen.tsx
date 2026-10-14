import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Headphones } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";

const SHOWS = [
  {
    title: "Nest Night Readings",
    blurb: "Authors read new chapters — weekly audio drops.",
  },
  {
    title: "Faith & Fiction",
    blurb: "Long-form talks on stories that form the soul.",
  },
  {
    title: "Behind the Chapter",
    blurb: "Short craft sessions from StoryNest writers.",
  },
];

export const PodcastsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.white, paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 100,
          paddingTop: 24,
        }}
      >
        <View style={styles.iconWrap}>
          <Headphones size={40} color={Colors.primary} />
        </View>
        <Text style={[styles.title, { fontFamily: fonts.heading, color: Colors.primary }]}>
          PODCASTS
        </Text>
        <Text style={[styles.body, { fontFamily: fonts.body, color: Colors.mutedTeal }]}>
          Audio stories and author talks are part of the social nest. Episode playback is next;
          shows below are scheduled for the catalog.
        </Text>

        {SHOWS.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={[styles.cardTitle, { fontFamily: fonts.heading, color: theme.primary }]}>
              {s.title}
            </Text>
            <Text style={[styles.cardBlurb, { fontFamily: fonts.body }]}>{s.blurb}</Text>
            <Text style={styles.badge}>COMING SOON</Text>
          </View>
        ))}

        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.navigate("Read")}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { fontFamily: fonts.heading }]}>GO TO READ</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,54,49,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    alignSelf: "center",
  },
  title: { fontSize: 18, letterSpacing: 3, marginBottom: 12, textAlign: "center" },
  body: { fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 28 },
  card: {
    borderWidth: 1,
    borderColor: "rgba(0,54,49,0.1)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, letterSpacing: 0.5, marginBottom: 6 },
  cardBlurb: { fontSize: 13, color: Colors.mutedTeal, lineHeight: 18, marginBottom: 10 },
  badge: {
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.mutedTeal,
    fontWeight: "600",
  },
  btn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignSelf: "center",
    marginTop: 16,
  },
  btnText: { color: Colors.accent, fontSize: 12, letterSpacing: 1.5 },
});
