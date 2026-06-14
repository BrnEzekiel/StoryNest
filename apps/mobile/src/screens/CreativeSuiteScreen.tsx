import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, TextInput, Modal, Dimensions, Animated } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Users, Globe, Plus, X, Trash2, Camera, User, MapPin, Book, Sparkles, ChevronRight, Zap } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

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
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#001a18', '#000807']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>CREATIVE SUITE</Text>
            <Text style={[styles.headerSubtitle, { fontFamily: fonts.body }]} numberOfLines={1}>{storyTitle?.toUpperCase()}</Text>
        </View>
        <TouchableOpacity onPress={fetchData}><Zap size={20} color={Colors.accent} /></TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, tab === "characters" && styles.activeTab]}
            onPress={() => setTab("characters")}
          >
              <Users size={16} color={tab === "characters" ? Colors.accent : "rgba(255,237,168,0.4)"} />
              <Text style={[styles.tabText, { fontFamily: fonts.heading, color: tab === "characters" ? Colors.accent : "rgba(255,237,168,0.4)" }]}>DESIGN LAB</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, tab === "world" && styles.activeTab]}
            onPress={() => setTab("world")}
          >
              <Globe size={16} color={tab === "world" ? Colors.accent : "rgba(255,237,168,0.4)"} />
              <Text style={[styles.tabText, { fontFamily: fonts.heading, color: tab === "world" ? Colors.accent : "rgba(255,237,168,0.4)" }]}>WORLD ENGINE</Text>
          </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {loading ? <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} /> : (
            tab === "characters" ? (
                <View style={styles.list}>
                    <TouchableOpacity style={styles.addCard} onPress={() => setShowCharModal(true)}>
                        <LinearGradient colors={['rgba(255,237,168,0.1)', 'rgba(255,237,168,0.02)']} style={styles.addCardGradient}>
                            <Plus size={28} color={Colors.accent} />
                            <Text style={[styles.addText, { fontFamily: fonts.heading, color: Colors.accent }]}>INITIALIZE NEW ENTITY</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {characters.map(char => (
                        <View key={char.id} style={styles.card}>
                            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} style={styles.cardGradient}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.avatarWrapper}>
                                        <Image source={{ uri: char.avatarUrl || 'https://via.placeholder.com/60' }} style={styles.cardAvatar} />
                                        <View style={styles.statusDot} />
                                    </View>
                                    <View style={styles.cardInfo}>
                                        <Text style={[styles.cardName, { fontFamily: fonts.heading, color: Colors.white }]}>{char.name.toUpperCase()}</Text>
                                        <Text style={[styles.cardRole, { fontFamily: fonts.body, color: Colors.accent }]}>{char.role || "NEURAL ENTITY"}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleDeleteCharacter(char.id)} style={styles.deleteBtn}><Trash2 size={16} color="#FF6B6B" /></TouchableOpacity>
                                </View>
                                <Text style={[styles.cardDesc, { fontFamily: fonts.body, color: Colors.white, opacity: 0.7 }]} numberOfLines={3}>{char.description}</Text>
                                {char.traits && (
                                    <View style={styles.traitRow}>
                                        {char.traits.split(',').map((t: string) => (
                                            <View key={t} style={styles.traitBadge}>
                                                <Text style={[styles.traitText, { color: Colors.accent, fontFamily: fonts.body }]}>{t.trim().toUpperCase()}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </LinearGradient>
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.list}>
                    <TouchableOpacity style={styles.addCard} onPress={() => setShowWorldModal(true)}>
                        <LinearGradient colors={['rgba(255,237,168,0.1)', 'rgba(255,237,168,0.02)']} style={styles.addCardGradient}>
                            <Plus size={28} color={Colors.accent} />
                            <Text style={[styles.addText, { fontFamily: fonts.heading, color: Colors.accent }]}>GENERATE WORLD DATA</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {worldEntries.map(entry => (
                        <View key={entry.id} style={styles.card}>
                            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} style={styles.cardGradient}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.typeIcon}>
                                        {entry.type === 'LOCATION' ? <MapPin size={20} color={Colors.accent} /> : <Book size={20} color={Colors.accent} />}
                                    </View>
                                    <View style={styles.cardInfo}>
                                        <Text style={[styles.cardName, { fontFamily: fonts.heading, color: Colors.white }]}>{entry.title.toUpperCase()}</Text>
                                        <Text style={[styles.cardRole, { fontFamily: fonts.body, color: Colors.accent }]}>{entry.type} CORE</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleDeleteWorld(entry.id)} style={styles.deleteBtn}><Trash2 size={16} color="#FF6B6B" /></TouchableOpacity>
                                </View>
                                <Text style={[styles.cardDesc, { fontFamily: fonts.body, color: Colors.white, opacity: 0.7 }]}>{entry.content}</Text>
                            </LinearGradient>
                        </View>
                    ))}
                </View>
            )
        )}
      </ScrollView>

      {/* Futuristic Modal Overlay */}
      <Modal visible={showCharModal || showWorldModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
              <View style={[styles.modalHUD, { backgroundColor: '#001a18', borderColor: 'rgba(255,237,168,0.2)' }]}>
                  <View style={styles.hudHeader}>
                      <Sparkles size={16} color={Colors.accent} />
                      <Text style={[styles.hudTitle, { fontFamily: fonts.heading }]}>{showCharModal ? "ENTITY DESIGNER" : "CORE ENGINE"}</Text>
                      <TouchableOpacity onPress={() => { setShowCharModal(false); setShowWorldModal(false); }}><X size={20} color={Colors.white} /></TouchableOpacity>
                  </View>

                  <ScrollView style={styles.hudBody} showsVerticalScrollIndicator={false}>
                      {showCharModal ? (
                          <>
                            <TouchableOpacity style={styles.hudAvatarPicker} onPress={pickCharAvatar}>
                                {charAvatar ? <Image source={{ uri: charAvatar }} style={styles.hudPickedAvatar} /> : (
                                    <View style={styles.hudAvatarPlaceholder}>
                                        <Camera size={24} color={Colors.accent} />
                                    </View>
                                )}
                            </TouchableOpacity>
                            <HUDInput placeholder="ENTITY IDENTIFIER" value={charName} onChangeText={setCharName} />
                            <HUDInput placeholder="SYSTEM ROLE" value={charRole} onChangeText={setCharRole} />
                            <HUDInput placeholder="NEURAL TRAITS (COMMA SEP)" value={charTraits} onChangeText={setCharTraits} />
                            <HUDInput placeholder="DATABASE ENTRY / BIO" value={charDesc} onChangeText={setCharDesc} multiline height={100} />
                            <TouchableOpacity style={styles.hudActionBtn} onPress={handleAddCharacter}>
                                <Text style={[styles.hudActionText, { fontFamily: fonts.heading }]}>INITIALIZE ENTITY</Text>
                            </TouchableOpacity>
                          </>
                      ) : (
                          <>
                            <View style={styles.hudTypeRow}>
                                {['LOCATION', 'LORE', 'SYSTEM'].map(t => (
                                    <TouchableOpacity key={t} style={[styles.hudTypeBtn, worldType === t && styles.hudTypeActive]} onPress={() => setWorldType(t)}>
                                        <Text style={[styles.hudTypeText, { color: worldType === t ? Colors.primary : Colors.accent, fontFamily: fonts.heading }]}>{t}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <HUDInput placeholder="DATA TITLE" value={worldTitle} onChangeText={setWorldTitle} />
                            <HUDInput placeholder="SYSTEM DETAILS..." value={worldContent} onChangeText={setWorldContent} multiline height={180} />
                            <TouchableOpacity style={styles.hudActionBtn} onPress={handleAddWorld}>
                                <Text style={[styles.hudActionText, { fontFamily: fonts.heading }]}>COMMIT DATA</Text>
                            </TouchableOpacity>
                          </>
                      )}
                  </ScrollView>
              </View>
          </View>
      </Modal>
    </View>
  );
};

const HUDInput = ({ ...props }: any) => (
    <View style={styles.hudInputWrapper}>
        <TextInput 
            {...props} 
            placeholderTextColor="rgba(255,237,168,0.3)" 
            style={[styles.hudInput, { fontFamily: Fonts.body, height: props.height || 54 }, props.style, Platform.select({ web: { outlineStyle: 'none' } as any, default: {} })]} 
        />
        <View style={styles.hudInputLine} />
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,237,168,0.1)' },
  backBtn: { padding: 8 },
  headerInfo: { alignItems: 'center' },
  headerTitle: { fontSize: 14, color: Colors.accent, letterSpacing: 3 },
  headerSubtitle: { fontSize: 10, color: Colors.white, opacity: 0.6, marginTop: 4, letterSpacing: 1 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 24, paddingTop: 16 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: 'transparent', opacity: 0.6 },
  activeTab: { borderBottomColor: Colors.accent, opacity: 1 },
  tabText: { fontSize: 10, marginLeft: 10, letterSpacing: 2 },
  body: { flex: 1 },
  list: { padding: 20 },
  addCard: { height: 80, borderRadius: 20, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,237,168,0.2)', borderStyle: 'dashed' },
  addCardGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 11, marginLeft: 12, letterSpacing: 1.5 },
  card: { borderRadius: 24, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardGradient: { padding: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatarWrapper: { width: 50, height: 50, borderRadius: 25, position: 'relative' },
  cardAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: Colors.accent },
  statusDot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#34C759', borderWidth: 2, borderColor: '#001a18' },
  typeIcon: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,237,168,0.1)', borderWidth: 1, borderColor: 'rgba(255,237,168,0.2)' },
  cardInfo: { flex: 1, marginLeft: 16 },
  cardName: { fontSize: 15, letterSpacing: 1 },
  cardRole: { fontSize: 10, letterSpacing: 1, marginTop: 2 },
  deleteBtn: { padding: 8, backgroundColor: 'rgba(255,107,107,0.05)', borderRadius: 10 },
  cardDesc: { fontSize: 13, lineHeight: 20 },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  traitBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginRight: 8, marginBottom: 8, backgroundColor: 'rgba(255,237,168,0.1)', borderWidth: 1, borderColor: 'rgba(255,237,168,0.1)' },
  traitText: { fontSize: 9, letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalHUD: { width: width - 40, height: '80%', borderRadius: 32, borderWidth: 1, overflow: 'hidden' },
  hudHeader: { flexDirection: 'row', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,237,168,0.1)' },
  hudTitle: { flex: 1, color: Colors.accent, fontSize: 13, letterSpacing: 3, marginLeft: 12 },
  hudBody: { padding: 24 },
  hudAvatarPicker: { alignSelf: 'center', marginBottom: 32 },
  hudAvatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,237,168,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,237,168,0.2)' },
  hudPickedAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: Colors.accent },
  hudInputWrapper: { marginBottom: 24 },
  hudInput: { color: Colors.white, fontSize: 14, letterSpacing: 1, paddingVertical: 12 },
  hudInputLine: { height: 1, backgroundColor: 'rgba(255,237,168,0.2)', width: '100%' },
  hudActionBtn: { backgroundColor: Colors.accent, paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  hudActionText: { color: Colors.primary, fontSize: 12, letterSpacing: 2, fontWeight: 'bold' },
  hudTypeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  hudTypeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', marginHorizontal: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,237,168,0.3)' },
  hudTypeActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  hudTypeText: { fontSize: 10, letterSpacing: 1 }
});
