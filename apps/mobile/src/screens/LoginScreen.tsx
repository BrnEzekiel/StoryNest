import React, { useState, useEffect } from "react";
import * as Updates from "expo-updates";
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, Dimensions, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HeaderWave } from "../components/HeaderWave";
import { getFriendlyErrorMessage } from "../utils/ErrorHandler";
import { checkLimit, LIMITS } from "../utils/rateLimit";
import { warmupServer } from "../utils/warmup";

const { height, width } = Dimensions.get("window");

export const LoginScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme: appTheme, isDarkMode } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otaStatus, setOtaStatus] = useState<"idle" | "checking" | "applying">("idle");
  const { login } = useAuth();

  useEffect(() => {
    loadSavedEmail();
    warmupServer();
  }, []);

  const loadSavedEmail = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem("rememberedEmail");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (e) {}
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Please enter both email and password.");
      return;
    }
    if (loading) return;
    const verdict = checkLimit(`login:${trimmedEmail.toLowerCase()}`, LIMITS.login.max, LIMITS.login.windowMs);
    if (!verdict.allowed) {
      setError("Too many sign-in attempts. Please wait a minute and try again.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (rememberMe) {
        await AsyncStorage.setItem("rememberedEmail", trimmedEmail);
      } else {
        await AsyncStorage.removeItem("rememberedEmail");
      }
      await login(trimmedEmail, trimmedPassword);
    } catch (err: any) {
      console.error("[Login Error]", err.message);
      setError(getFriendlyErrorMessage(err, "We couldn't sign you in. Please check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  const currentBg = isDarkMode ? appTheme.white : Colors.paleCream;

  return (
    <View style={[styles.container, { backgroundColor: currentBg }]}>
      <ImageBackground 
        source={require("../../assets/auth-bg.jpg")} 
        style={[styles.topSection, { height: height * 0.3 + insets.top }]} 
        resizeMode="cover"
      >
        <View style={styles.brandOverlay}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
             <View style={styles.logoBox} />
          </SafeAreaView>
        </View>
        <HeaderWave color={currentBg} />
      </ImageBackground>

      <SafeAreaView style={[styles.bottomSection, { backgroundColor: currentBg }]} edges={['bottom', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardView}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            <View style={styles.headerContainer}>
               <View style={styles.underlineWrapper}>
                 <Text style={[styles.header, { fontFamily: fonts.heading, color: appTheme.black }]}>Sign in</Text>
                 <View style={[styles.headerUnderline, { backgroundColor: appTheme.primary }]} />
               </View>
            </View>

            <View style={styles.form}>
              <TextField label="Email" value={email} onChangeText={setEmail} placeholder="demo@email.com" icon="mail" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" importantForAutofill="yes" />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
                icon="lock"
                autoComplete="password"
                textContentType="password"
                importantForAutofill="yes"
              />

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.rememberMe} activeOpacity={0.8} onPress={() => setRememberMe(!rememberMe)}>
                   <View style={[styles.checkbox, { borderColor: appTheme.primary }, rememberMe && { backgroundColor: appTheme.primary }]}>
                      {rememberMe && <View style={[styles.checkboxInner, { backgroundColor: appTheme.white }]} />}
                   </View>
                   <Text style={[styles.rememberText, { fontFamily: fonts.body }]}>Remember Me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
                  <Text style={[styles.forgotText, { fontFamily: fonts.body, color: appTheme.primary }]}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {error ? <Text style={[styles.errorText, { fontFamily: fonts.body }]}>{error}</Text> : null}

              <Button title={loading ? "Signing in..." : "Login"} onPress={handleLogin} disabled={loading} style={styles.loginBtn} />

              <View style={styles.footer}>
                <Text style={[styles.footerText, { fontFamily: fonts.body }]}>Don't have an Account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
                  <Text style={[styles.footerLink, { fontFamily: fonts.heading, color: appTheme.primary }]}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSection: { width: "100%" },
  brandOverlay: { flex: 1, backgroundColor: "rgba(0, 54, 49, 0.7)" },
  safeArea: { flex: 1 },
  logoBox: { flex: 1 },
  bottomSection: { flex: 1, marginTop: -20 },
  keyboardView: { flex: 1 },
  formScroll: { paddingHorizontal: 32, paddingVertical: 40 },
  headerContainer: { marginTop: 10, alignSelf: 'flex-start' },
  underlineWrapper: { alignSelf: 'flex-start' },
  header: { fontSize: 32 },
  headerUnderline: { height: 3, marginTop: 4, marginBottom: 30, width: '100%' },
  form: { marginTop: 0, width: '100%' },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 30 },
  rememberMe: { flexDirection: "row", alignItems: "center" },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  checkboxInner: { width: 10, height: 10, borderRadius: 2 },
  rememberText: { fontSize: 13, color: Colors.mutedTeal, fontWeight: "600" },
  forgotText: { fontSize: 13, fontWeight: "700" },
  errorText: { color: Colors.error, marginBottom: 16, textAlign: "center" },
  loginBtn: { height: 56, borderRadius: 12, width: '100%' },
  socialSection: { marginTop: 32, alignItems: 'center' },
  socialText: { fontSize: 10, color: Colors.mutedTeal, letterSpacing: 1, marginBottom: 16 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: 54, borderRadius: 12 },
  googleBtnText: { fontSize: 14, marginLeft: 12 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: Colors.mutedTeal, fontSize: 14 },
  footerLink: { fontSize: 14 },
});
