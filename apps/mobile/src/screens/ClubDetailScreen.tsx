import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { Colors } from "../theme/colors";
import { ArrowLeft, Send } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export const ClubDetailScreen = ({ route, navigation }: any) => {
  const { clubId, clubName } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const msgsQuery = useCachedQuery<any[]>(`club:msgs:${clubId}`, async () => {
    const res = await apiClient.get(`/clubs/${clubId}/messages`);
    return res.data;
  }, { ttlMs: 15000 });
  const messages = msgsQuery.data || [];

  useEffect(() => {
    const id = setInterval(() => msgsQuery.refresh(), 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    try {
      await apiClient.post(`/clubs/${clubId}/messages`, { content });
      msgsQuery.refresh();
    } catch (e) { showNotice({ title: "Error", message: "Could not send.", variant: "error" }); }
    finally { setSending(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]} numberOfLines={1}>{(clubName || "CLUB").toUpperCase()}</Text>
        <View style={{ width: 24, marginLeft: 16 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m: any) => {
          const mine = m.userId === user?.id;
          return (
            <View key={m.id} style={[styles.msgRow, mine && { justifyContent: "flex-end" }]}>
              <View style={[styles.bubble, mine
                ? { backgroundColor: theme.primary, borderBottomRightRadius: 4 }
                : { backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#f1f1f1", borderBottomLeftRadius: 4 }]}>
                {!mine && <Text style={[styles.msgUser, { color: theme.primary, fontFamily: fonts.heading }]}>{m.username}</Text>}
                <Text style={[styles.msgText, { color: mine ? Colors.accent : theme.black, fontFamily: fonts.body }]}>{m.content}</Text>
              </View>
            </View>
          );
        })}
        {messages.length === 0 && (
          <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No messages yet. Say hello!</Text>
        )}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 16 }]}>
          <TextInput
            style={[styles.input, { fontFamily: fonts.body, color: theme.black, backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#f5f5f5" }]}
            placeholder="Message the club..."
            placeholderTextColor={Colors.mutedTeal}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !draft.trim()}
            style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: sending || !draft.trim() ? 0.5 : 1 }]}
          >
            <Send size={18} color={Colors.accent} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  headerTitle: { fontSize: 16, color: Colors.accent, letterSpacing: 1, flex: 1, textAlign: "center" },
  backBtn: { marginRight: 16 },
  content: { flex: 1 },
  msgRow: { flexDirection: "row", marginBottom: 10 },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 16 },
  msgUser: { fontSize: 11, letterSpacing: 0.5, marginBottom: 4 },
  msgText: { fontSize: 14, lineHeight: 20 },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 60 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, marginLeft: 12, justifyContent: "center", alignItems: "center" },
});
