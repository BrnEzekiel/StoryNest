import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image } from "react-native";
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

export const EditProfileScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { isDarkMode, theme } = useTheme();
  
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState("Avid reader and story lover.");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(user?.avatarUrl || null);

  const handleSave = async () => {
    if (!username.trim()) {
        Alert.alert("Error", "Username cannot be empty.");
        return;
    }
    setLoading(true);
    try {
      await apiClient.put("/users/me/profile", { username, bio });
      await refreshUser();
      Alert.alert("Success", "Profile identity updated!");
      navigation.goBack();
    } catch (error: any) {
      const msg = error.response?.data?.error || "Failed to update profile.";
      Alert.alert("Error", msg);
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
        <TouchableOpacity onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color={Colors.accent} /> : <Check size={24} color={Colors.accent} />}
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