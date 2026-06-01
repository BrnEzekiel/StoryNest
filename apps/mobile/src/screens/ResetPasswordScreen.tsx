import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Lock } from "lucide-react-native";
import { HeaderWave } from "../components/HeaderWave";

export const ResetPasswordScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { email, otp } = route.params;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Required", "Please fill in both fields.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Weak Password", "Security first! Please use at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ email, otp, newPassword });
      Alert.alert("Success 🎉", "Your password has been updated. You can now login.", [
        { text: "Go to Login", onPress: () => navigation.navigate("Login") }
      ]);
    } catch (err: any) {
      Alert.alert("Error", "Failed to reset password. The code might have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
        <View style={[styles.headerSection, { paddingTop: insets.top + 20 }]}>
            <View style={styles.iconCircle}>
                <Lock size={32} color={Colors.primary} />
            </View>
            <Text style={styles.title}>New Access</Text>
            <Text style={styles.subtitle}>Create a strong new password for your{"\n"}StoryNest account.</Text>
            <HeaderWave color={Colors.paleCream} />
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
                />
                <TextField 
                    label="CONFIRM PASSWORD" 
                    value={confirmPassword} 
                    onChangeText={setConfirmPassword} 
                    placeholder="••••••••" 
                    secureTextEntry 
                    icon="lock"
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
  container: { flex: 1, backgroundColor: Colors.paleCream },
  headerSection: { backgroundColor: Colors.primary, paddingBottom: 80, alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontFamily: Fonts.heading, fontSize: 28, color: Colors.white, marginBottom: 8 },
  subtitle: { fontFamily: Fonts.body, fontSize: 14, color: Colors.paleGreen, textAlign: 'center', lineHeight: 22 },
  bottomSection: { flex: 1 },
  formContent: { padding: 32 }
});