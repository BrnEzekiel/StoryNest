import React, { useState, useEffect } from "react";
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { HeaderWave } from "../components/HeaderWave";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Check, Info } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";

WebBrowser.maybeCompleteAuthSession();

const GoogleIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24">
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </Svg>
);

const { height, width } = Dimensions.get("window");

export const SignupScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme: appTheme, isDarkMode } = useTheme();
  const { initiateRegistration, loginWithGoogle } = useAuth();
  
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [dob, setDob] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

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
      console.error("[Google Auth Response Error]", response.error);
      if (response.error?.message?.indexOf("state") === -1) {
        Alert.alert("Google Auth", "Handshake failed. Try clearing your phone's browser cache.");
      }
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    setLoading(true);
    try {
      await loginWithGoogle(idToken);
    } catch (err: any) {
      Alert.alert("Google Auth", "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
      setGoogleLoading(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!username.trim() || !email.trim() || !password.trim()) {
        setError("Please fill in all fields.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      setError("");
      setStep(2);
    } else {
      if (!tosAccepted || !privacyAccepted) {
        setError("Please accept the terms and privacy policy.");
        return;
      }
      
      setLoading(true);
      setError("");
      try {
        await initiateRegistration(email.trim(), dob);
        navigation.navigate("OTP", { 
          email: email.trim(), 
          type: 'registration',
          data: { 
            username: username.trim(), 
            password: password.trim(), 
            dob: dob.toISOString(), 
            tosAccepted, 
            privacyAccepted,
            referralCode: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined
          }
        });
      } catch (err: any) {
        if (err.response?.status === 403) {
            Alert.alert("Age Restriction", err.response.data.message);
        } else {
            setError(err.response?.data?.error || "Registration failed. Try again.");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDob(selectedDate);
  };

  const renderStep1 = () => (
    <View style={styles.form}>
      <TextField label="Username" value={username} onChangeText={setUsername} placeholder="Choose your handle" icon="user" />
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="email@example.com" icon="mail" keyboardType="email-address" />
      <TextField 
        label="Password" 
        value={password} 
        onChangeText={setPassword} 
        placeholder="••••••••" 
        secureTextEntry 
        icon="lock"
      />
      <TextField 
        label="Invite Code (Optional)" 
        value={referralCode} 
        onChangeText={(text) => setReferralCode(text.toUpperCase())} 
        placeholder="e.g. NEST-ALEX-1234" 
        icon="gift"
        autoCapitalize="characters"
      />
      {error ? <Text style={[styles.errorText, { fontFamily: fonts.body }]}>{error}</Text> : null}
      <Button title="Continue" onPress={handleNext} style={styles.signupBtn} />

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
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.form}>
      <Text style={[styles.complianceHeader, { fontFamily: fonts.heading, color: appTheme.black }]}>Finalizing Your Entry</Text>
      
      <TouchableOpacity 
        style={[styles.datePickerBtn, { borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : Colors.paleGreen }]} 
        onPress={() => setShowDatePicker(true)}
      >
        <View>
            <Text style={[styles.dateLabel, { fontFamily: fonts.heading }]}>DATE OF BIRTH</Text>
            <Text style={[styles.dateValue, { fontFamily: fonts.body, color: appTheme.black }]}>{dob.toDateString()}</Text>
        </View>
        <Info size={20} color={Colors.mutedTeal} />
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={dob}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}

      <View style={styles.legalSection}>
        <TouchableOpacity style={styles.checkboxRow} onPress={() => setTosAccepted(!tosAccepted)}>
            <View style={[styles.checkbox, { borderColor: appTheme.primary }, tosAccepted && { backgroundColor: appTheme.primary }]}>
                {tosAccepted && <Check size={12} color={appTheme.white} />}
            </View>
            <Text style={[styles.checkboxText, { fontFamily: fonts.body, color: appTheme.black }]}>
                I accept the <Text style={styles.link} onPress={() => navigation.navigate("Legal", { type: 'tos' })}>Terms of Service</Text>
            </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkboxRow} onPress={() => setPrivacyAccepted(!privacyAccepted)}>
            <View style={[styles.checkbox, { borderColor: appTheme.primary }, privacyAccepted && { backgroundColor: appTheme.primary }]}>
                {privacyAccepted && <Check size={12} color={appTheme.white} />}
            </View>
            <Text style={[styles.checkboxText, { fontFamily: fonts.body, color: appTheme.black }]}>
                I agree to the <Text style={styles.link} onPress={() => navigation.navigate("Legal", { type: 'privacy' })}>Privacy Policy</Text>
            </Text>
        </TouchableOpacity>

        <View style={styles.ageDisclaimer}>
            <ShieldCheck size={14} color={Colors.mutedTeal} />
            <Text style={[styles.disclaimerText, { fontFamily: fonts.body }]}>You must be 13+ to join the StoryNest.</Text>
        </View>
      </View>

      {error ? <Text style={[styles.errorText, { fontFamily: fonts.body }]}>{error}</Text> : null}

      <Button title={loading ? "PREPARING..." : "Verify Email"} onPress={handleNext} disabled={loading} style={styles.signupBtn} />
      
      <TouchableOpacity onPress={() => setStep(1)} style={styles.backLink}>
        <Text style={[styles.backLinkText, { fontFamily: fonts.body }]}>Back to details</Text>
      </TouchableOpacity>
    </View>
  );

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
             <View style={styles.headerContent}>
                <Text style={[styles.brandName, { fontFamily: fonts.heading }]}>StoryNest</Text>
                <Text style={[styles.stepIndicator, { fontFamily: fonts.body }]}>Step {step} of 2</Text>
             </View>
          </SafeAreaView>
        </View>
        <HeaderWave color={currentBg} />
      </ImageBackground>

      <SafeAreaView style={[styles.bottomSection, { backgroundColor: currentBg }]} edges={['bottom', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardView}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            <View style={styles.headerContainer}>
               <View style={styles.underlineWrapper}>
                 <Text style={[styles.header, { fontFamily: fonts.heading, color: appTheme.black }]}>{step === 1 ? "Start your journey" : "One last thing"}</Text>
                 <View style={[styles.headerUnderline, { backgroundColor: appTheme.primary }]} />
               </View>
            </View>

            {step === 1 ? renderStep1() : renderStep2()}

            <View style={styles.footer}>
              <Text style={[styles.footerText, { fontFamily: fonts.body }]}>Already part of the Nest? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={[styles.footerLink, { fontFamily: fonts.heading, color: appTheme.primary }]}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const ShieldCheck = ({ size, color }: any) => (
  <View style={{ marginRight: 8 }}><Check size={size} color={color} /></View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSection: { width: "100%" },
  brandOverlay: { flex: 1, backgroundColor: "rgba(0, 54, 49, 0.7)" },
  safeArea: { flex: 1 },
  headerContent: { padding: 24, alignItems: 'center' },
  brandName: { fontSize: 24, color: Colors.accent, letterSpacing: 2 },
  stepIndicator: { fontSize: 12, color: Colors.paleGreen, marginTop: 4 },
  bottomSection: { flex: 1 },
  keyboardView: { flex: 1 },
  formScroll: { paddingHorizontal: 32, paddingVertical: 40 },
  headerContainer: { alignSelf: 'flex-start' },
  underlineWrapper: { alignSelf: 'flex-start' },
  header: { fontSize: 32 },
  headerUnderline: { height: 3, marginTop: 4, marginBottom: 30, width: '100%' },
  form: { width: '100%' },
  errorText: { color: Colors.error, marginBottom: 16, textAlign: "center" },
  signupBtn: { height: 56, borderRadius: 12, width: '100%' },
  complianceHeader: { fontSize: 16, marginBottom: 20 },
  datePickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 24, backgroundColor: 'rgba(0,54,49,0.02)' },
  dateLabel: { fontSize: 10, color: Colors.mutedTeal, letterSpacing: 0.5 },
  dateValue: { fontSize: 16, marginTop: 4 },
  legalSection: { marginBottom: 32 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxText: { fontSize: 14 },
  link: { fontWeight: 'bold', textDecorationLine: 'underline' },
  ageDisclaimer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, opacity: 0.7 },
  disclaimerText: { fontSize: 12, color: Colors.mutedTeal },
  backLink: { marginTop: 20, alignItems: 'center' },
  backLinkText: { fontSize: 14, color: Colors.mutedTeal, textDecorationLine: 'underline' },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: Colors.mutedTeal, fontSize: 14 },
  footerLink: { fontSize: 14 },
  socialSection: { marginTop: 32, alignItems: 'center' },
  socialText: { fontSize: 10, color: Colors.mutedTeal, letterSpacing: 1, marginBottom: 16 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: 54, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,54,49,0.1)' },
  googleBtnText: { fontSize: 14, marginLeft: 12 },
});
