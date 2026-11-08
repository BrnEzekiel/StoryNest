import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { Colors } from "../theme/colors";
import { ArrowLeft, Plus, CheckCircle2, Circle } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { canCreateContent } from "../utils/roles";
import { tapThrottle, TAP_GAP_MS } from "../utils/rateLimit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";

const GENRES = ["Fiction", "Romance", "Thriller", "Mystery", "Sci-Fi", "Poetry", "Faith"];

export const RequestsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();

  const reqQuery = useCachedQuery<any[]>("story-requests", async () => {
    const res = await apiClient.get("/requests");
    return res.data;
  });
  const requests = reqQuery.data || [];

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Fiction");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const isWriter = canCreateContent(user?.role);

  const handlePost = async () => {
    if (!title.trim() || busy || !tapThrottle("requests:post", TAP_GAP_MS)) return;
    setBusy(true);
    try {
      await apiClient.post("/requests", { title: title.trim(), genre, description: description.trim() });
      setTitle(""); setDescription(""); setGenre("Fiction"); setShowForm(false);
      reqQuery.refresh();
      showNotice({ title: "Posted", message: "Writers can now claim your request.", variant: "success" });
    } catch (e) { showNotice({ title: "Error", message: "Could not post request.", variant: "error" }); }
    finally { setBusy(false); }
  };

  const handleClaim = async (id: string) => {
    if (busy || !tapThrottle(`requests:claim:${id}`, TAP_GAP_MS)) return;
    setBusy(true);
    try {
      await apiClient.post(`/requests/${id}/claim`);
      reqQuery.refresh();
      showNotice({ title: "Claimed", message: "The request is yours. Happy writing!", variant: "success" });
    } catch (e: any) { showNotice({ title: "Error", message: e.response?.data?.error || "Could not claim.", variant: "error" }); }
    finally { setBusy(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>STORY REQUESTS</Text>
        <TouchableOpacity onPress={() => setShowForm((v) => !v)} style={styles.addBtn}>
          <Plus size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={reqQuery.refreshing} onRefresh={() => reqQuery.refresh({ showIndicator: true })} tintColor={Colors.accent} />}
      >
        {showForm && (
          <View style={[styles.card, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : Colors.paleGreen }]}>
            <TextField label="What should someone write?" value={title} onChangeText={setTitle} placeholder="e.g. A heist in Nairobi" />
            <Text style={[styles.label, { color: theme.primary, fontFamily: fonts.heading }]}>GENRE</Text>
            <View style={styles.genreWrap}>
              {GENRES.map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGenre(g)}
                  style={[styles.genreChip, genre === g ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: Colors.paleGreen }]}
                >
                  <Text style={[styles.genreText, { fontFamily: fonts.body }, genre === g ? { color: Colors.accent } : { color: theme.black }]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextField label="Details (optional)" value={description} onChangeText={setDescription} placeholder="Characters, setting, twists..." multiline style={{ height: 90, textAlignVertical: "top" }} />
            <Button title={busy ? "POSTING..." : "POST REQUEST"} onPress={handlePost} disabled={busy} type="primary" />
          </View>
        )}

        {reqQuery.isFirstLoad && requests.length === 0 ? (
          <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>Loading requests...</Text>
        ) : requests.length === 0 ? (
          <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No requests yet. Ask for the story you want to read!</Text>
        ) : requests.map((r: any) => (
          <View key={r.id} style={[styles.reqRow, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : Colors.white, borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.reqTitle, { color: theme.black, fontFamily: fonts.heading }]}>{r.title}</Text>
              <Text style={[styles.reqMeta, { fontFamily: fonts.body }]}>{r.genre} • by {r.username}</Text>
              {!!r.description && <Text style={[styles.reqDesc, { color: theme.black, fontFamily: fonts.body }]} numberOfLines={2}>{r.description}</Text>}
              {r.status !== "OPEN" && (
                <Text style={[styles.claimedBy, { fontFamily: fonts.body }]}>Claimed by {r.claimedByName || "a writer"}</Text>
              )}
            </View>
            {r.status === "OPEN" && isWriter ? (
              <TouchableOpacity style={[styles.claimBtn, { backgroundColor: theme.primary }]} onPress={() => handleClaim(r.id)}>
                <Text style={[styles.claimText, { fontFamily: fonts.heading }]}>CLAIM</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.statusWrap}>
                {r.status === "OPEN"
                  ? <Circle size={18} color={Colors.mutedTeal} />
                  : <CheckCircle2 size={18} color="#34C759" />}
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
  header: { paddingBottom: 24, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  headerTitle: { fontSize: 18, color: Colors.accent, letterSpacing: 1, flex: 1, textAlign: "center" },
  backBtn: { marginRight: 16 },
  addBtn: { marginLeft: 16 },
  content: { flex: 1, padding: 24 },
  card: { borderRadius: 16, padding: 16, marginBottom: 20 },
  label: { fontSize: 12, marginBottom: 8, letterSpacing: 0.5 },
  genreWrap: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  genreChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, marginRight: 8, marginBottom: 8, borderWidth: 1 },
  genreText: { fontSize: 12 },
  reqRow: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  reqTitle: { fontSize: 15 },
  reqMeta: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 },
  reqDesc: { fontSize: 13, marginTop: 6, opacity: 0.8 },
  claimedBy: { fontSize: 12, color: "#34C759", marginTop: 6 },
  claimBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, marginLeft: 10 },
  claimText: { fontSize: 11, color: Colors.accent, letterSpacing: 1 },
  statusWrap: { marginLeft: 10, padding: 4 },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 40 },
});
