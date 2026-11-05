import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  BookOpen, Heart, MessageCircle, Bookmark, Send, ListMusic,
  Mic, Unlock, Gift, BellOff,
} from "lucide-react-native";
import { Colors } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/apiClient";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { ActivityLog, JournalEntry, ActivityKind } from "../utils/activityLog";
import { SkeletonCard } from "../components/SkeletonCard";

interface FeedRow {
  id: string;
  ts: number;
  title: string;
  sub?: string;
  storyId?: string;
  coverUrl?: string;
  icon: React.ReactNode;
  unread?: boolean;
  onPress?: () => void;
}

const timeAgo = (ts: number): string => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};

const KIND_COPY: Record<ActivityKind, (e: JournalEntry) => { title: string; sub?: string }> = {
  READ: (e) => ({ title: `You read "${e.title}"`, sub: e.sub }),
  LIKE: (e) => ({ title: `You liked "${e.title}"`, sub: e.sub }),
  COMMENT: (e) => ({ title: `You commented on "${e.title}"`, sub: e.sub }),
  BOOKMARK: (e) => ({ title: `You saved "${e.title}"`, sub: e.sub }),
  MESSAGE: (e) => ({ title: `You messaged ${e.title}`, sub: e.sub }),
  PLAYLIST: (e) => ({ title: `You created the playlist "${e.title}"`, sub: e.sub }),
  PODCAST: (e) => ({ title: `You played "${e.title}"`, sub: e.sub }),
  UNLOCK: (e) => ({ title: `You unlocked "${e.title}"`, sub: e.sub }),
  REFERRAL: (e) => ({ title: e.title, sub: e.sub }),
  PUBLISH: (e) => ({ title: `You published "${e.title}"`, sub: e.sub }),
};

export const ActivityFeedScreen = ({ navigation }: any) => {
  const { theme, fonts, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [journalReady, setJournalReady] = useState(false);

  // On-device journal paints instantly; reload whenever the screen gains focus.
  const loadJournal = useCallback(async () => {
    setJournal(await ActivityLog.list());
    setJournalReady(true);
  }, []);
  useFocusEffect(useCallback(() => { loadJournal(); }, [loadJournal]));

  // Chats share the Messages screen cache, so they paint instantly too.
  const convosQuery = useCachedQuery<any[]>("messages:conversations", async () => {
    const res = await apiClient.get("/messages/conversations");
    return Array.isArray(res.data) ? res.data : [];
  }, { ttlMs: 60 * 1000 });

  // Server-side feed (best effort: lights up automatically if the backend adds it).
  const serverQuery = useCachedQuery<any[]>("activity:server", async () => {
    try {
      const res = await apiClient.get("/activity/feed");
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }, { ttlMs: 2 * 60 * 1000 });

  const iconFor = (kind: ActivityKind): React.ReactNode => {
    switch (kind) {
      case "READ": return <BookOpen size={18} color={Colors.accent} />;
      case "LIKE": return <Heart size={18} color="#FF6B6B" />;
      case "COMMENT": return <MessageCircle size={18} color="#4EA8DE" />;
      case "BOOKMARK": return <Bookmark size={18} color={Colors.accent} />;
      case "MESSAGE": return <Send size={18} color="#4EA8DE" />;
      case "PLAYLIST": return <ListMusic size={18} color={Colors.accent} />;
      case "PODCAST": return <Mic size={18} color="#B388EB" />;
      case "PUBLISH": return <Mic size={18} color={Colors.accent} />;
      case "UNLOCK": return <Unlock size={18} color="#4EA8DE" />;
      case "REFERRAL": return <Gift size={18} color={Colors.accent} />;
    }
  };

  const rows: FeedRow[] = [
    ...journal.map((e): FeedRow => {
      const copy = KIND_COPY[e.kind](e);
      return {
        id: `j-${e.id}`,
        ts: e.ts,
        title: copy.title,
        sub: copy.sub,
        storyId: e.storyId,
        coverUrl: e.coverUrl,
        icon: iconFor(e.kind),
        onPress: e.storyId
          ? () => navigation.navigate("Reader", { storyId: e.storyId })
          : e.kind === "MESSAGE"
            ? () => navigation.navigate("Messages")
            : undefined,
      };
    }),
    ...(convosQuery.data || []).map((c: any): FeedRow => ({
      id: `c-${c.user?.id}`,
      ts: c.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt).getTime() : 0,
      title: c.user?.username || "Chat",
      sub: c.lastMessage?.content
        ? (c.lastMessage.content.length > 90 ? c.lastMessage.content.slice(0, 90) + "..." : c.lastMessage.content)
        : "New conversation",
      icon: <Send size={18} color="#4EA8DE" />,
      unread: !!c.hasUnread,
      onPress: () => navigation.navigate("Messages"),
    })),
    ...(serverQuery.data || []).map((a: any, i: number): FeedRow => ({
      id: `s-${a.id || i}`,
      ts: a.createdAt ? new Date(a.createdAt).getTime() : 0,
      title: a.text || a.title || "Update",
      sub: a.story?.title,
      storyId: a.storyId || a.story?.id,
      icon: <BookOpen size={18} color={Colors.accent} />,
      onPress: (a.storyId || a.story?.id)
        ? () => navigation.navigate("Reader", { storyId: a.storyId || a.story?.id })
        : undefined,
    })),
  ]
    .filter((r) => r.ts > 0)
    .sort((a, b) => b.ts - a.ts);

  const refreshing = convosQuery.refreshing;
  const showSkeletons = !journalReady || (journal.length === 0 && convosQuery.isFirstLoad && rows.length === 0);
  const notificationsOff = !!user && user.notificationsOn === false;

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <View style={[styles.header, { backgroundColor: Colors.primary }]}>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>ACTIVITY</Text>
        <Text style={[styles.headerSub, { fontFamily: fonts.body }]}>Everything you do, as it happens</Text>
      </View>

      {notificationsOff && (
        <TouchableOpacity
          style={[styles.noticeBar, { backgroundColor: isDarkMode ? "rgba(255,237,168,0.08)" : Colors.paleGreen }]}
          onPress={() => navigation.navigate("Settings")}
          activeOpacity={0.8}
        >
          <BellOff size={16} color={Colors.mutedTeal} />
          <Text style={[styles.noticeText, { fontFamily: fonts.body }]}>
            Notifications are off. Turn them on in Settings to get alerts.
          </Text>
        </TouchableOpacity>
      )}

      {showSkeletons ? (
        <View style={styles.listContent}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { loadJournal(); convosQuery.refresh(); serverQuery.refresh(); }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { fontFamily: fonts.heading, color: theme.black }]}>Your nest is quiet... for now</Text>
              <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>
                Stories you read, like, save, and talk about land here automatically.
              </Text>
              <TouchableOpacity
                style={[styles.browseBtn, { backgroundColor: Colors.primary }]}
                onPress={() => navigation.navigate("Explore")}
              >
                <Text style={[styles.browseText, { fontFamily: fonts.heading }]}>FIND A STORY</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : Colors.paleGreen }]}
              onPress={item.onPress}
              disabled={!item.onPress}
              activeOpacity={0.8}
            >
              {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.cover} />
              ) : (
                <View style={[styles.iconWrap, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#FFFFFF" }]}>
                  {item.icon}
                </View>
              )}
              <View style={styles.textWrap}>
                <Text style={[styles.title, { fontFamily: fonts.heading, color: theme.black }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {!!item.sub && (
                  <Text style={[styles.sub, { fontFamily: fonts.body }]} numberOfLines={2}>{item.sub}</Text>
                )}
                <Text style={[styles.time, { fontFamily: fonts.body }]}>{timeAgo(item.ts)}</Text>
              </View>
              {!!item.unread && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTitle: { color: Colors.accent, fontSize: 26, letterSpacing: 1 },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 },
  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
  },
  noticeText: { flex: 1, fontSize: 12, color: Colors.mutedTeal, lineHeight: 18 },
  listContent: { padding: 20, gap: 12 },
  card: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 14 },
  cover: { width: 48, height: 68, borderRadius: 8, marginRight: 14 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginRight: 14 },
  textWrap: { flex: 1 },
  title: { fontSize: 14, lineHeight: 20 },
  sub: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11, color: Colors.mutedTeal, marginTop: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent, marginLeft: 8 },
  emptyWrap: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, textAlign: "center", marginBottom: 8 },
  emptyText: { fontSize: 13, color: Colors.mutedTeal, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  browseBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  browseText: { color: Colors.accent, fontSize: 13, letterSpacing: 1 },
});
