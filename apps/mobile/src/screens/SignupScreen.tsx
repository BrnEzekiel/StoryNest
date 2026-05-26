import React, { useState, useEffect } from "react";
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ImageBackground, KeyboardAvoidingView, Platform, Animated, Dimensions, ScrollView, Alert } from "react-native";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import Svg, { Path } from "react-native-svg";
import { HeaderWave } from "../components/HeaderWave";

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

export const SignupScreen = ({ navigation }: any) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { register, loginWithGoogle } = useAuth();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '170425305101-f18bca4o76856idjks4isv7029esgclm.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      loginWithGoogle(id_token!);
    }
  }, [response]);
  
  const handleSignup = async () => {
    if (!username || !email || !password) {
      setError("Please fill in all fields to join the nest");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(email, password, username);
    } catch (err: any) {
      setError(err.response?.data?.error || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={require("../../assets/auth-bg.jpg")} 
        style={styles.topSection} 
        resizeMode="cover"
      >
        <View style={styles.brandOverlay}>
          <SafeAreaView style={styles.safeArea}>
             <View style={styles.logoBox} />
          </SafeAreaView>
        </View>
        <HeaderWave />
      </ImageBackground>

      <View style={styles.bottomSection}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardView}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            <View style={styles.headerContainer}>
               <View style={styles.underlineWrapper}>
                 <Text style={styles.header}>Sign up</Text>
                 <View style={styles.headerUnderline} />
               </View>
            </View>

            <View style={styles.form}>
              <TextField label="Username" value={username} onChangeText={setUsername} placeholder="Choose your handle" icon="user" />
              <TextField label="Email" value={email} onChangeText={setEmail} placeholder="email@example.com" icon="mail" />
              <TextField 
                label="Password" 
                value={password} 
                onChangeText={setPassword} 
                placeholder="Create a password" 
                secureTextEntry 
                icon="lock"
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Button title={loading ? "PREPARING NEST..." : "Sign up"} onPress={handleSignup} disabled={loading} style={styles.signupBtn} />

              <View style={styles.socialSection}>
                <Text style={styles.socialText}>OR QUICK ACCESS</Text>
                <TouchableOpacity style={[styles.googleBtn, Shadows.s]} onPress={() => promptAsync()}>
                  <GoogleIcon />
                  <Text style={styles.googleBtnText}>Join with Google</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an Account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                  <Text style={styles.footerLink}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paleCream },
  topSection: { height: height * 0.35, width: width },
  brandOverlay: { flex: 1, backgroundColor: "rgba(0, 54, 49, 0.7)" },
  safeArea: { flex: 1 },
  logoBox: { flex: 1 },
  bottomSection: { flex: 1, backgroundColor: Colors.paleCream },
  keyboardView: { flex: 1 },
  formScroll: { paddingHorizontal: 32, paddingVertical: 40 },
  headerContainer: { marginTop: 10, alignSelf: 'flex-start' },
  underlineWrapper: { alignSelf: 'flex-start' },
  header: { fontFamily: Fonts.heading, fontSize: 32, color: Colors.primary },
  headerUnderline: { height: 3, backgroundColor: Colors.error, marginTop: 4, marginBottom: 20, width: '100%' },
  form: { marginTop: 10, width: '100%' },
  errorText: { color: Colors.error, marginBottom: 16, fontFamily: Fonts.body, textAlign: "center" },
  signupBtn: { height: 56, borderRadius: 12, backgroundColor: Colors.error, width: '100%' },
  socialSection: { marginTop: 24, alignItems: 'center' },
  socialText: { fontFamily: Fonts.heading, fontSize: 10, color: Colors.mutedTeal, letterSpacing: 1, marginBottom: 16 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, width: '100%', height: 54, borderRadius: 12 },
  googleBtnText: { fontFamily: Fonts.heading, color: Colors.primary, fontSize: 14, marginLeft: 12 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontFamily: Fonts.body, color: Colors.mutedTeal, fontSize: 14 },
  footerLink: { fontFamily: Fonts.heading, color: Colors.error, fontSize: 14 },
});
