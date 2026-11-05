import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ArrowLeft, Lock } from "lucide-react-native";
import { HeaderWave } from "../components/HeaderWave";
import { StatusBar } from "expo-status-bar";

export const ResetPasswordScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme, isDarkMode } = useTheme();
  const { showNotice } = useNotice();
  const { email, otp, from } = route.params;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      showNotice({ title: "Required", message: "Please fill in both fields.", variant: "info" });
      return;
    }

    if (newPassword.length < 6) {
      showNotice({ title: "Weak Password", message: "Security first! Please use at least 6 characters.", variant: "info" });
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotice({ title: "Mismatch", message: "Passwords do not match.", variant: "info" });
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ email, otp, newPassword });
      showNotice({
        title: "Success",
        message: "Your password has been updated. You can now login.",
        variant: "success",
        actions: [{ label: from === "settings" ? "Back to Settings" : "Go to Login", kind: "primary", onPress: () => navigation.navigate(from === "settings" ? "Settings" : "Login") }],
      });
    } catch (err: any) {
      showNotice({ title: "Error", message: "Failed to reset password. The code might have expired.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const currentBg = isDarkMode ? theme.white : Colors.paleCream;

  return (
    <View style={[styles.container, { backgroundColor: currentBg }]}>
        <StatusBar style="light" />
        <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
            <View style={styles.iconCircle}>
                <Lock size={32} color={Colors.primary} />
            </View>
            <Text style={[styles.title, { fontFamily: fonts.heading }]}>New Access</Text>
            <Text style={[styles.subtitle, { fontFamily: fonts.body }]}>Create a strong new password for your{"\n"}StoryNest account.</Text>
            <HeaderWave color={currentBg} />
        </View>

        <SafeAreaView style={styles.bottomSection} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.formContent}>
                <TextField
                    label="NEW PASSWORD"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="••••••••"
                    secureTextEntry
                    icon="lock"
                    autoComplete="password-new"
                    textContentType="newPassword"
                    importantForAutofill="yes"
                />
                <TextField
                    label="CONFIRM PASSWORD"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    secureTextEntry
                    icon="lock"
                    autoComplete="password-new"
                    textContentType="newPassword"
                    importantForAutofill="yes"
                />

                <Button 
                    title={loading ? "UPDATING..." : "Reset Password"} 
                    onPress={handleReset} 
                    disabled={loading}
                    style={{ marginTop: 24 }}
                />
            </ScrollView>
        </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingBottom: 80, alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, color: Colors.white, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.paleGreen, textAlign: 'center', lineHeight: 22 },
  bottomSection: { flex: 1 },
  formContent: { padding: 32 }
});
