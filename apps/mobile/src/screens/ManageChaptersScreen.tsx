import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Plus, Trash2, Edit2, ChevronUp, ChevronDown, Check, X, FileText, Send, Calendar } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useTheme } from "../context/ThemeContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import DateTimePicker from '@react-native-community/datetimepicker';

export const ManageChaptersScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { storyId, storyTitle } = route.params;
  const { theme, fonts, isDarkMode } = useTheme();

  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChapter, setEditingChapter] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publishedAt, setPublishedAt] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchChapters();
  }, [storyId]);

  const fetchChapters = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/stories/${storyId}/chapters`);
      setChapters(res.data);
    } catch (error) { console.log(error); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitLoading(true);
    try {
      const payload = { title, body, publishedAt: publishedAt?.toISOString() || null };
      if (editingChapter) {
          await apiClient.put(`/chapters/${editingChapter.id}`, payload);
      } else {
          await apiClient.post(`/stories/${storyId}/chapters`, { ...payload, order: chapters.length + 1 });
      }
      fetchChapters();
      setIsAdding(false);
      resetForm();
    } catch (e) { Alert.alert("Error", "Failed to save chapter."); }
    finally { setSubmitLoading(false); }
  };

  const resetForm = () => {
      setEditingChapter(null);
      setTitle("");
      setBody("");
      setPublishedAt(null);
  };

  const startEdit = (chapter: any) => {
      setEditingChapter(chapter);
      setTitle(chapter.title);
      setBody(chapter.body);
      setPublishedAt(chapter.publishedAt ? new Date(chapter.publishedAt) : null);
      setIsAdding(true);
  };

  const handleDelete = (id: string) => {
      Alert.alert("Delete Chapter", "Permanent action. Confirm?", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: async () => {
              try {
                  await apiClient.delete(`/chapters/${id}`);
                  fetchChapters();
              } catch (e) { console.log(e); }
          }}
      ]);
  };

  if (isAdding) {
      return (
          <View style={[styles.container, { backgroundColor: theme.white }]}>
              <StatusBar style="light" />
              <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
                  <TouchableOpacity onPress={() => { setIsAdding(false); resetForm(); }} style={styles.backBtn}>
                      <ArrowLeft size={24} color={Colors.accent} />
                  </TouchableOpacity>
                  <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>{editingChapter ? "EDIT CHAPTER" : "NEW CHAPTER"}</Text>
              </View>

              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                  <ScrollView style={styles.formContent} contentContainerStyle={{ paddingBottom: 40 }}>
                      <TextField label="Chapter Title" value={title} onChangeText={setTitle} placeholder="e.g. The Beginning" />
                      
                      <View style={styles.scheduleRow}>
                          <Text style={[styles.fieldLabel, { color: theme.primary, fontFamily: fonts.heading }]}>PUBLISH DATE</Text>
                          <TouchableOpacity 
                            style={[styles.dateBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : Colors.paleGreen }]}
                            onPress={() => setShowDatePicker(true)}
                          >
                              <Calendar size={18} color={theme.primary} />
                              <Text style={[styles.dateText, { fontFamily: fonts.body, color: theme.black }]}>
                                  {publishedAt ? publishedAt.toLocaleDateString() : "Publish Immediately"}
                              </Text>
                              {publishedAt && (
                                  <TouchableOpacity onPress={() => setPublishedAt(null)}><X size={14} color={Colors.error} /></TouchableOpacity>
                              )}
                          </TouchableOpacity>
                      </View>

                      {showDatePicker && (
                          <DateTimePicker
                              value={publishedAt || new Date()}
                              mode="date"
                              display="default"
                              onChange={(e, date) => {
                                  setShowDatePicker(false);
                                  if (date) setPublishedAt(date);
                              }}
                          />
                      )}

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                          <Text style={[styles.fieldLabel, { color: theme.primary, fontFamily: fonts.heading }]}>CHAPTER BODY</Text>
                          <Text style={[styles.wordCount, { color: Colors.mutedTeal, fontFamily: fonts.body }]}>{body.trim() ? body.trim().split(/\s+/).length : 0} words</Text>
                      </View>
                      <TextInput 
                        style={[styles.modalInput, { height: 400, textAlignVertical: 'top', paddingTop: 16, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : Colors.paleGreen, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : Colors.lightForest, color: theme.black, fontFamily: fonts.body, padding: 16, borderRadius: 12, borderWidth: 0.5 }]} 
                        value={body} 
                        onChangeText={setBody} 
                        placeholder="Write your chapter here..." 
                        placeholderTextColor={Colors.mutedTeal}
                        multiline 
                      />
                      
                      {submitLoading ? <ActivityIndicator color={Colors.accent} style={{ marginTop: 20 }} /> : (
                          <View style={{ marginTop: 20 }}>
                              <Button title="SAVE CHAPTER" onPress={handleSave} type="primary" />
                              <Button title="CANCEL" onPress={() => { setIsAdding(false); resetForm(); }} type="ghost" style={{ marginTop: 12 }} />
                          </View>
                      )}
                  </ScrollView>
              </KeyboardAvoidingView>
          </View>
      );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { fontFamily: fonts.heading, textAlign: 'center' }]}>CHAPTERS</Text>
            <Text style={[styles.subTitle, { fontFamily: fonts.body, textAlign: 'center' }]} numberOfLines={1}>{storyTitle}</Text>
        </View>
        <TouchableOpacity onPress={() => setIsAdding(true)} style={styles.addBtn}>
            <Plus size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.listContent}>
          {loading ? [1, 2].map(i => <View key={i} style={[styles.skeleton, { backgroundColor: theme.primary + '10' }]} />) : (
              chapters.length === 0 ? (
                  <View style={styles.emptyContainer}>
                      <FileText size={64} color={Colors.mutedTeal} strokeWidth={1} />
                      <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No chapters yet. Start the first one!</Text>
                      <Button title="CREATE CHAPTER 1" onPress={() => setIsAdding(true)} type="secondary" style={{ marginTop: 24, width: '100%' }} />
                  </View>
              ) : (
                  chapters.map((chap, idx) => (
                      <View key={chap.id} style={[styles.chapterRow, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                          <View style={styles.chapInfo}>
                              <Text style={[styles.chapOrder, { color: theme.primary, fontFamily: fonts.heading }]}>{idx + 1}</Text>
                              <View style={{ flex: 1, marginLeft: 16 }}>
                                  <Text style={[styles.chapTitle, { color: theme.black, fontFamily: fonts.heading }]} numberOfLines={1}>{chap.title}</Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Text style={[styles.chapMeta, { fontFamily: fonts.body }]}>{Math.ceil(chap.body.length / 5)} words</Text>
                                      {chap.publishedAt && new Date(chap.publishedAt) > new Date() && (
                                          <View style={styles.scheduledBadge}><Calendar size={10} color={Colors.accent} /><Text style={styles.scheduledText}>Scheduled</Text></View>
                                      )}
                                  </View>
                              </View>
                          </View>
                          <View style={styles.actions}>
                              <TouchableOpacity onPress={() => startEdit(chap)} style={styles.actionBtn}>
                                  <Edit2 size={18} color={theme.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDelete(chap.id)} style={styles.actionBtn}>
                                  <Trash2 size={18} color="red" />
                              </TouchableOpacity>
                          </View>
                      </View>
                  ))
              )
          )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 24, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  headerTitle: { fontSize: 18, color: Colors.accent, letterSpacing: 1 },
  subTitle: { fontSize: 12, color: Colors.mutedTeal, marginTop: 4 },
  backBtn: { marginRight: 16 },
  addBtn: { marginLeft: 16 },
  formContent: { padding: 24 },
  fieldLabel: { fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  wordCount: { fontSize: 12, marginBottom: 8 },
  scheduleRow: { marginTop: 10 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginTop: 4 },
  dateText: { marginLeft: 12, flex: 1 },
  listContent: { flex: 1, padding: 24 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1 },
  chapInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  chapOrder: { fontSize: 24, opacity: 0.3 },
  chapTitle: { fontSize: 16 },
  chapMeta: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 },
  scheduledBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  scheduledText: { color: Colors.accent, fontSize: 9, marginLeft: 4, fontWeight: '700' },
  actions: { flexDirection: 'row' },
  actionBtn: { marginLeft: 16, padding: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: Colors.mutedTeal, marginTop: 20, textAlign: 'center' },
  skeleton: { height: 80, borderRadius: 16, marginBottom: 16, width: '100%' }
});
