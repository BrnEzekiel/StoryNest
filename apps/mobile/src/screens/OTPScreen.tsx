import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Alert, ActivityIndicator, TextInput } from "react-native";
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
  const { email, type, data } = route.params; // type: 'registration' | 'password'
  const { verifyOTP, finalizeRegistration, initiateRegistration, forgotPassword } = useAuth();
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);
  
  const inputs = useRef<any>([]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
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
      Alert.alert("Sent!", "A new code has been sent to your email.");
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      Alert.alert("Invalid Code", "Please enter the full 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      await verifyOTP(email, code);
      
      if (type === 'registration') {
        // Finalize registration with password and username
        await finalizeRegistration({ ...data, email });
        // AuthContext will handle navigation to Main on success
      } else {
        // Go to reset password screen
        navigation.navigate("ResetPassword", { email, otp: code });
      }
    } catch (err: any) {
      Alert.alert("Verification Failed", "The code you entered is incorrect or has expired.");
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
                            style={[styles.otpInput, digit && styles.otpInputFilled]}
                            value={digit}
                            onChangeText={(val) => handleOtpChange(val, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                            selectionColor={Colors.primary}
                        />
                    ))}
                </View>

                <Button 
                    title={loading ? "VERIFYING..." : "Verify Code"} 
                    onPress={handleVerify} 
                    disabled={loading}
                    style={{ marginTop: 40 }}
                />

                <View style={styles.resendSection}>
                    <Text style={styles.resendText}>Didn't receive the code?</Text>
                    {timer > 0 ? (
                        <Text style={styles.timerText}>Resend in {timer}s</Text>
                    ) : (
                        <TouchableOpacity onPress={handleResend} disabled={resending}>
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
  resendSection: { marginTop: 32, alignItems: 'center' },
  resendText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal },
  resendLink: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.error, marginTop: 8, textDecorationLine: 'underline' },
  timerText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal, marginTop: 8, fontStyle: 'italic' }
});