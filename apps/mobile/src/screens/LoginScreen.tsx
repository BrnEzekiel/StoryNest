import React, { useState, useEffect } from "react";
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Updates from "expo-updates";
import * as AuthSession from 'expo-auth-session';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HeaderWave } from "../components/HeaderWave";
import { RefreshCw } from "lucide-react-native";

WebBrowser.maybeCompleteAuthSession();

const { height, width } = Dimensions.get("window");

const GoogleIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24">
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </Svg>
);

export const LoginScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme: appTheme, isDarkMode } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [otaStatus, setOtaStatus] = useState<"idle" | "checking" | "applying">("idle");
  const { login, loginWithGoogle } = useAuth();

  useEffect(() => {
    checkOTAUpdate();
  }, []);

  const checkOTAUpdate = async () => {
      if (__DEV__ || !Updates.isEnabled) return;
      try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
              setOtaStatus("applying");
              await Updates.fetchUpdateAsync();
              Alert.alert("Update Ready", "The latest fixes have been downloaded. Restarting now...", [
                  { text: "Restart", onPress: () => Updates.reloadAsync() }
              ]);
          }
      } catch (e) {
          console.log("[Login OTA] No updates or error:", e);
      }
  };

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '564839035602-4704jm195dn39rlefq2fjc0u32ibehnd.apps.googleusercontent.com', // Web / Default
    androidClientId: '564839035602-t7nivq9jjg0og2t2a7tt8ttbu6ilcrip.apps.googleusercontent.com',
    iosClientId: '564839035602-4704jm195dn39rlefq2fjc0u32ibehnd.apps.googleusercontent.com', // Placeholder
  });

  useEffect(() => {
    if (request) {
      console.log("[Google Auth] Redirect URI:", request.redirectUri);
    }
  }, [request]);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleLogin(id_token!);
    } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
      setGoogleLoading(false);
    } else if (response?.type === 'error') {
      setGoogleLoading(false);
      const errorMsg = response.error?.message || "";
      console.log("[Google Auth Response Error]", errorMsg);
      
      if (errorMsg.indexOf("state") !== -1 || errorMsg.indexOf("verification failed") !== -1) {
          return;
      }
      
      Alert.alert("Google Auth", "Unable to complete sign-in. Please try again or use email.");
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    setLoading(true);
    try {
      await loginWithGoogle(idToken);
    } catch (err) {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    loadSavedEmail();
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

  const getFirebaseErrorMessage = (code: string): string => {
    switch (code) {
      case "auth/user-not-found":      return "We couldn't find an account with that email.";
      case "auth/wrong-password":      return "The password you entered is incorrect.";
      case "auth/invalid-email":       return "Please enter a valid email address.";
      case "auth/invalid-credential": return "Email or password doesn't match our records.";
      case "auth/too-many-requests":   return "Too many attempts. Please try again later.";
      case "auth/network-request-failed": return "Network error. Check your connection.";
      case "auth/email-already-in-use":   return "This email is already registered.";
      case "auth/weak-password":       return "Password should be at least 6 characters.";
      case "auth/operation-not-allowed": return "Sign-in method is currently disabled.";
      default: return "An unexpected error occurred. Please try again.";
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Please enter both email and password.");
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
      let msg = "We couldn't reach the server. Please check your internet connection.";
      
      if (err?.code?.startsWith("auth/")) {
          msg = getFirebaseErrorMessage(err.code);
      } else if (err.response?.status === 401) {
          msg = "Incorrect email or password. Please try again.";
      } else if (err.response?.status === 404) {
          msg = "StoryNest services are temporarily down. Try again shortly.";
      }
      
      setError(msg);
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
              <TextField label="Email" value={email} onChangeText={setEmail} placeholder="demo@email.com" icon="mail" />
              <TextField 
                label="Password" 
                value={password} 
                onChangeText={setPassword} 
                placeholder="Enter your password" 
                secureTextEntry 
                icon="lock"
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

              <Button title={loading ? "PREPARING..." : "Login"} onPress={handleLogin} disabled={loading} style={styles.loginBtn} />

              <View style={styles.socialSection}>
                <Text style={[styles.socialText, { fontFamily: fonts.heading }]}>OR JOIN WITH</Text>
                <TouchableOpacity 
                  style={[styles.googleBtn, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.white }]} 
                  onPress={() => {
                    setGoogleLoading(true);
                    promptAsync();
                  }}
                  disabled={loading || googleLoading}
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color={appTheme.primary} />
                  ) : (
                    <>
                      <GoogleIcon />
                      <Text style={[styles.googleBtnText, { fontFamily: fonts.heading, color: appTheme.black }]}>Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

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
