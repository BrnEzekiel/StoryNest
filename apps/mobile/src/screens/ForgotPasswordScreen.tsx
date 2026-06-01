import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, KeyRound } from "lucide-react-native";
import { HeaderWave } from "../components/HeaderWave";

export const ForgotPasswordScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { forgotPassword } = useAuth();

  const handleRequest = async () => {
    if (!email.trim()) {
      Alert.alert("Email Required", "Please enter your email to find your nest account.");
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim());
      navigation.navigate("OTP", { email: email.trim(), type: 'password' });
    } catch (err: any) {
      Alert.alert("Account Not Found", "We couldn't find an account with that email in our nest.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
        <View style={[styles.headerSection, { paddingTop: insets.top + 20 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <ArrowLeft size={24} color={Colors.accent} />
            </TouchableOpacity>
            <View style={styles.iconCircle}>
                <KeyRound size={32} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Forgotten Key?</Text>
            <Text style={styles.subtitle}>Enter your email and we'll send you{"\n"}a code to reset your access.</Text>
            <HeaderWave color={Colors.paleCream} />
        </View>

        <SafeAreaView style={styles.bottomSection} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.formContent}>
                <TextField 
                    label="YOUR EMAIL" 
                    value={email} 
                    onChangeText={setEmail} 
                    placeholder="email@example.com" 
                    icon="mail"
                    keyboardType="email-address"
                />

                <Button 
                    title={loading ? "FINDING ACCOUNT..." : "Send Reset Code"} 
                    onPress={handleRequest} 
                    disabled={loading}
                    style={{ marginTop: 24 }}
                />

                <TouchableOpacity style={styles.footer} onPress={() => navigation.goBack()}>
                    <Text style={styles.footerText}>Back to Login</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paleCream },
  headerSection: { backgroundColor: Colors.primary, paddingBottom: 80, alignItems: 'center' },
  backBtn: { position: 'absolute', left: 24, top: 60 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontFamily: Fonts.heading, fontSize: 28, color: Colors.white, marginBottom: 8 },
  subtitle: { fontFamily: Fonts.body, fontSize: 14, color: Colors.paleGreen, textAlign: 'center', lineHeight: 22 },
  bottomSection: { flex: 1 },
  formContent: { padding: 32 },
  footer: { marginTop: 32, alignItems: 'center' },
  footerText: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.primary, textDecorationLine: 'underline' }
});