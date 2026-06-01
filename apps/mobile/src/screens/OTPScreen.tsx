import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Mail } from "lucide-react-native";
import { HeaderWave } from "../components/HeaderWave";

const { width } = Dimensions.get("window");

export const OTPScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { email, type, data } = route.params;
  const { verifyOTP, finalizeRegistration, initiateRegistration, forgotPassword } = useAuth();
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  
  const inputs = useRef<any>([]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // AUTO-VERIFY EFFECT
  useEffect(() => {
    const code = otp.join("");
    if (code.length === 6) {
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
      Alert.alert("Sent!", "A new code has been sent to your email.");
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async (code: string) => {
    setLoading(true);
    setStatus("idle");
    try {
      await verifyOTP(email, code);
      setStatus("success");
      
      // Short delay to show the green "success" state
      setTimeout(async () => {
        try {
            if (type === 'registration') {
                await finalizeRegistration({ ...data, email });
            } else {
                navigation.navigate("ResetPassword", { email, otp: code });
            }
        } catch (err: any) {
            setStatus("error");
            setOtp(["", "", "", "", "", ""]);
            Alert.alert("Error", "Final registration failed. Try again.");
        } finally {
            setLoading(false);
        }
      }, 800);

    } catch (err: any) {
      setStatus("error");
      setLoading(false);
      // Brief delay then clear
      setTimeout(() => {
        setOtp(["", "", "", "", "", ""]);
        inputs.current[0].focus();
      }, 500);
    }
  };

  return (
    <View style={styles.container}>
        <View style={[styles.headerSection, { paddingTop: insets.top + 20 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <ArrowLeft size={24} color={Colors.accent} />
            </TouchableOpacity>
            <View style={styles.iconCircle}>
                <Mail size={32} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>We sent a 6-digit code to{"\n"}<Text style={{ color: Colors.accent, fontWeight: '700' }}>{email}</Text></Text>
            <HeaderWave color={Colors.paleCream} />
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
                                digit && styles.otpInputFilled,
                                status === "success" && styles.otpInputSuccess,
                                status === "error" && styles.otpInputError
                            ]}
                            value={digit}
                            onChangeText={(val) => handleOtpChange(val, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                            selectionColor={Colors.primary}
                            editable={!loading}
                        />
                    ))}
                </View>

                {loading && (
                    <View style={styles.loadingArea}>
                        <ActivityIndicator size="large" color={status === "success" ? "#27AE60" : Colors.primary} />
                        <Text style={styles.loadingText}>
                            {status === "success" ? "VERIFIED! ENTERING NEST..." : "VERIFYING CODE..."}
                        </Text>
                    </View>
                )}

                <View style={styles.resendSection}>
                    <Text style={styles.resendText}>Didn't receive the code?</Text>
                    {timer > 0 ? (
                        <Text style={styles.timerText}>Resend in {timer}s</Text>
                    ) : (
                        <TouchableOpacity onPress={handleResend} disabled={resending || loading}>
                            {resending ? <ActivityIndicator size="small" color={Colors.error} /> : (
                                <Text style={styles.resendLink}>Resend Code</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
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
  formContent: { padding: 32, alignItems: 'center' },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
  otpInput: { width: (width - 100) / 6, height: 60, borderRadius: 12, backgroundColor: Colors.white, borderWidth: 1, borderColor: 'rgba(0,54,49,0.1)', textAlign: 'center', fontSize: 24, fontFamily: Fonts.heading, color: Colors.primary, ...Shadows.s },
  otpInputFilled: { borderColor: Colors.primary, borderWidth: 2 },
  otpInputSuccess: { borderColor: "#27AE60", backgroundColor: "#F0FFF4", color: "#27AE60" },
  otpInputError: { borderColor: "#EB5757", backgroundColor: "#FFF0F0", color: "#EB5757" },
  loadingArea: { marginTop: 40, alignItems: 'center' },
  loadingText: { fontFamily: Fonts.heading, fontSize: 12, color: Colors.mutedTeal, marginTop: 12, letterSpacing: 1 },
  resendSection: { marginTop: 40, alignItems: 'center' },
  resendText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal },
  resendLink: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.error, marginTop: 8, textDecorationLine: 'underline' },
  timerText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal, marginTop: 8, fontStyle: 'italic' }
});