import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Modal, TextInput, RefreshControl, Dimensions, KeyboardAvoidingView, Share } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { useAuth } from "../context/AuthContext";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Trash2, Edit2, ArrowLeft, Camera, ChevronDown, Plus, X, FolderPlus, Zap, Bold, Italic, Heading, Quote, List, Eye, Edit3, Globe, Sparkles, Wand2, History, RotateCcw, UserPlus, Users, FileText, BarChart3, RefreshCw, Image as ImageIcon } from "lucide-react-native";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { SkeletonCard } from "../components/SkeletonCard";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { tapThrottle, TAP_GAP_MS } from "../utils/rateLimit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { validateStoryCover } from "../utils/storyCover";

const { width } = Dimensions.get("window");

// Instant cover presets for writers without artwork (deterministic picsum seeds).
const COVER_PRESETS = [
  { name: "Mist", url: "https://picsum.photos/seed/storynest-mist/800/450" },
  { name: "Ember", url: "https://picsum.photos/seed/storynest-ember/800/450" },
  { name: "Tide", url: "https://picsum.photos/seed/storynest-tide/800/450" },
  { name: "Thorn", url: "https://picsum.photos/seed/storynest-thorn/800/450" },
  { name: "Dusk", url: "https://picsum.photos/seed/storynest-dusk/800/450" },
  { name: "Neon", url: "https://picsum.photos/seed/storynest-neon/800/450" },
  { name: "Savanna", url: "https://picsum.photos/seed/storynest-savanna/800/450" },
  { name: "Storm", url: "https://picsum.photos/seed/storynest-storm/800/450" },
];

const OPS_TABS = ["reports", "users", "flags", "errors", "announce", "schedule", "stats", "bulk"] as const;
const BULK_ACTIONS = ["publish", "unlist", "feature", "unfeature", "tag", "delete"] as const;

const AdminOpsSection = ({ theme, fonts, isDarkMode }: any) => {
  const [tab, setTab] = useState<(typeof OPS_TABS)[number] | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [csvIds, setCsvIds] = useState<string[]>([]);
  const [csvName, setCsvName] = useState("");
  const [bulkAction, setBulkAction] = useState<(typeof BULK_ACTIONS)[number]>("feature");
  const [bulkGenre, setBulkGenre] = useState("");

  const load = async (t: (typeof OPS_TABS)[number]) => {
    setTab(t);
    setErr("");
    if (t === "announce" || t === "bulk") {
      setItems([]);
      return;
    }
    if (t === "stats") {
      setLoading(true);
      try {
        const res = await apiClient.get("/admin/analytics");
        setStats(res.data);
      } catch (e: any) {
        setErr(e?.response?.data?.error || "Failed to load");
        setStats(null);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (t === "schedule") {
      setLoading(true);
      try {
        const res = await apiClient.get("/admin/scheduled");
        const rows = [
          ...(res.data.stories || []).map((s: any) => ({ id: s.id, label: `STORY ${s.title} → ${new Date(s.publishedAt).toLocaleString()}` })),
          ...(res.data.chapters || []).map((c: any) => ({ id: c.id, label: `CHAPTER ${c.title} → ${new Date(c.publishedAt).toLocaleString()}` })),
          ...(res.data.featured || []).map((s: any) => ({ id: s.id, label: `FEATURED ${s.title}${s.featuredUntil ? ` until ${new Date(s.featuredUntil).toLocaleDateString()}` : " (no end)"}` })),
        ];
        setItems(rows);
      } catch (e: any) {
        setErr(e?.response?.data?.error || "Failed to load");
        setItems([]);
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const url = t === "users" && query ? `/admin/users?q=${encodeURIComponent(query)}` : `/admin/${t}`;
      const res = await apiClient.get(url);
      const list = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.reports || res.data?.errors || res.data?.flags || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const act = async (method: "post" | "delete", url: string, payload?: any) => {
    setErr("");
    try {
      await apiClient[method](url, payload);
      if (tab) await load(tab);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Action failed");
    }
  };

  const submitAnnounce = () =>
    act("post", "/admin/announcements", { title, body }).then(() => {
      setTitle("");
      setBody("");
    });

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }}>
      <Text style={{ fontFamily: fonts.heading, color: theme.primary, fontSize: 13, marginBottom: 8 }}>MODERATION & OPS</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {OPS_TABS.map((t) => (
          <TouchableOpacity key={t} onPress={() => load(t)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: tab === t ? theme.primary : theme.white, borderWidth: 1, borderColor: theme.primary }} accessibilityLabel={`Admin ${t}`} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: tab === t ? "#fff" : theme.primary }}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === "users" && (
        <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search username" placeholderTextColor={Colors.mutedTeal} autoCapitalize="none" style={{ flex: 1, borderWidth: 1, borderColor: Colors.mutedTeal, borderRadius: 8, padding: 8, color: theme.black, fontFamily: fonts.body }} />
          <TouchableOpacity onPress={() => load("users")} style={{ padding: 10, borderRadius: 8, backgroundColor: theme.primary }}>
            <Text style={{ color: "#fff", fontFamily: fonts.body, fontSize: 12 }}>GO</Text>
          </TouchableOpacity>
        </View>
      )}
      {!!err && <Text style={{ color: "red", fontFamily: fonts.body, fontSize: 12, marginTop: 8 }}>{err}</Text>}
      {loading && <Text style={{ fontFamily: fonts.body, color: theme.black, marginTop: 8 }}>Loading…</Text>}
      {!loading && (tab === "reports" || tab === "users" || tab === "flags" || tab === "errors" || tab === "schedule") && (
        <View style={{ marginTop: 8, gap: 8 }}>
          {items.length === 0 && <Text style={{ fontFamily: fonts.body, color: Colors.mutedTeal, fontSize: 12 }}>No items.</Text>}
          {items.map((it: any, i: number) => (
            <View key={it.id || i} style={{ borderWidth: 1, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen, borderRadius: 8, padding: 8 }}>
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.black }} numberOfLines={3}>
                {tab === "reports" && `${it.reason || it.type} — ${it.status} — story ${it.storyId || it.targetId || "?"}`}
                {tab === "users" && `${it.username || it.email} ${it.isBanned ? "(BANNED)" : ""}`}
                {tab === "flags" && `${it.key}: ${it.enabled ? "ON" : "OFF"}${it.percent !== undefined && it.percent < 100 ? ` (${it.percent}%)` : ""}`}
                {tab === "errors" && `${it.message || it.path} — ${it.count || 1}x`}
                {tab === "schedule" && it.label}
              </Text>
              {tab === "reports" && it.status === "OPEN" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                  <TouchableOpacity onPress={() => act("post", `/admin/reports/${it.id}/resolve`, { action: "DISMISS" })} style={{ padding: 6, borderRadius: 6, backgroundColor: theme.primary }}><Text style={{ color: "#fff", fontSize: 11, fontFamily: fonts.body }}>Dismiss</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => act("post", `/admin/reports/${it.id}/resolve`, { action: "REMOVE" })} style={{ padding: 6, borderRadius: 6, backgroundColor: "#b45309" }}><Text style={{ color: "#fff", fontSize: 11, fontFamily: fonts.body }}>Remove</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => act("post", `/admin/reports/${it.id}/resolve`, { action: "BAN" })} style={{ padding: 6, borderRadius: 6, backgroundColor: "red" }}><Text style={{ color: "#fff", fontSize: 11, fontFamily: fonts.body }}>Ban user</Text></TouchableOpacity>
                </View>
              )}
              {tab === "users" && (
                <TouchableOpacity onPress={() => act("post", `/admin/users/${it.id}/ban`, { banned: !it.isBanned })} style={{ marginTop: 6, padding: 6, borderRadius: 6, backgroundColor: it.isBanned ? theme.primary : "red", alignSelf: "flex-start" }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontFamily: fonts.body }}>{it.isBanned ? "Unban" : "Ban"}</Text>
                </TouchableOpacity>
              )}
              {tab === "flags" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                  <TouchableOpacity onPress={() => act("post", "/admin/flags", { key: it.key, enabled: !it.enabled, percent: it.percent ?? 100 })} style={{ padding: 6, borderRadius: 6, backgroundColor: theme.primary }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontFamily: fonts.body }}>Turn {it.enabled ? "OFF" : "ON"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const cur = it.percent ?? 100;
                      const next = cur >= 100 ? 50 : cur > 10 ? 10 : 100;
                      act("post", "/admin/flags", { key: it.key, enabled: true, percent: next });
                    }}
                    style={{ padding: 6, borderRadius: 6, backgroundColor: Colors.mutedTeal }}
                  >
                    <Text style={{ color: "#fff", fontSize: 11, fontFamily: fonts.body }}>Rollout: {it.percent ?? 100}%</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      {tab === "stats" && stats && (
        <View style={{ marginTop: 8, gap: 6 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.black }}>DAU {stats.dau} · MAU {stats.mau} · 7-day retention {stats.retention7d === null ? "n/a" : `${stats.retention7d}%`}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.black }}>New users (7d): {stats.newUsers7d} · Totals: {stats.totals?.users} users / {stats.totals?.stories} stories</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.black }}>Reads by genre: {Object.entries(stats.readsPerGenre || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([g, n]) => `${g} ${n}`).join(" · ") || "—"}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.black }}>Revenue (30d): {Object.entries(stats.revenueByCurrency || {}).map(([c, n]) => `${c} ${n}`).join(" · ") || "—"} ({stats.totals?.purchases30d || 0} purchases)</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.black }}>Revenue by day: {Object.entries(stats.revenueByDay || {}).sort().slice(-7).map(([d, n]) => `${d.slice(5)}:${n}`).join(" ") || "—"}</Text>
        </View>
      )}
      {tab === "announce" && (
        <View style={{ marginTop: 8, gap: 8 }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="Announcement title" placeholderTextColor={Colors.mutedTeal} style={{ borderWidth: 1, borderColor: Colors.mutedTeal, borderRadius: 8, padding: 8, color: theme.black, fontFamily: fonts.body }} />
          <TextInput value={body} onChangeText={setBody} placeholder="Body" placeholderTextColor={Colors.mutedTeal} multiline style={{ borderWidth: 1, borderColor: Colors.mutedTeal, borderRadius: 8, padding: 8, minHeight: 70, color: theme.black, fontFamily: fonts.body }} />
          <Button title="SEND ANNOUNCEMENT" onPress={submitAnnounce} type="primary" />
        </View>
      )}
      {tab === "schedule" && (
        <View style={{ marginTop: 8, gap: 8 }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="Story ID" placeholderTextColor={Colors.mutedTeal} autoCapitalize="none" style={{ borderWidth: 1, borderColor: Colors.mutedTeal, borderRadius: 8, padding: 8, color: theme.black, fontFamily: fonts.body }} />
          <TextInput value={body} onChangeText={setBody} placeholder="Publish at (YYYY-MM-DD HH:mm)" placeholderTextColor={Colors.mutedTeal} style={{ borderWidth: 1, borderColor: Colors.mutedTeal, borderRadius: 8, padding: 8, color: theme.black, fontFamily: fonts.body }} />
          <Button title="SCHEDULE PUBLISH" onPress={() => act("post", `/admin/stories/${title.trim()}/schedule`, { publishAt: body.trim() })} type="primary" />
        </View>
      )}
      {tab === "bulk" && (
        <View style={{ marginTop: 8, gap: 8 }}>
          <TouchableOpacity
            onPress={async () => {
              try {
                const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "text/plain"], copyToCacheDirectory: true });
                if (res.canceled || !res.assets?.[0]) return;
                const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
                const ids = [...new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^[0-9a-f-]{8,}$/i.test(s)))].slice(0, 100);
                setCsvIds(ids);
                setCsvName(res.assets[0].name || "file.csv");
                if (ids.length === 0) setErr("No story ids found in that file.");
              } catch { setErr("Could not read that file."); }
            }}
            style={{ padding: 10, borderRadius: 8, backgroundColor: theme.primary, alignItems: "center" }}
            accessibilityLabel="Pick CSV of story ids"
          >
            <Text style={{ color: "#fff", fontFamily: fonts.body, fontSize: 12 }}>{csvName ? `${csvName} (${csvIds.length} ids)` : "PICK CSV OF STORY IDS"}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {BULK_ACTIONS.map((a) => (
              <TouchableOpacity key={a} onPress={() => setBulkAction(a)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: bulkAction === a ? theme.primary : theme.white, borderWidth: 1, borderColor: theme.primary }}>
                <Text style={{ fontFamily: fonts.body, fontSize: 11, color: bulkAction === a ? "#fff" : theme.primary }}>{a.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {bulkAction === "tag" && (
            <TextInput value={bulkGenre} onChangeText={setBulkGenre} placeholder="Genre to apply" placeholderTextColor={Colors.mutedTeal} style={{ borderWidth: 1, borderColor: Colors.mutedTeal, borderRadius: 8, padding: 8, color: theme.black, fontFamily: fonts.body }} />
          )}
          <Button
            title={`RUN ${bulkAction.toUpperCase()} ON ${csvIds.length} ${csvIds.length === 1 ? "STORY" : "STORIES"}`}
            onPress={() => act("post", "/admin/stories/bulk", { ids: csvIds, action: bulkAction, genre: bulkGenre || undefined })}
            type="primary"
          />
        </View>
      )}
    </View>
  );
};

export const AdminScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme, isDarkMode } = useTheme();
  const { showNotice } = useNotice();
  const { user } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const adminQuery = useCachedQuery<{ stories: any[]; stats: any }>("admin:dashboard", async () => {
    try {
      const [storiesRes, statsRes] = await Promise.all([
        apiClient.get("/admin/my-stories"),
        apiClient.get("/admin/stats")
      ]);
      return { stories: storiesRes.data, stats: statsRes.data };
    } catch {
      // Fallback until the backend ships the admin endpoints: list from the
      // public catalog filtered to this author.
      const res = await apiClient.get("/stories");
      const all = Array.isArray(res.data) ? res.data : [];
      const mine = user ? all.filter((s: any) => s.ownerId === user.id) : [];
      const list = user?.role === "ADMIN" ? all : mine;
      return {
        stories: list,
        stats: {
          storyCount: list.length,
          totalReads: list.reduce((n: number, s: any) => n + (s.readCount || 0), 0),
          userCount: 0,
        },
      };
    }
  });
  const stories = adminQuery.data?.stories || [];
  const stats = adminQuery.data?.stats || { storyCount: 0, totalReads: 0, userCount: 0 };
  const isFirstLoad = adminQuery.isFirstLoad && !adminQuery.data;

  // Editor State
  const [availableGenres, setAvailableGenres] = useState(["Fiction", "Romance", "Thriller", "Faith", "Mystery", "Poetry", "Sci-Fi"]);
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabUsername, setCollabUsername] = useState("");
  const [collabLoading, setCollabLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Fiction");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [contentWarnings, setContentWarnings] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [presetCover, setPresetCover] = useState<string | null>(null);

  // Beta readers
  const [showBetaModal, setShowBetaModal] = useState(false);
  const [betaStoryId, setBetaStoryId] = useState<string | null>(null);
  const [betaCodes, setBetaCodes] = useState<any[]>([]);
  const [betaLoading, setBetaLoading] = useState(false);

  const fetchAdminData = () => adminQuery.refresh();

  const onRefresh = useCallback(() => {
    if (!tapThrottle("admin:refresh", TAP_GAP_MS)) return;
    adminQuery.refresh({ showIndicator: true });
  }, [adminQuery]);

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!title || !genre || !authorName) {
      showNotice({ title: "Error", message: "Please fill in all required fields.", variant: "error" });
      return;
    }
    const coverError = validateStoryCover({ isEditing, coverUri: coverUri || presetCover, existingCoverUrl });
    if (coverError) {
      showNotice({ title: "Cover Required", message: coverError, variant: "error" });
      return;
    }
    if (submitLoading || !tapThrottle("admin:save", TAP_GAP_MS)) return;
    setSubmitLoading(true);
    try {
      const preset = !coverUri && presetCover ? COVER_PRESETS.find((p) => p.url === presetCover) : null;
      if (coverUri) {
        // Newly picked image: multipart upload, the server stores it as coverUrl.
        const formData = new FormData();
        formData.append("title", title);
        formData.append("genre", genre);
        formData.append("authorName", authorName);
        formData.append("summary", "");
        formData.append("contentWarnings", contentWarnings);
        formData.append("isAdult", isAdult ? "true" : "false");
        if (body) formData.append("body", body);
        const filename = coverUri.split('/').pop() || 'cover.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        // @ts-ignore
        formData.append("cover", { uri: coverUri, name: filename, type });
        const headers = { 'Content-Type': 'multipart/form-data' };
        if (isEditing && editingId) {
          await apiClient.put(`/stories/${editingId}`, formData, { headers });
        } else {
          await apiClient.post("/stories", formData, { headers });
        }
      } else {
        // Preset cover or edit without a new pick: plain JSON payload.
        const payload: any = { title, genre, authorName, summary: "", contentWarnings, isAdult, ...(body ? { body } : {}) };
        if (preset) {
          payload.coverUrl = preset.url;
          payload.coverTheme = preset.name;
        }
        if (isEditing && editingId) {
          await apiClient.put(`/stories/${editingId}`, payload);
        } else {
          await apiClient.post("/stories", payload);
        }
      }

      showNotice({ title: "Success", message: `Story ${isEditing ? 'updated' : 'published'} successfully!`, variant: "success" });
      setIsAdding(false);
      setIsEditing(false);
      resetForm();
      fetchAdminData();
    } catch (error: any) {
      console.error("[Admin] Save Error:", error.response?.data || error.message);
      showNotice({ title: "Error", message: "Action failed. Check your connection.", variant: "error" });
    } finally { setSubmitLoading(false); }
  };

  const startEdit = (story: any) => {
    setTitle(story.title);
    setGenre(story.genre);
    setAuthorName(story.authorName);
    setEditingId(story.id);
    setIsEditing(true);
    setIsAdding(true);
    setCoverUri(null);
    setExistingCoverUrl(story.coverUrl || null);
    setContentWarnings(story.contentWarnings || "");
    setIsAdult(!!story.isAdult);
    setPresetCover(null);
  };

  const resetForm = () => {
    setTitle(""); setGenre("Fiction"); setBody(""); setAuthorName(""); setEditingId(null); setIsEditing(false);
    setCoverUri(null); setExistingCoverUrl(null);
    setContentWarnings(""); setIsAdult(false); setPresetCover(null);
  };

  const openBeta = async (storyId: string) => {
    setBetaStoryId(storyId);
    setShowBetaModal(true);
    setBetaLoading(true);
    try {
      const res = await apiClient.get(`/stories/${storyId}/beta-invites`);
      setBetaCodes(res.data);
    } catch (e) { setBetaCodes([]); }
    finally { setBetaLoading(false); }
  };

  const handleCreateBetaCode = async () => {
    if (!betaStoryId || betaLoading) return;
    setBetaLoading(true);
    try {
      const res = await apiClient.post(`/stories/${betaStoryId}/beta-invites`);
      setBetaCodes([res.data, ...betaCodes]);
    } catch (e) { showNotice({ title: "Error", message: "Could not create code.", variant: "error" }); }
    finally { setBetaLoading(false); }
  };

  const handleShareBetaCode = async (code: string) => {
    try {
      await Share.share({ message: `Read my story early on StoryNest! Enter beta code ${code} in Explore to unlock it.` });
    } catch (e) {}
  };

  const handleDelete = (id: string) => {
    showNotice({
      title: "Delete Story",
      message: "Are you sure?",
      variant: "error",
      actions: [
        { label: "Cancel", kind: "ghost" },
        { label: "Delete", kind: "destructive", onPress: async () => {
            try { await apiClient.delete(`/stories/${id}`); fetchAdminData(); } catch (e) { showNotice({ title: "Error", message: "Failed to delete.", variant: "error" }); }
        }},
      ],
    });
  };

  const fetchVersions = async (storyId: string) => {
      setVersionsLoading(true);
      setShowVersionHistory(true);
      try {
          const res = await apiClient.get(`/stories/${storyId}/versions`);
          setVersions(res.data);
          setEditingId(storyId);
      } catch (e) { console.log(e); }
      finally { setVersionsLoading(false); }
  };

  const handleRestoreVersion = async (version: any) => {
      if (!tapThrottle(`admin:restore:${version.id}`, TAP_GAP_MS)) return;
      try {
          await apiClient.post(`/versions/${version.id}/restore`);
          showNotice({ title: "Restored", message: "Content reverted.", variant: "success" });
          setShowVersionHistory(false);
          fetchAdminData();
      } catch (e) { showNotice({ title: "Error", message: "Failed.", variant: "error" }); }
  };

  const handleAddCollaborator = async () => {
      if (!collabUsername.trim()) return;
      if (collabLoading || !tapThrottle("admin:collab", TAP_GAP_MS)) return;
      setCollabLoading(true);
      try {
          await apiClient.post(`/stories/${editingId}/collaborators`, { username: collabUsername });
          showNotice({ title: "Added", message: `${collabUsername} is now a co-author.`, variant: "success" });
          setCollabUsername("");
          setShowCollabModal(false);
          fetchAdminData();
      } catch (e) { showNotice({ title: "Error", message: "Failed.", variant: "error" }); }
      finally { setCollabLoading(false); }
  };

  if (isAdding) {
    return (
      <View style={[styles.container, { backgroundColor: theme.white }]}>
        <StatusBar style="light" />
        <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
          <TouchableOpacity onPress={() => { setIsAdding(false); resetForm(); }} style={[styles.backBtnHeader, { top: insets.top + 20 }]}>
            <ArrowLeft size={24} color={Colors.accent} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>{isEditing ? 'EDIT STORY' : 'NEW STORY'}</Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
                <TextField label="Story Title" value={title} onChangeText={setTitle} placeholder="Enter title" />
                <TextField label="Author Name" value={authorName} onChangeText={setAuthorName} placeholder="Author name" />

                <Text style={[styles.dropdownLabel, { color: theme.primary, fontFamily: fonts.heading, marginTop: 10 }]}>GENRE</Text>
                <TouchableOpacity style={[styles.dropdown, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.lightForest }]} onPress={() => setShowGenreDropdown(!showGenreDropdown)}>
                    <Text style={[styles.dropdownText, { color: theme.black, fontFamily: fonts.body }]}>{genre}</Text>
                    <ChevronDown size={20} color={theme.primary} />
                </TouchableOpacity>

                {showGenreDropdown && (
                    <View style={[styles.dropdownMenu, { backgroundColor: isDarkMode ? "#1a2e2c" : Colors.white, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}>
                    {availableGenres.map((g) => (
                        <TouchableOpacity key={g} style={styles.dropdownItem} onPress={() => { setGenre(g); setShowGenreDropdown(false); }}>
                        <Text style={[styles.dropdownItemText, { color: theme.black, fontFamily: fonts.body }, g === genre && { color: Colors.accent, fontWeight: "700" }]}>{g}</Text>
                        </TouchableOpacity>
                    ))}
                    </View>
                )}

                <TextField label="Content Warnings (optional)" value={contentWarnings} onChangeText={setContentWarnings} placeholder="e.g. Violence, strong language" />
                <View style={styles.toggleRow}>
                    <Text style={[styles.dropdownLabel, { color: theme.primary, fontFamily: fonts.heading }]}>18+ ONLY</Text>
                    <TouchableOpacity
                        style={[styles.toggle, { backgroundColor: isAdult ? Colors.error : (isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen) }]}
                        onPress={() => setIsAdult((v) => !v)}
                    >
                        <Text style={[styles.toggleText, { fontFamily: fonts.heading }]}>{isAdult ? "ON" : "OFF"}</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.dropdownLabel, { color: theme.primary, fontFamily: fonts.heading, marginTop: 10 }]}>COVER IMAGE (REQUIRED)</Text>
                <TouchableOpacity
                    style={[styles.coverPicker, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.lightForest }]}
                    onPress={pickCover}
                    activeOpacity={0.8}
                >
                    {coverUri || existingCoverUrl ? (
                        <Image source={{ uri: (coverUri || existingCoverUrl) as string }} style={styles.coverPreview} resizeMode="cover" />
                    ) : (
                        <View style={styles.coverPlaceholder}>
                            <Camera size={28} color={Colors.mutedTeal} />
                            <Text style={[styles.coverHint, { fontFamily: fonts.body }]}>Tap to choose a cover image</Text>
                        </View>
                    )}
                    {(coverUri || existingCoverUrl) ? (
                        <View style={styles.coverBadge}>
                            <Text style={[styles.coverBadgeText, { fontFamily: fonts.heading }]}>TAP TO CHANGE</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>

                <Text style={[styles.dropdownLabel, { color: theme.primary, fontFamily: fonts.heading }]}>OR PICK A PRESET</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow}>
                    {COVER_PRESETS.map((p) => (
                        <TouchableOpacity
                            key={p.name}
                            style={[styles.presetThumb, presetCover === p.url && styles.presetSelected]}
                            onPress={() => { setPresetCover(presetCover === p.url ? null : p.url); setCoverUri(null); }}
                        >
                            <Image source={{ uri: p.url }} style={styles.presetImg} />
                            <Text style={[styles.presetName, { fontFamily: fonts.heading }]}>{p.name.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {!isEditing && (
                    <TextField label="First Chapter Content" value={body} onChangeText={setBody} placeholder="Once upon a time..." multiline style={{ height: 250, textAlignVertical: "top", marginTop: 20 }} />
                )}

                <View style={{ marginTop: 20, marginBottom: 40 }}>
                    <Button
                        title={submitLoading ? "OPTIMIZING & PUBLISHING..." : (isEditing ? "UPDATE STORY" : "PUBLISH TO NEST")}
                        onPress={handleSave}
                        type="primary"
                        disabled={submitLoading}
                    />
                    <Button title="CANCEL" onPress={() => { setIsAdding(false); resetForm(); }} type="ghost" style={{ marginTop: 12 }} />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtnHeader, { top: insets.top + 20 }]}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>CREATOR HUB</Text>
        <TouchableOpacity onPress={() => navigation.navigate("AuthorAnalytics")} style={styles.analyticsBtn}>
            <BarChart3 size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={adminQuery.refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
            <Text style={[styles.statValue, { color: theme.primary, fontFamily: fonts.heading }]}>{stats.storyCount}</Text>
            <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>Stories</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
            <Text style={[styles.statValue, { color: theme.primary, fontFamily: fonts.heading }]}>{stats.totalReads}</Text>
            <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>Reads</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
            <Text style={[styles.statValue, { color: theme.primary, fontFamily: fonts.heading }]}>{stats.userCount}</Text>
            <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>Users</Text>
          </View>
        </View>

        {user?.role === "ADMIN" && <AdminOpsSection theme={theme} fonts={fonts} isDarkMode={isDarkMode} />}

        <View style={styles.actionSection}>
          <Button title="UPLOAD NEW STORY" onPress={() => setIsAdding(true)} type="primary" style={{ marginBottom: 24 }} />
          <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>PUBLISHED WORKS</Text>
          <View style={{ paddingBottom: insets.bottom + 40 }}>
            {isFirstLoad ? [1, 2, 3].map(i => <SkeletonCard key={i} />) : (
              stories.map((story) => (
                <View key={story.id} style={[styles.storyRow, { borderBottomColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>
                  <View style={styles.storyInfo}>
                    <Text style={[styles.storyTitle, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{story.title}</Text>
                    <Text style={[styles.storyMeta, { fontFamily: fonts.body }]}>{story.genre}</Text>
                  </View>
                  <View style={styles.storyActions}>
                    <TouchableOpacity onPress={() => navigation.navigate("ManageChapters", { storyId: story.id, storyTitle: story.title })} style={styles.actionBtn}><FileText size={18} color={theme.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => startEdit(story)} style={styles.actionBtn}><Edit2 size={18} color={theme.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => fetchVersions(story.id)} style={styles.actionBtn}><History size={18} color={theme.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingId(story.id); setShowCollabModal(true); }} style={styles.actionBtn}><UserPlus size={18} color={theme.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => openBeta(story.id)} style={styles.actionBtn}><Users size={18} color={theme.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(story.id)} style={styles.actionBtn}><Trash2 size={18} color="red" /></TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            {!isFirstLoad && stories.length === 0 && <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No stories published yet.</Text>}
          </View>
        </View>
      </ScrollView>

      <Modal visible={showVersionHistory} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
              <View style={[styles.modalContent, { backgroundColor: theme.white, maxHeight: '80%' }]}>
                  <View style={styles.modalHeader}><Text style={[styles.modalTitle, { fontFamily: fonts.heading, color: theme.black }]}>VERSION HISTORY</Text><TouchableOpacity onPress={() => setShowVersionHistory(false)}><X size={20} color={theme.black} /></TouchableOpacity></View>
                  <ScrollView style={{ marginTop: 20 }}>{versions.map(v => (<View key={v.id} style={styles.versionItem}><View style={{ flex: 1 }}><Text style={styles.versionDate}>{new Date(v.createdAt).toLocaleString()}</Text><Text style={styles.versionSnippet} numberOfLines={2}>{v.body}</Text></View><TouchableOpacity style={styles.restoreBtn} onPress={() => handleRestoreVersion(v)}><RotateCcw size={18} color={theme.primary} /></TouchableOpacity></View>))}</ScrollView>
              </View>
          </View>
      </Modal>

      <Modal visible={showCollabModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
                  <View style={styles.modalHeader}><Text style={[styles.modalTitle, { fontFamily: fonts.heading, color: theme.black }]}>ADD CO-AUTHOR</Text><TouchableOpacity onPress={() => setShowCollabModal(false)}><X size={20} color={theme.black} /></TouchableOpacity></View>
                  <TextInput style={styles.modalInput} placeholder="Username" placeholderTextColor={Colors.mutedTeal} value={collabUsername} onChangeText={setCollabUsername} autoCapitalize="none" />
                  <Button title={collabLoading ? "ADDING..." : "INVITE"} onPress={handleAddCollaborator} disabled={collabLoading} type="primary" style={{ backgroundColor: theme.primary }} />
              </View>
          </View>
      </Modal>

      <Modal visible={showBetaModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.white, maxHeight: '80%' }]}>
                  <View style={styles.modalHeader}><Text style={[styles.modalTitle, { fontFamily: fonts.heading, color: theme.black }]}>BETA READERS</Text><TouchableOpacity onPress={() => setShowBetaModal(false)}><X size={20} color={theme.black} /></TouchableOpacity></View>
                  <Text style={[styles.betaHint, { fontFamily: fonts.body }]}>Share a code — readers enter it in Explore to read early.</Text>
                  <Button title={betaLoading ? "WORKING..." : "NEW BETA CODE"} onPress={handleCreateBetaCode} disabled={betaLoading} type="primary" style={{ marginBottom: 16 }} />
                  <ScrollView>
                      {betaCodes.map((c) => (
                          <TouchableOpacity key={c.id} style={styles.betaRow} onPress={() => handleShareBetaCode(c.code)}>
                              <Text style={[styles.betaCode, { fontFamily: fonts.heading, color: theme.primary }]}>{c.code}</Text>
                              <Text style={[styles.betaMeta, { fontFamily: fonts.body }]}>{c.redeemedById ? "Redeemed • tap to share" : "Tap to share"}</Text>
                          </TouchableOpacity>
                      ))}
                      {!betaLoading && betaCodes.length === 0 && <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No codes yet.</Text>}
                  </ScrollView>
              </View>
          </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingBottom: 24, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, color: Colors.accent, textAlign: "center", marginTop: 10, letterSpacing: 0.05 },
  backBtnHeader: { position: "absolute", left: 24 },
  analyticsBtn: { position: 'absolute', right: 24, top: 45 },
  content: { padding: 24 },
  dropdownLabel: { fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.05 },
  dropdown: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 8, marginBottom: 20, borderWidth: 0.5 },
  dropdownText: { fontSize: 14 },
  dropdownMenu: { borderRadius: 8, borderWidth: 1, marginTop: -15, marginBottom: 20, padding: 8, elevation: 4 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownItemText: { fontSize: 14 },
  coverPicker: { height: 190, borderRadius: 12, borderWidth: 0.5, marginBottom: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  coverPreview: { width: '100%', height: '100%' },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverHint: { fontSize: 13, color: Colors.mutedTeal, marginTop: 10 },
  coverBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  coverBadgeText: { fontSize: 10, color: Colors.white, letterSpacing: 1 },
  statsGrid: { flexDirection: "row", paddingHorizontal: 24, paddingVertical: 20, justifyContent: "space-between" },
  statBox: { width: "31%", padding: 12, borderRadius: 12, alignItems: "center" },
  statValue: { fontSize: 18 },
  statLabel: { fontSize: 10, color: Colors.mutedTeal },
  actionSection: { flex: 1, paddingHorizontal: 24 },
  sectionTitle: { fontSize: 16, marginBottom: 16 },
  storyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1 },
  storyInfo: { flex: 1 },
  storyTitle: { fontSize: 14 },
  storyMeta: { fontSize: 12, color: Colors.mutedTeal },
  storyActions: { flexDirection: "row" },
  actionBtn: { marginLeft: 15, padding: 4 },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 24, padding: 24, ...Shadows.m },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 16, letterSpacing: 1 },
  modalInput: { height: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, marginBottom: 20, fontSize: 16 },
  versionItem: { flexDirection: 'row', padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)' },
  versionDate: { fontSize: 12, marginBottom: 4 },
  versionSnippet: { fontSize: 11, opacity: 0.7 },
  restoreBtn: { padding: 8, marginLeft: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  toggle: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  toggleText: { fontSize: 12, color: '#FFFFFF', letterSpacing: 1 },
  presetRow: { marginBottom: 20 },
  presetThumb: { width: 140, marginRight: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  presetSelected: { borderColor: Colors.accent },
  presetImg: { width: '100%', height: 80 },
  presetName: { fontSize: 10, textAlign: 'center', paddingVertical: 6, letterSpacing: 1 },
  betaHint: { fontSize: 13, color: Colors.mutedTeal, marginBottom: 16 },
  betaRow: { padding: 16, borderRadius: 12, marginBottom: 12, backgroundColor: 'rgba(0,0,0,0.03)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  betaCode: { fontSize: 15, letterSpacing: 1 },
  betaMeta: { fontSize: 11, color: Colors.mutedTeal },
});
