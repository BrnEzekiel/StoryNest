import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList, Dimensions, Alert, Modal } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Send, Search, MoreVertical, CheckCheck, Edit2, Trash2, X } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const { width } = Dimensions.get("window");

export const MessagesScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, setHasUnreadMessages } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();
  
  const { targetUser } = route.params || {};

  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(targetUser || null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // CRUD States
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showOptions, setShowOptions] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
      if (activeChat) {
          fetchMessages(activeChat.id);
          markAllAsRead(activeChat.id);
      } else {
          fetchConversations();
      }
  }, [activeChat]);

  const fetchConversations = async () => {
      setLoading(true);
      try {
          const res = await apiClient.get("/messages/conversations");
          setConversations(res.data);
      } catch (e) { console.log(e); }
      finally { setLoading(false); }
  };

  const fetchMessages = async (userId: string) => {
      setLoading(true);
      try {
          const res = await apiClient.get(`/messages/${userId}`);
          setMessages(res.data);
          setTimeout(() => flatListRef.current?.scrollToEnd(), 200);
      } catch (e) { console.log(e); }
      finally { setLoading(false); }
  };

  const markAllAsRead = async (userId: string) => {
      try {
          await apiClient.patch(`/messages/read-all/${userId}`);
          setHasUnreadMessages(false);
      } catch (e) {}
  };

  const handleSendMessage = async () => {
      if (!newMessage.trim() || !activeChat) return;
      setSending(true);
      try {
          const res = await apiClient.post("/messages", {
              receiverId: activeChat.id,
              content: newMessage.trim()
          });
          setMessages([...messages, res.data]);
          setNewMessage("");
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
      } catch (e) { console.log(e); }
      finally { setSending(false); }
  };

  const handleDeleteMessage = async (id: string) => {
      try {
          await apiClient.delete(`/messages/${id}`);
          setMessages(messages.filter(m => m.id !== id));
          setShowOptions(false);
      } catch (e) { Alert.alert("Error", "Could not delete message."); }
  };

  const handleUpdateMessage = async () => {
      if (!editContent.trim()) return;
      try {
          const res = await apiClient.put(`/messages/${selectedMessage.id}`, { content: editContent.trim() });
          setMessages(messages.map(m => m.id === selectedMessage.id ? res.data : m));
          setIsEditing(false);
          setSelectedMessage(null);
      } catch (e) { Alert.alert("Error", "Could not update message."); }
  };

  const clearConversation = () => {
      Alert.alert("Clear Chat", "This will delete all messages in this conversation. Continue?", [
          { text: "Cancel", style: "cancel" },
          { 
              text: "Clear", 
              style: "destructive", 
              onPress: async () => {
                  try {
                      await apiClient.delete(`/messages/conversations/${activeChat.id}`);
                      setMessages([]);
                  } catch (e) {}
              }
          }
      ]);
  };

  const openOptions = (msg: any) => {
      if (msg.senderId !== user?.id) return; // Only CRUD own messages
      setSelectedMessage(msg);
      setShowOptions(true);
  };

  if (!activeChat) {
      return (
          <View style={[styles.container, { backgroundColor: theme.white }]}>
              <StatusBar style="light" />
              <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
                  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><ArrowLeft size={24} color={Colors.accent} /></TouchableOpacity>
                  <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>MESSAGES</Text>
              </View>
              
              <ScrollView style={styles.listContent}>
                  {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} /> : (
                      conversations.length === 0 ? (
                          <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No conversations yet.</Text>
                      ) : (
                          conversations.map(conv => (
                              <TouchableOpacity 
                                key={conv.user.id} 
                                style={[styles.convItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                                onPress={() => setActiveChat(conv.user)}
                              >
                                  <View style={styles.avatarLarge}>
                                      {conv.user.avatarUrl ? <Image source={{ uri: conv.user.avatarUrl }} style={styles.img} /> : <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '20' }]}><Text style={styles.avatarText}>{conv.user.username[0].toUpperCase()}</Text></View>}
                                  </View>
                                  <View style={{ flex: 1, marginLeft: 16 }}>
                                      <View style={styles.convHeader}>
                                          <Text style={[styles.convName, { color: theme.black, fontFamily: fonts.heading }]}>{conv.user.username}</Text>
                                          <Text style={[styles.convTime, { fontFamily: fonts.body }]}>{new Date(conv.lastMessage.createdAt).toLocaleDateString()}</Text>
                                      </View>
                                      <Text style={[styles.convPreview, { fontFamily: fonts.body, color: conv.lastMessage.isRead || conv.lastMessage.senderId === user?.id ? Colors.mutedTeal : theme.primary, fontWeight: conv.lastMessage.isRead || conv.lastMessage.senderId === user?.id ? "normal" : "bold" }]} numberOfLines={1}>{conv.lastMessage.content}</Text>
                                  </View>
                              </TouchableOpacity>
                          ))
                      )
                  )}
              </ScrollView>
          </View>
      );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
        <StatusBar style="light" />
        <View style={[styles.chatHeader, { backgroundColor: Colors.primary, paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setActiveChat(null)} style={styles.backBtn}><ArrowLeft size={24} color={Colors.accent} /></TouchableOpacity>
            <View style={styles.headerUser}>
                <View style={styles.avatarSmall}>
                    {activeChat.avatarUrl ? <Image source={{ uri: activeChat.avatarUrl }} style={styles.img} /> : <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '20' }]}><Text style={styles.avatarTextSmall}>{activeChat.username[0].toUpperCase()}</Text></View>}
                </View>
                <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.chatName, { fontFamily: fonts.heading, color: Colors.white }]}>{activeChat.username}</Text>
                    <Text style={[styles.chatStatus, { fontFamily: fonts.body, color: Colors.accent }]}>Active Now</Text>
                </View>
            </View>
            <TouchableOpacity onPress={clearConversation}><MoreVertical size={20} color={Colors.accent} /></TouchableOpacity>
        </View>

        <FlatList 
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
                const isMine = item.senderId === user?.id;
                return (
                    <TouchableOpacity 
                        onLongPress={() => openOptions(item)}
                        activeOpacity={0.9}
                        style={[styles.messageWrapper, isMine ? styles.myMessage : styles.theirMessage]}
                    >
                        <View style={[styles.bubble, { backgroundColor: isMine ? theme.primary : (isDarkMode ? 'rgba(255,255,255,0.1)' : Colors.paleGreen) }]}>
                            <Text style={[styles.messageText, { color: isMine ? theme.white : theme.black, fontFamily: fonts.body }]}>{item.content}</Text>
                            <View style={styles.bubbleFooter}>
                                <Text style={[styles.messageTime, { color: isMine ? 'rgba(255,255,255,0.6)' : Colors.mutedTeal }]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                {isMine && <CheckCheck size={12} color={item.isRead ? Colors.accent : "rgba(255,255,255,0.6)"} style={{ marginLeft: 4 }} />}
                            </View>
                        </View>
                    </TouchableOpacity>
                );
            }}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        {/* Edit Modal */}
        <Modal visible={isEditing} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={[styles.editBox, { backgroundColor: theme.white }]}>
                    <View style={styles.editHeader}>
                        <Text style={[styles.editTitle, { fontFamily: fonts.heading, color: theme.primary }]}>Edit Message</Text>
                        <TouchableOpacity onPress={() => setIsEditing(false)}><X size={20} color={theme.black} /></TouchableOpacity>
                    </View>
                    <TextInput 
                        style={[styles.editInput, { color: theme.black, fontFamily: fonts.body }]}
                        value={editContent}
                        onChangeText={setEditContent}
                        multiline
                        autoFocus
                    />
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleUpdateMessage}>
                        <Text style={[styles.saveText, { fontFamily: fonts.heading }]}>Save Changes</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* Options Action Sheet (Simplified) */}
        <Modal visible={showOptions} transparent animationType="slide">
            <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowOptions(false)}>
                <View style={[styles.optionsSheet, { backgroundColor: theme.white }]}>
                    <TouchableOpacity 
                        style={styles.optionItem} 
                        onPress={() => {
                            setEditContent(selectedMessage.content);
                            setIsEditing(true);
                            setShowOptions(false);
                        }}
                    >
                        <Edit2 size={18} color={theme.primary} />
                        <Text style={[styles.optionText, { color: theme.black, fontFamily: fonts.body }]}>Edit Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.optionItem} onPress={() => handleDeleteMessage(selectedMessage.id)}>
                        <Trash2 size={18} color="#FF3B30" />
                        <Text style={[styles.optionText, { color: "#FF3B30", fontFamily: fonts.body }]}>Delete Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.optionItem, { borderBottomWidth: 0 }]} onPress={() => setShowOptions(false)}>
                        <Text style={[styles.optionText, { textAlign: 'center', flex: 1, color: Colors.mutedTeal }]}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
            <View style={[styles.inputArea, { backgroundColor: theme.white, paddingBottom: insets.bottom + 10, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                <View style={[styles.inputRow, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                    <TextInput 
                        style={[styles.input, { color: theme.black, fontFamily: fonts.body }]} 
                        placeholder="Type a message..." 
                        placeholderTextColor={Colors.mutedTeal}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        multiline
                    />
                    <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.primary }]} onPress={handleSendMessage}>
                        {sending ? <ActivityIndicator size="small" color={theme.white} /> : <Send size={20} color={theme.white} />}
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  headerTitle: { fontSize: 18, color: Colors.accent, letterSpacing: 2 },
  backBtn: { marginRight: 20 },
  listContent: { flex: 1, padding: 24 },
  convItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  avatarLarge: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700' },
  img: { width: '100%', height: '100%' },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontSize: 16 },
  convTime: { fontSize: 11, color: Colors.mutedTeal },
  convPreview: { fontSize: 13 },
  emptyText: { textAlign: 'center', color: Colors.mutedTeal, marginTop: 100 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  avatarTextSmall: { fontSize: 14, fontWeight: '700' },
  chatName: { fontSize: 16 },
  chatStatus: { fontSize: 11 },
  messageWrapper: { marginVertical: 4, maxWidth: '80%' },
  myMessage: { alignSelf: 'flex-end' },
  theirMessage: { alignSelf: 'flex-start' },
  bubble: { padding: 12, borderRadius: 16 },
  messageText: { fontSize: 15, lineHeight: 20 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  messageTime: { fontSize: 10 },
  inputArea: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingHorizontal: 16, minHeight: 48 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  editBox: { width: '85%', padding: 24, borderRadius: 20 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  editTitle: { fontSize: 18 },
  editInput: { minHeight: 100, textAlignVertical: 'top', fontSize: 16, marginBottom: 20 },
  saveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: 'bold' },
  optionsSheet: { width: '100%', position: 'absolute', bottom: 0, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  optionText: { fontSize: 16, marginLeft: 16 }
});
