import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, TextInput, Modal } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Users, Globe, Plus, X, Trash2, Camera, User, MapPin, Book } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Button } from "../components/Button";

export const CreativeSuiteScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { storyId, storyTitle } = route.params;
  const { theme, fonts, isDarkMode } = useTheme();
  
  const [tab, setTab] = useState<"characters" | "world">("characters");
  const [characters, setCharacters] = useState<any[]>([]);
  const [worldEntries, setWorldEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCharModal, setShowCharModal] = useState(false);
  const [showWorldModal, setShowWorldModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State - Character
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("");
  const [charDesc, setCharDesc] = useState("");
  const [charTraits, setCharTraits] = useState("");
  const [charAvatar, setCharAvatar] = useState<string | null>(null);

  // Form State - World
  const [worldTitle, setWorldTitle] = useState("");
  const [worldType, setWorldType] = useState("LOCATION");
  const [worldContent, setWorldContent] = useState("");

  const fetchData = async () => {
    try {
        setLoading(true);
        const res = await apiClient.get(`/stories/${storyId}`);
        setCharacters(res.data.characters || []);
        setWorldEntries(res.data.worldEntries || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
  }, [storyId]);

  const pickCharAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setCharAvatar(result.assets[0].uri);
  };

  const handleAddCharacter = async () => {
    if (!charName) return;
    setSubmitting(true);
    try {
        const formData = new FormData();
        formData.append("name", charName);
        formData.append("role", charRole);
        formData.append("description", charDesc);
        formData.append("traits", charTraits);
        if (charAvatar) {
            const filename = charAvatar.split("/").pop();
            const match = /\.(\w+)$/.exec(filename || "");
            const type = match ? `image/${match[1]}` : `image`;
            formData.append("avatar", { uri: charAvatar, name: filename, type } as any);
        }

        await apiClient.post(`/stories/${storyId}/characters`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });
        
        setShowCharModal(false);
        resetCharForm();
        fetchData();
    } catch (e) { Alert.alert("Error", "Failed to save character."); }
    finally { setSubmitting(false); }
  };

  const handleDeleteCharacter = async (id: string) => {
    try {
        await apiClient.delete(`/characters/${id}`);
        fetchData();
    } catch (e) { console.log(e); }
  };

  const handleAddWorld = async () => {
    if (!worldTitle || !worldContent) return;
    setSubmitting(true);
    try {
        await apiClient.post(`/stories/${storyId}/world`, {
            title: worldTitle,
            type: worldType,
            content: worldContent
        });
        setShowWorldModal(false);
        resetWorldForm();
        fetchData();
    } catch (e) { Alert.alert("Error", "Failed to save entry."); }
    finally { setSubmitting(false); }
  };

  const handleDeleteWorld = async (id: string) => {
    try {
        await apiClient.delete(`/world/${id}`);
        fetchData();
    } catch (e) { console.log(e); }
  };

  const resetCharForm = () => {
    setCharName(""); setCharRole(""); setCharDesc(""); setCharTraits(""); setCharAvatar(null);
  };

  const resetWorldForm = () => {
    setWorldTitle(""); setWorldType("LOCATION"); setWorldContent("");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>CREATIVE SUITE</Text>
            <Text style={[styles.headerSubtitle, { fontFamily: fonts.body }]}>{storyTitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, tab === "characters" && { borderBottomColor: Colors.accent }]}
            onPress={() => setTab("characters")}
          >
              <Users size={18} color={tab === "characters" ? Colors.accent : Colors.mutedTeal} />
              <Text style={[styles.tabText, { fontFamily: fonts.heading, color: tab === "characters" ? Colors.accent : Colors.mutedTeal }]}>CHARACTERS</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, tab === "world" && { borderBottomColor: Colors.accent }]}
            onPress={() => setTab("world")}
          >
              <Globe size={18} color={tab === "world" ? Colors.accent : Colors.mutedTeal} />
              <Text style={[styles.tabText, { fontFamily: fonts.heading, color: tab === "world" ? Colors.accent : Colors.mutedTeal }]}>WORLD WIKI</Text>
          </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} /> : (
            tab === "characters" ? (
                <View style={styles.list}>
                    <TouchableOpacity style={[styles.addCard, { borderColor: theme.primary + '30' }]} onPress={() => setShowCharModal(true)}>
                        <Plus size={24} color={theme.primary} />
                        <Text style={[styles.addText, { fontFamily: fonts.heading, color: theme.primary }]}>NEW CHARACTER</Text>
                    </TouchableOpacity>

                    {characters.map(char => (
                        <View key={char.id} style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : Colors.white }, Shadows.s]}>
                            <View style={styles.cardHeader}>
                                <Image source={{ uri: char.avatarUrl || 'https://via.placeholder.com/60' }} style={styles.cardAvatar} />
                                <View style={styles.cardInfo}>
                                    <Text style={[styles.cardName, { fontFamily: fonts.heading, color: theme.black }]}>{char.name}</Text>
                                    <Text style={[styles.cardRole, { fontFamily: fonts.body }]}>{char.role || "Supporting"}</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleDeleteCharacter(char.id)}><Trash2 size={18} color={Colors.error} /></TouchableOpacity>
                            </View>
                            <Text style={[styles.cardDesc, { fontFamily: fonts.body, color: theme.black }]} numberOfLines={3}>{char.description}</Text>
                            {char.traits && (
                                <View style={styles.traitRow}>
                                    {char.traits.split(',').map((t: string) => (
                                        <View key={t} style={[styles.traitBadge, { backgroundColor: theme.primary + '10' }]}>
                                            <Text style={[styles.traitText, { color: theme.primary, fontFamily: fonts.body }]}>{t.trim()}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.list}>
                    <TouchableOpacity style={[styles.addCard, { borderColor: theme.primary + '30' }]} onPress={() => setShowWorldModal(true)}>
                        <Plus size={24} color={theme.primary} />
                        <Text style={[styles.addText, { fontFamily: fonts.heading, color: theme.primary }]}>NEW LORE ENTRY</Text>
                    </TouchableOpacity>

                    {worldEntries.map(entry => (
                        <View key={entry.id} style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : Colors.white }, Shadows.s]}>
                            <View style={styles.cardHeader}>
                                <View style={[styles.typeIcon, { backgroundColor: theme.primary + '15' }]}>
                                    {entry.type === 'LOCATION' ? <MapPin size={18} color={theme.primary} /> : <Book size={18} color={theme.primary} />}
                                </View>
                                <View style={styles.cardInfo}>
                                    <Text style={[styles.cardName, { fontFamily: fonts.heading, color: theme.black }]}>{entry.title}</Text>
                                    <Text style={[styles.cardRole, { fontFamily: fonts.body }]}>{entry.type}</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleDeleteWorld(entry.id)}><Trash2 size={18} color={Colors.error} /></TouchableOpacity>
                            </View>
                            <Text style={[styles.cardDesc, { fontFamily: fonts.body, color: theme.black }]}>{entry.content}</Text>
                        </View>
                    ))}
                </View>
            )
        )}
      </ScrollView>

      {/* Character Modal */}
      <Modal visible={showCharModal} animationType="slide">
          <View style={[styles.modalContainer, { backgroundColor: theme.white, paddingTop: insets.top + 20 }]}>
              <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { fontFamily: fonts.heading, color: theme.black }]}>CHARACTER DESIGN</Text>
                  <TouchableOpacity onPress={() => setShowCharModal(false)}><X size={24} color={theme.black} /></TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1, padding: 24 }}>
                  <TouchableOpacity style={styles.avatarPicker} onPress={pickCharAvatar}>
                      {charAvatar ? <Image source={{ uri: charAvatar }} style={styles.pickedAvatar} /> : (
                          <View style={styles.avatarPlaceholderLarge}>
                              <Camera size={32} color={Colors.mutedTeal} />
                          </View>
                      )}
                  </TouchableOpacity>

                  <TextInput style={[styles.input, { fontFamily: fonts.body, color: theme.black, borderColor: theme.primary + '20' }]} placeholder="Name" value={charName} onChangeText={setCharName} placeholderTextColor={Colors.mutedTeal} />
                  <TextInput style={[styles.input, { fontFamily: fonts.body, color: theme.black, borderColor: theme.primary + '20' }]} placeholder="Role (e.g. Hero, Villain)" value={charRole} onChangeText={setCharRole} placeholderTextColor={Colors.mutedTeal} />
                  <TextInput style={[styles.input, { fontFamily: fonts.body, color: theme.black, borderColor: theme.primary + '20' }]} placeholder="Traits (comma separated)" value={charTraits} onChangeText={setCharTraits} placeholderTextColor={Colors.mutedTeal} />
                  <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top', fontFamily: fonts.body, color: theme.black, borderColor: theme.primary + '20' }]} placeholder="Description / Bio" value={charDesc} onChangeText={setCharDesc} multiline placeholderTextColor={Colors.mutedTeal} />
                  
                  {submitting ? <ActivityIndicator color={theme.primary} /> : (
                      <Button title="SAVE CHARACTER" onPress={handleAddCharacter} />
                  )}
              </ScrollView>
          </View>
      </Modal>

      {/* World Modal */}
      <Modal visible={showWorldModal} animationType="slide">
          <View style={[styles.modalContainer, { backgroundColor: theme.white, paddingTop: insets.top + 20 }]}>
              <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { fontFamily: fonts.heading, color: theme.black }]}>WORLD LORE</Text>
                  <TouchableOpacity onPress={() => setShowWorldModal(false)}><X size={24} color={theme.black} /></TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1, padding: 24 }}>
                  <View style={styles.typeSelector}>
                      {['LOCATION', 'LORE', 'SYSTEM'].map(t => (
                          <TouchableOpacity 
                            key={t} 
                            style={[styles.typeBtn, worldType === t && { backgroundColor: theme.primary }]}
                            onPress={() => setWorldType(t)}
                          >
                              <Text style={[styles.typeBtnText, { color: worldType === t ? theme.white : theme.primary, fontFamily: fonts.heading }]}>{t}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>

                  <TextInput style={[styles.input, { fontFamily: fonts.body, color: theme.black, borderColor: theme.primary + '20' }]} placeholder="Title (e.g. The Kingdom of Eldoria)" value={worldTitle} onChangeText={setWorldTitle} placeholderTextColor={Colors.mutedTeal} />
                  <TextInput style={[styles.input, { height: 250, textAlignVertical: 'top', fontFamily: fonts.body, color: theme.black, borderColor: theme.primary + '20' }]} placeholder="Details..." value={worldContent} onChangeText={setWorldContent} multiline placeholderTextColor={Colors.mutedTeal} />
                  
                  {submitting ? <ActivityIndicator color={theme.primary} /> : (
                      <Button title="SAVE ENTRY" onPress={handleAddWorld} />
                  )}
              </ScrollView>
          </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 24 },
  backBtn: { padding: 8 },
  headerInfo: { alignItems: 'center' },
  headerTitle: { fontSize: 16, color: Colors.accent, letterSpacing: 2 },
  headerSubtitle: { fontSize: 12, color: Colors.paleGreen, opacity: 0.8, marginTop: 2 },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,54,49,0.05)' },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 12, marginLeft: 8, letterSpacing: 1 },
  body: { flex: 1 },
  list: { padding: 24 },
  addCard: { height: 100, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  addText: { fontSize: 13, marginTop: 8, letterSpacing: 1 },
  card: { padding: 20, borderRadius: 24, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardAvatar: { width: 50, height: 50, borderRadius: 25 },
  typeIcon: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: 16 },
  cardName: { fontSize: 16 },
  cardRole: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 },
  cardDesc: { fontSize: 14, lineHeight: 22, opacity: 0.8 },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  traitBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 8, marginBottom: 8 },
  traitText: { fontSize: 10 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,54,49,0.05)' },
  modalTitle: { fontSize: 16, letterSpacing: 2 },
  avatarPicker: { alignSelf: 'center', marginBottom: 32 },
  avatarPlaceholderLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,54,49,0.05)', alignItems: 'center', justifyContent: 'center' },
  pickedAvatar: { width: 100, height: 100, borderRadius: 50 },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 16 },
  typeSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  typeBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,54,49,0.1)' },
  typeBtnText: { fontSize: 11, letterSpacing: 1 }
});
