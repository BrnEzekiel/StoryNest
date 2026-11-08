import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { Colors } from "../theme/colors";
import { ArrowLeft, Plus, Users, Hash } from "lucide-react-native";
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

export const ClubsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();

  const clubsQuery = useCachedQuery<any[]>("clubs", async () => {
    const res = await apiClient.get("/clubs");
    return res.data;
  });
  const clubs = clubsQuery.data || [];

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || busy || !tapThrottle("clubs:create", TAP_GAP_MS)) return;
    setBusy(true);
    try {
      const res = await apiClient.post("/clubs", { name: name.trim(), description: description.trim() });
      setName(""); setDescription(""); setShowCreate(false);
      clubsQuery.refresh();
      showNotice({ title: "Club created", message: `Invite code: ${res.data.inviteCode}`, variant: "success" });
    } catch (e) { showNotice({ title: "Error", message: "Could not create club.", variant: "error" }); }
    finally { setBusy(false); }
  };

  const handleJoin = async (clubId: string) => {
    if (busy || !tapThrottle(`clubs:join:${clubId}`, TAP_GAP_MS)) return;
    setBusy(true);
    try {
      await apiClient.post(`/clubs/${clubId}/join`, {});
      clubsQuery.refresh();
      showNotice({ title: "Joined", message: "Welcome to the club.", variant: "success" });
    } catch (e: any) { showNotice({ title: "Error", message: e.response?.data?.error || "Could not join.", variant: "error" }); }
    finally { setBusy(false); }
  };

  const handleJoinByCode = async () => {
    const c = code.trim().toUpperCase();
    if (!c || busy) return;
    setBusy(true);
    try {
      const res = await apiClient.post("/clubs/lookup/join", { code: c });
      setCode("");
      clubsQuery.refresh();
      navigation.navigate("ClubDetail", { clubId: res.data.clubId, clubName: "Club" });
    } catch (e) { showNotice({ title: "Invalid code", message: "No club uses that code.", variant: "error" }); }
    finally { setBusy(false); }
  };

  const openClub = (club: any) => {
    if (!club.isMember) { handleJoin(club.id); return; }
    navigation.navigate("ClubDetail", { clubId: club.id, clubName: club.name });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>BOOK CLUBS</Text>
        {canCreateContent(user?.role) ? (
          <TouchableOpacity onPress={() => setShowCreate((v) => !v)} style={styles.addBtn}>
            <Plus size={24} color={Colors.accent} />
          </TouchableOpacity>
        ) : <View style={styles.addBtn} />}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={clubsQuery.refreshing} onRefresh={() => clubsQuery.refresh({ showIndicator: true })} tintColor={Colors.accent} />}
      >
        {showCreate && (
          <View style={[styles.card, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : Colors.paleGreen }]}>
            <TextField label="Club name" value={name} onChangeText={setName} placeholder="e.g. Nairobi Night Readers" />
            <TextField label="Description" value={description} onChangeText={setDescription} placeholder="What will you read together?" multiline style={{ height: 90, textAlignVertical: "top" }} />
            <Button title={busy ? "CREATING..." : "CREATE CLUB"} onPress={handleCreate} disabled={busy} type="primary" />
          </View>
        )}

        <View style={styles.joinRow}>
          <View style={{ flex: 1 }}>
            <TextField label="Invite code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="e.g. A1B2C3D4" autoCapitalize="characters" />
          </View>
          <TouchableOpacity style={[styles.joinCodeBtn, { backgroundColor: theme.primary }]} onPress={handleJoinByCode}>
            <Hash size={18} color={Colors.accent} />
          </TouchableOpacity>
        </View>

        {clubsQuery.isFirstLoad && clubs.length === 0 ? (
          <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>Finding clubs...</Text>
        ) : clubs.length === 0 ? (
          <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No clubs yet. Start the first one!</Text>
        ) : clubs.map((club: any) => (
          <TouchableOpacity
            key={club.id}
            style={[styles.clubRow, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : Colors.white, borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}
            onPress={() => openClub(club)}
          >
            <View style={[styles.clubIcon, { backgroundColor: theme.primary + "15" }]}>
              <Users size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.clubName, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{club.name}</Text>
              <Text style={[styles.clubMeta, { fontFamily: fonts.body }]} numberOfLines={1}>
                {club.memberCount} member{club.memberCount === 1 ? "" : "s"}{club.description ? ` • ${club.description}` : ""}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: club.isMember ? Colors.paleGreen : theme.primary }]}>
              <Text style={[styles.badgeText, { fontFamily: fonts.heading, color: club.isMember ? Colors.primary : Colors.accent }]}>
                {club.isMember ? "OPEN" : "JOIN"}
              </Text>
            </View>
          </TouchableOpacity>
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
  addBtn: { marginLeft: 16, width: 24 },
  content: { flex: 1, padding: 24 },
  card: { borderRadius: 16, padding: 16, marginBottom: 20 },
  joinRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 8 },
  joinCodeBtn: { width: 52, height: 52, borderRadius: 12, marginLeft: 12, marginBottom: 20, justifyContent: "center", alignItems: "center" },
  clubRow: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  clubIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  clubName: { fontSize: 15 },
  clubMeta: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 },
  badge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, marginLeft: 10 },
  badgeText: { fontSize: 11, letterSpacing: 1 },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 40 },
});
