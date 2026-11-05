import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Camera, User, Mail, FileText, Check } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import * as ImagePicker from "expo-image-picker";
import apiClient from "../api/apiClient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { tapThrottle, TAP_GAP_MS } from "../utils/rateLimit";

export const EditProfileScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser, updateUser } = useAuth();
  const { isDarkMode, theme } = useTheme();
  const { showNotice } = useNotice();

  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState("Avid reader and story lover.");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(user?.avatarUrl || null);

  const handleSave = async () => {
    if (!username.trim()) {
        showNotice({ title: "Error", message: "Username cannot be empty.", variant: "error" });
        return;
    }
    if (loading || !tapThrottle("profile:save", TAP_GAP_MS)) return;
    setLoading(true);

    // Optimistic identity: the new avatar + name appear everywhere instantly.
    const prevAvatar = user?.avatarUrl;
    const prevUsername = user?.username;
    updateUser({ avatarUrl: image || undefined, username: username.trim() }).catch(() => {});

    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("bio", bio);

      if (image && image !== user?.avatarUrl) {
          const filename = image.split('/').pop() || 'avatar.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image`;
          // @ts-ignore
          formData.append("avatar", { uri: image, name: filename, type });
      }

      // The server returns the updated user: apply it directly instead of
      // waiting for a second round-trip.
      const res = await apiClient.put("/users/me/profile", formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data) updateUser(res.data).catch(() => {});

      showNotice({ title: "Success", message: "Profile identity updated!", variant: "success" });
      navigation.goBack();
    } catch (error: any) {
      // Roll back the optimistic change so the UI never lies.
      updateUser({ avatarUrl: prevAvatar, username: prevUsername }).catch(() => {});
      const msg = error.response?.data?.error || "Failed to update profile.";
      showNotice({ title: "Error", message: msg, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EDIT IDENTITY</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={{ opacity: loading ? 0.4 : 1 }}>
            <Check size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                {image ? <Image source={{ uri: image }} style={styles.avatar} /> : (
                    <View style={styles.placeholder}><User size={40} color={Colors.mutedTeal} /></View>
                )}
                <View style={styles.cameraIcon}><Camera size={14} color={Colors.primary} /></View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to change your nest avatar</Text>
        </View>

        <TextField
            label="USERNAME"
            value={username}
            onChangeText={setUsername}
            icon="user"
            placeholder="Your handle"
        />

        <View style={styles.bioContainer}>
            <Text style={[styles.label, { color: isDarkMode ? Colors.accent : Colors.primary }]}>PERSONAL BIO</Text>
            <TextInput
                style={[styles.bioInput, { color: isDarkMode ? Colors.white : Colors.primary, borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                placeholder="Tell the nest about yourself..."
                placeholderTextColor={Colors.mutedTeal}
            />
        </View>

        <View style={styles.infoRow}>
            <Mail size={18} color={Colors.mutedTeal} />
            <Text style={styles.infoText}>{user?.email}</Text>
        </View>

        <Button
            title={loading ? "SAVING..." : "UPDATE PROFILE"}
            onPress={handleSave}
            type="primary"
            disabled={loading}
            style={{ marginTop: 40 }}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20 },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.accent, letterSpacing: 1 },
  backBtn: { padding: 4 },
  avatarSection: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.paleGreen, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatar: { width: '100%', height: '100%', borderRadius: 50 },
  placeholder: { opacity: 0.5 },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.accent, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white },
  avatarHint: { fontFamily: Fonts.body, fontSize: 12, color: Colors.mutedTeal, marginTop: 12 },
  bioContainer: { marginTop: 20 },
  label: { fontFamily: Fonts.heading, fontSize: 12, marginBottom: 8, letterSpacing: 0.5 },
  bioInput: { height: 120, borderWidth: 1, borderRadius: 12, padding: 16, fontFamily: Fonts.body, fontSize: 16, textAlignVertical: 'top' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 32, opacity: 0.6 },
  infoText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal, marginLeft: 12 },
});
