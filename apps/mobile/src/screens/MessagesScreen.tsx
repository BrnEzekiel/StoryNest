import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, FlatList, Dimensions, Modal, RefreshControl } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { ActivityLog } from "../utils/activityLog";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Send, Search, MoreVertical, CheckCheck, Edit2, Trash2, X, MessageCirclePlus } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { getFriendlyErrorMessage } from "../utils/ErrorHandler";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { Cache } from "../utils/Cache";
import { checkLimit, LIMITS } from "../utils/rateLimit";
import { ensureChatKeys, getMySecretKey, getUserPublicKey, cacheUserPublicKey, encryptTo, decryptFrom } from "../utils/crypto";

const { width } = Dimensions.get("window");

export const MessagesScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, setHasUnreadMessages } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();
  const { showNotice } = useNotice();

  const { targetUser } = route.params || {};

  const [activeChat, setActiveChat] = useState<any>(targetUser || null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // CRUD States
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showOptions, setShowOptions] = useState(false);

  // New-chat search (the server only returns discoverable users, never you).
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  // Browse list: everyone who turned on discoverability, loaded on open.
  const [browseUsers, setBrowseUsers] = useState<any[]>([]);
  const [browsing, setBrowsing] = useState(false);
  // Decrypted plaintext by message id; inbox previews by conversation user id.
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const flatListRef = useRef<FlatList>(null);
  const sendingRef = useRef(false);
  const lastMsgIdRef = useRef<string | null>(null);

  // Cached: conversations paint instantly, threads sync silently per chat.
  const convosQuery = useCachedQuery<any[]>("messages:conversations", async () => {
    const res = await apiClient.get("/messages/conversations");
    return res.data;
  });
  const threadKey = activeChat ? `messages:thread:${activeChat.id}` : null;
  const threadQuery = useCachedQuery<any[]>(threadKey, async () => {
    const res = await apiClient.get(`/messages/${activeChat.id}`);
    return res.data;
  });

  const conversations = convosQuery.data || [];
  const messages = threadQuery.data || [];

  // Seed the public-key cache from every list we already fetched.
  useEffect(() => {
      conversations.forEach((c: any) => cacheUserPublicKey(c.user?.id, c.user?.publicKey));
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);
  useEffect(() => {
      if (activeChat?.publicKey) cacheUserPublicKey(activeChat.id, activeChat.publicKey);
      if (user?.id) ensureChatKeys(user.id, (user as any).publicKey).catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  // Decrypt the open thread (both directions share the one secret).
  useEffect(() => {
      if (!activeChat || !user || messages.length === 0) return;
      let cancelled = false;
      (async () => {
          try {
              const [mySecret, theirPub] = await Promise.all([
                  getMySecretKey(user.id),
                  getUserPublicKey(activeChat.id),
              ]);
              if (cancelled || !mySecret || !theirPub) return;
              const next: Record<string, string> = {};
              for (const m of messages) {
                  if (m.isEncrypted && m.content && decrypted[m.id] === undefined) {
                      const plain = decryptFrom(m.content, theirPub, mySecret);
                      next[m.id] = plain ?? "Couldn't decrypt this message.";
                  }
              }
              if (Object.keys(next).length > 0) setDecrypted(prev => ({ ...prev, ...next }));
          } catch {}
      })();
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeChat?.id]);

  // Decrypt inbox previews so the list never shows ciphertext.
  useEffect(() => {
      if (!user || conversations.length === 0) return;
      let cancelled = false;
      (async () => {
          try {
              const mySecret = await getMySecretKey(user.id);
              if (cancelled || !mySecret) return;
              const next: Record<string, string> = {};
              for (const c of conversations) {
                  const lm = c.lastMessage;
                  if (lm?.isEncrypted && lm.content && previews[c.user.id] === undefined) {
                      const theirPub = await getUserPublicKey(c.user.id);
                      if (cancelled) return;
                      if (!theirPub) continue;
                      const plain = decryptFrom(lm.content, theirPub, mySecret);
                      next[c.user.id] = plain ?? "Couldn't decrypt this message.";
                  }
              }
              if (Object.keys(next).length > 0) setPreviews(prev => ({ ...prev, ...next }));
          } catch {}
      })();
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  useEffect(() => {
      lastMsgIdRef.current = null;
      if (activeChat) {
          markAllAsRead(activeChat.id);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
      } else {
          convosQuery.refresh();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  // Live sync: the open thread refreshes every few seconds so replies land
  // without leaving the chat; the inbox refreshes while it is visible.
  // Polling pauses mid-send so the optimistic bubble never flickers out.
  useEffect(() => {
      if (showOptions || isEditing) return;
      const t = setInterval(() => {
          if (sendingRef.current) return;
          if (activeChat) threadQuery.refresh();
          else convosQuery.refresh();
      }, activeChat ? 4000 : 15000);
      return () => clearInterval(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id, showOptions, isEditing]);

  // A fresh message from the peer scrolls into view and clears the badge.
  useEffect(() => {
      if (!activeChat || messages.length === 0) return;
      const last = messages[messages.length - 1];
      if (lastMsgIdRef.current === null) {
          lastMsgIdRef.current = last.id;
          return;
      }
      if (last.id !== lastMsgIdRef.current) {
          lastMsgIdRef.current = last.id;
          if (last.senderId !== user?.id && !last._pending) {
              markAllAsRead(activeChat.id);
              flatListRef.current?.scrollToEnd({ animated: true });
          }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeChat?.id]);

  const markAllAsRead = async (userId: string) => {
      try {
          await apiClient.patch(`/messages/read-all/${userId}`);
          setHasUnreadMessages(false);
      } catch (e) {}
  };

  // Debounced user search for starting a new chat.
  useEffect(() => {
      const q = searchText.trim();
      if (!showNewChat || q.length < 2) {
          setSearchResults([]);
          setSearching(false);
          return;
      }
      setSearching(true);
      const t = setTimeout(async () => {
          try {
              const res = await apiClient.get("/users/search", { params: { q } });
              const list = Array.isArray(res.data) ? res.data : [];
              list.forEach((u: any) => cacheUserPublicKey(u.id, u.publicKey));
              setSearchResults(list);
          } catch {
              setSearchResults([]);
          } finally {
              setSearching(false);
          }
      }, 400);
      return () => clearTimeout(t);
  }, [searchText, showNewChat]);

  // Load the full discoverable list whenever the sheet opens.
  useEffect(() => {
      if (!showNewChat) return;
      let cancelled = false;
      (async () => {
          setBrowsing(true);
          try {
              const res = await apiClient.get("/users/discoverable");
              const list = Array.isArray(res.data) ? res.data : [];
              list.forEach((u: any) => cacheUserPublicKey(u.id, u.publicKey));
              if (!cancelled) setBrowseUsers(list);
          } catch {
              if (!cancelled) setBrowseUsers([]);
          } finally {
              if (!cancelled) setBrowsing(false);
          }
      })();
      return () => { cancelled = true; };
  }, [showNewChat]);

  const startChatWith = (peer: any) => {
      cacheUserPublicKey(peer.id, peer.publicKey);
      setShowNewChat(false);
      setSearchText("");
      setSearchResults([]);
      setActiveChat(peer);
  };

  const handleSendMessage = async () => {
      const content = newMessage.trim();
      if (!content || !activeChat || !user || sendingRef.current) return;

      const verdict = checkLimit("messages:send", LIMITS.message.max, LIMITS.message.windowMs);
      if (!verdict.allowed) {
          showNotice({ title: "Slow down", message: "You're sending messages very fast. Please wait a moment and try again.", variant: "info" });
          return;
      }

      // Double-tap guard: one in-flight send at a time.
      sendingRef.current = true;
      setSending(true);
      setNewMessage("");

      // Encrypt to the other party when both keys exist; otherwise send plain
      // (peer on an old build) so chats never break.
      let payload = content;
      let encrypted = false;
      try {
          const [mySecret, theirPub] = await Promise.all([
              getMySecretKey(user.id),
              getUserPublicKey(activeChat.id),
          ]);
          if (mySecret && theirPub) {
              payload = encryptTo(content, theirPub, mySecret);
              encrypted = true;
          }
      } catch {}

      // Optimistic bubble: appears instantly, reconciled with the server copy.
      const tempId = `pending-${Date.now()}`;
      const optimistic = {
          id: tempId,
          senderId: user?.id,
          receiverId: activeChat.id,
          content,
          createdAt: new Date().toISOString(),
          isRead: false,
          isEncrypted: encrypted,
          _pending: true,
      };
      const withOptimistic = [...messages, optimistic];
      threadQuery.setData(withOptimistic);
      if (encrypted) setDecrypted(prev => ({ ...prev, [tempId]: content }));
      if (threadKey) Cache.set(threadKey, withOptimistic).catch(() => {});
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);

      try {
          const res = await apiClient.post("/messages", {
              receiverId: activeChat.id,
              content: payload,
              isEncrypted: encrypted,
          });
          const reconciled = withOptimistic.map(m => (m.id === tempId ? res.data : m));
          threadQuery.setData(reconciled);
          if (threadKey) Cache.set(threadKey, reconciled).catch(() => {});
          if (encrypted && res.data?.id) setDecrypted(prev => ({ ...prev, [res.data.id]: content }));
          convosQuery.refresh();
          ActivityLog.log({
            kind: "MESSAGE",
            title: activeChat.username || "chat",
            // Ciphertext stays between the two parties: never log it.
            sub: encrypted ? "Encrypted message" : (content.length > 90 ? content.slice(0, 90) + "..." : content),
          });
      } catch (e: any) {
          const rolledBack = withOptimistic.filter(m => m.id !== tempId);
          threadQuery.setData(rolledBack);
          if (threadKey) Cache.set(threadKey, rolledBack).catch(() => {});
          setNewMessage(content);
          showNotice({ title: "Notice", message: getFriendlyErrorMessage(e, "Could not send message. Please try again."), variant: "error" });
      } finally {
          sendingRef.current = false;
          setSending(false);
      }
  };

  const handleDeleteMessage = async (id: string) => {
      try {
          await apiClient.delete(`/messages/${id}`);
          const next = messages.filter(m => m.id !== id);
          threadQuery.setData(next);
          if (threadKey) Cache.set(threadKey, next).catch(() => {});
          setShowOptions(false);
      } catch (e: any) { showNotice({ title: "Notice", message: getFriendlyErrorMessage(e, "Could not delete message."), variant: "error" }); }
  };

  const handleUpdateMessage = async () => {
      const plain = editContent.trim();
      if (!plain) return;
      try {
          // Encrypted stays encrypted: re-seal the edited text to the peer.
          let payload = plain;
          if (selectedMessage.isEncrypted && user && activeChat) {
              try {
                  const [mySecret, theirPub] = await Promise.all([
                      getMySecretKey(user.id),
                      getUserPublicKey(activeChat.id),
                  ]);
                  if (mySecret && theirPub) payload = encryptTo(plain, theirPub, mySecret);
              } catch {}
          }
          const res = await apiClient.put(`/messages/${selectedMessage.id}`, { content: payload });
          const next = messages.map(m => m.id === selectedMessage.id ? res.data : m);
          threadQuery.setData(next);
          if (selectedMessage.isEncrypted && res.data?.id) setDecrypted(prev => ({ ...prev, [res.data.id]: plain }));
          if (threadKey) Cache.set(threadKey, next).catch(() => {});
          setIsEditing(false);
          setSelectedMessage(null);
      } catch (e: any) { showNotice({ title: "Notice", message: getFriendlyErrorMessage(e, "Could not update message."), variant: "error" }); }
  };

  const clearConversation = () => {
      showNotice({
          title: "Clear Chat",
          message: "This will delete all messages in this conversation. Continue?",
          variant: "error",
          actions: [
              { label: "Cancel", kind: "ghost" },
              {
                  label: "Clear",
                  kind: "destructive",
                  onPress: async () => {
                      try {
                          await apiClient.delete(`/messages/conversations/${activeChat.id}`);
                          threadQuery.setData([]);
                          if (threadKey) Cache.set(threadKey, []).catch(() => {});
                      } catch (e) {}
                  }
              },
          ],
      });
  };

  const openOptions = (msg: any) => {
      if (msg.senderId !== user?.id) return; // Only CRUD own messages
      setSelectedMessage(msg);
      setShowOptions(true);
  };

  // New-chat list: server search from 2 letters, otherwise the full
  // discoverable roster (locally filtered while typing the first letter).
  const newChatQuery = searchText.trim().toLowerCase();
  const newChatFiltering = newChatQuery.length >= 2;
  const visibleNewChatUsers = newChatFiltering
      ? searchResults
      : browseUsers.filter((u: any) => !newChatQuery || (u.username || "").toLowerCase().includes(newChatQuery));

  if (!activeChat) {
      return (
          <View style={[styles.container, { backgroundColor: theme.white }]}>
              <StatusBar style="light" />
              <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
                  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><ArrowLeft size={24} color={Colors.accent} /></TouchableOpacity>
                  <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>MESSAGES</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => setShowNewChat(true)} style={styles.composeBtn}><Edit2 size={22} color={Colors.accent} /></TouchableOpacity>
              </View>

              <FlatList
                style={styles.listContent}
                data={conversations}
                keyExtractor={(conv) => conv.user.id}
                contentContainerStyle={conversations.length === 0 ? { flexGrow: 1 } : undefined}
                refreshControl={
                  <RefreshControl
                    refreshing={convosQuery.refreshing}
                    onRefresh={() => convosQuery.refresh({ showIndicator: true })}
                    tintColor={Colors.primary}
                  />
                }
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>
                      {convosQuery.isFirstLoad ? "Warming up your inbox..." : "No conversations yet."}
                  </Text>
                }
                renderItem={({ item: conv }) => (
                  <TouchableOpacity
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
                          <Text style={[styles.convPreview, { fontFamily: fonts.body, color: conv.lastMessage.isRead || conv.lastMessage.senderId === user?.id ? Colors.mutedTeal : theme.primary, fontWeight: conv.lastMessage.isRead || conv.lastMessage.senderId === user?.id ? "normal" : "bold" }]} numberOfLines={1}>{conv.lastMessage.isEncrypted ? (previews[conv.user.id] ?? "Encrypted message") : conv.lastMessage.content}</Text>
                      </View>
                  </TouchableOpacity>
                )}
              />

              <TouchableOpacity
                  style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 24 }]}
                  onPress={() => setShowNewChat(true)}
                  activeOpacity={0.85}
              >
                  <MessageCirclePlus size={26} color={theme.white} />
              </TouchableOpacity>

              <Modal visible={showNewChat} transparent animationType="slide">
                  <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNewChat(false)}>
                      <View style={[styles.optionsSheet, { backgroundColor: theme.white, maxHeight: '80%' }]}>
                          <View style={styles.editHeader}>
                              <Text style={[styles.editTitle, { fontFamily: fonts.heading, color: theme.primary }]}>New Chat</Text>
                              <TouchableOpacity onPress={() => setShowNewChat(false)}><X size={20} color={theme.black} /></TouchableOpacity>
                          </View>
                          <View style={[styles.searchRow, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                              <Search size={18} color={Colors.mutedTeal} />
                              <TextInput
                                  style={[styles.input, { color: theme.black, fontFamily: fonts.body, marginLeft: 8 }]}
                                  placeholder="Search people…"
                                  placeholderTextColor={Colors.mutedTeal}
                                  value={searchText}
                                  onChangeText={setSearchText}
                                  autoFocus
                              />
                          </View>
                          <Text style={[styles.newChatHint, { fontFamily: fonts.body }]}>
                              Only people who turned on “Let Others Find Me to Chat” appear here.
                          </Text>
                          {(searching || browsing) && visibleNewChatUsers.length === 0 ? (
                              <Text style={[styles.emptyText, { fontFamily: fonts.body, marginTop: 24 }]}>Loading people…</Text>
                          ) : visibleNewChatUsers.length === 0 ? (
                              <Text style={[styles.emptyText, { fontFamily: fonts.body, marginTop: 24 }]}>
                                  {newChatFiltering ? "Nobody matches that name." : "Nobody has turned on chat discovery yet."}
                              </Text>
                          ) : (
                              <FlatList
                                  data={visibleNewChatUsers}
                                  keyExtractor={(u) => u.id}
                                  keyboardShouldPersistTaps="handled"
                                  renderItem={({ item: u }) => (
                                      <TouchableOpacity
                                          style={[styles.convItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                                          onPress={() => startChatWith(u)}
                                      >
                                          <View style={styles.avatarLarge}>
                                              {u.avatarUrl ? <Image source={{ uri: u.avatarUrl }} style={styles.img} /> : <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '20' }]}><Text style={styles.avatarText}>{(u.username || "?")[0].toUpperCase()}</Text></View>}
                                          </View>
                                          <View style={{ flex: 1, marginLeft: 16 }}>
                                              <Text style={[styles.convName, { color: theme.black, fontFamily: fonts.heading }]}>{u.username}</Text>
                                              <Text style={[styles.convPreview, { fontFamily: fonts.body }]}>{u.publicKey ? "Encrypted chat ready" : "Tap to chat"}</Text>
                                          </View>
                                      </TouchableOpacity>
                                  )}
                              />
                          )}
                      </View>
                  </TouchableOpacity>
              </Modal>
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
                    <Text style={[styles.chatStatus, { fontFamily: fonts.body, color: Colors.accent }]}>{activeChat.publicKey ? "End-to-end encrypted" : "Active Now"}</Text>
                </View>
            </View>
            <TouchableOpacity onPress={clearConversation}><MoreVertical size={20} color={Colors.accent} /></TouchableOpacity>
        </View>

        {messages.length === 0 && threadQuery.isFirstLoad ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={[styles.emptyText, { fontFamily: fonts.body, marginTop: 0 }]}>Loading conversation...</Text>
            </View>
        ) : (
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
                        <View style={[styles.bubble, { backgroundColor: isMine ? theme.primary : (isDarkMode ? 'rgba(255,255,255,0.1)' : Colors.paleGreen), opacity: item._pending ? 0.7 : 1 }]}>
                            <Text style={[styles.messageText, { color: isMine ? theme.white : theme.black, fontFamily: fonts.body }]}>{item.isEncrypted ? (decrypted[item.id] ?? "Decrypting…") : item.content}</Text>
                            <View style={styles.bubbleFooter}>
                                <Text style={[styles.messageTime, { color: isMine ? 'rgba(255,255,255,0.6)' : Colors.mutedTeal }]}>{item._pending ? "Sending" : new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                {isMine && !item._pending && <CheckCheck size={12} color={item.isRead ? Colors.accent : "rgba(255,255,255,0.6)"} style={{ marginLeft: 4 }} />}
                            </View>
                        </View>
                    </TouchableOpacity>
                );
            }}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            refreshControl={
              <RefreshControl
                refreshing={threadQuery.refreshing}
                onRefresh={() => threadQuery.refresh({ showIndicator: true })}
                tintColor={Colors.primary}
              />
            }
        />
        )}

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
                            setEditContent(selectedMessage.isEncrypted ? (decrypted[selectedMessage.id] ?? "") : selectedMessage.content);
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
                    <TouchableOpacity
                        style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: sending || !newMessage.trim() ? 0.5 : 1 }]}
                        onPress={handleSendMessage}
                        disabled={sending}
                    >
                        <Send size={20} color={theme.white} />
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
  optionText: { fontSize: 16, marginLeft: 16 },
  composeBtn: { padding: 8 },
  fab: { position: 'absolute', right: 24, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 14, minHeight: 48, marginBottom: 8 },
  newChatHint: { fontSize: 12, color: Colors.mutedTeal, marginBottom: 8 },
});
