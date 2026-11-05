import React, { useState, useEffect, useRef } from "react";
import { warmupServer } from "../utils/warmup";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions } from "react-native";
import { useNotice } from "../context/NoticeContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadows, Radii, Spacing } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ArrowLeft, Mail } from "lucide-react-native";
import { HeaderWave } from "../components/HeaderWave";
import { StatusBar } from "expo-status-bar";
import { checkLimit, LIMITS } from "../utils/rateLimit";

const { width } = Dimensions.get("window");

export const OTPScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme, isDarkMode } = useTheme();
  const { showNotice } = useNotice();
  const { email, type, data, from } = route.params;
  const { verifyOTP, finalizeRegistration, initiateRegistration, forgotPassword } = useAuth();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const inputs = useRef<any>([]);
  const verifyingRef = useRef(false);

  useEffect(() => {
    warmupServer();
  }, []);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    const code = otp.join("");
    if (code.length === 6 && !verifyingRef.current) {
      handleVerify(code);
    }
  }, [otp]);

  const handleOtpChange = (value: string, index: number) => {
    if (status === "error") setStatus("idle");
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const handleResend = async () => {
    if (resending) return;
    const verdict = checkLimit(`otp:resend:${email}`, LIMITS.otpResend.max, LIMITS.otpResend.windowMs);
    if (!verdict.allowed) {
      showNotice({ title: "Slow down", message: "Too many code requests. Please wait a few minutes before requesting another code.", variant: "info" });
      return;
    }
    setResending(true);
    try {
      if (type === 'registration') {
        await initiateRegistration(email, new Date(data.dob));
      } else {
        await forgotPassword(email);
      }
      setTimer(60);
      setOtp(["", "", "", "", "", ""]);
      setStatus("idle");
      inputs.current[0].focus();
      showNotice({ title: "Sent!", message: "A new code has been sent to your email.", variant: "success" });
    } catch (err: any) {
      showNotice({ title: "Error", message: err.response?.data?.error || "Failed to resend code.", variant: "error" });
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async (code: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    // Password resets verify the code atomically when the new password is
    // set, so skip the pre-check and hand the code to that screen.
    if (type !== 'registration') {
        setLoading(false);
        verifyingRef.current = false;
        navigation.navigate("ResetPassword", { email, otp: code, from });
        return;
    }
    setLoading(true);
    setStatus("idle");
    try {
      await verifyOTP(email, code);
      setStatus("success");

      console.log(`[Auth] OTP Verified. Starting final registration for ${email}...`);

      await finalizeRegistration({ ...data, email });
      console.log(`[Auth] Registration Complete.`);

    } catch (err: any) {
      console.log("[Auth] Verification/Registration Error:", err.message);
      setStatus("error");
      setLoading(false);

      const serverMsg = err.response?.data?.error || err.response?.data?.message;
      let finalMsg = serverMsg || err.message || "Process failed.";

      if (err.code === 'auth/invalid-credential') {
          finalMsg = "This email is already partially registered with a different password. Please use the original password or delete the user from Firebase console to restart.";
      }

      const statusStr = err.response ? `(HTTP ${err.response.status})` : (err.message?.includes("network") ? "(Network Error)" : "");

      showNotice({ title: "Registration Error", message: `${finalMsg} ${statusStr}`, variant: "error" });

      setTimeout(() => {
        setOtp(["", "", "", "", "", ""]);
        inputs.current[0].focus();
      }, 500);
    } finally {
      verifyingRef.current = false;
    }
  };

  const currentBg = isDarkMode ? theme.white : Colors.paleCream;

  return (
    <View style={[styles.container, { backgroundColor: currentBg }]}>
        <StatusBar style="light" />
        <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <ArrowLeft size={24} color={Colors.accent} />
            </TouchableOpacity>
            <View style={styles.iconCircle}>
                <Mail size={32} color={Colors.primary} />
            </View>
            <Text style={[styles.title, { fontFamily: fonts.heading }]}>Check your email</Text>
            <Text style={[styles.subtitle, { fontFamily: fonts.body }]}>We sent a 6-digit code to{"\n"}<Text style={{ color: Colors.accent, fontWeight: '700' }}>{email}</Text></Text>
            <HeaderWave color={currentBg} />
        </View>

        <SafeAreaView style={styles.bottomSection} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.formContent}>
                <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={ref => inputs.current[index] = ref}
                            style={[
                                styles.otpInput,
                                { fontFamily: fonts.heading, color: theme.primary },
                                digit ? { borderColor: theme.primary, borderWidth: 2 } : null,
                                status === "success" && styles.otpInputSuccess,
                                status === "error" && styles.otpInputError
                            ]}
                            value={digit}
                            onChangeText={(val) => handleOtpChange(val, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                            autoComplete={index === 0 ? "sms-otp" : "off"}
                            textContentType={index === 0 ? "oneTimeCode" : "none"}
                            importantForAutofill={index === 0 ? "yes" : "no"}
                            selectionColor={theme.primary}
                            editable={!loading}
                        />
                    ))}
                </View>

                {loading && (
                    <View style={styles.loadingArea}>
                        <Text style={[styles.loadingText, { fontFamily: fonts.heading }]}>
                            {status === "success" ? "VERIFIED! ENTERING NEST..." : "VERIFYING CODE..."}
                        </Text>
                    </View>
                )}

                <View style={styles.resendSection}>
                    <Text style={[styles.resendText, { fontFamily: fonts.body }]}>Didn't receive the code?</Text>
                    {timer > 0 ? (
                        <Text style={[styles.timerText, { fontFamily: fonts.body }]}>Resend in {timer}s</Text>
                    ) : (
                        <TouchableOpacity onPress={handleResend} disabled={resending || loading}>
                            <Text style={[styles.resendLink, { fontFamily: fonts.heading, color: theme.primary, opacity: resending ? 0.5 : 1 }]}>
                                {resending ? "Sending..." : "Resend Code"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingBottom: 80, alignItems: 'center' },
  backBtn: { position: 'absolute', left: 24, top: 60 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, color: Colors.white, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.paleGreen, textAlign: 'center', lineHeight: 22 },
  bottomSection: { flex: 1 },
  formContent: { padding: 32, alignItems: 'center' },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
  otpInput: { width: (width - 100) / 6, height: 60, borderRadius: 12, backgroundColor: Colors.white, borderWidth: 1, borderColor: 'rgba(0,54,49,0.1)', textAlign: 'center', fontSize: 24, ...Shadows.s },
  otpInputSuccess: { borderColor: "#27AE60", backgroundColor: "#F0FFF4", color: "#27AE60" },
  otpInputError: { borderColor: "#EB5757", backgroundColor: "#FFF0F0", color: "#EB5757" },
  loadingArea: { marginTop: 40, alignItems: 'center' },
  loadingText: { fontSize: 12, color: Colors.mutedTeal, marginTop: 12, letterSpacing: 1 },
  resendSection: { marginTop: 40, alignItems: 'center' },
  resendText: { fontSize: 14, color: Colors.mutedTeal },
  resendLink: { fontSize: 14, marginTop: 8, textDecorationLine: 'underline' },
  timerText: { fontSize: 14, color: Colors.mutedTeal, marginTop: 8, fontStyle: 'italic' }
});
