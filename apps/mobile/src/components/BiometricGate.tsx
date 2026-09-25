import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { CheckCircle2 } from "lucide-react-native";
import { Notification } from "../utils/haptics";
import { LinearGradient } from "expo-linear-gradient";

export const BiometricGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const enabled = await AsyncStorage.getItem("biometricEnabled");
        if (cancelled) return;
        if (enabled === "true") {
          setIsLocked(true);
          setTimeout(() => {
            if (!cancelled) authenticate();
          }, 400);
        } else {
          setIsLocked(false);
        }
      } catch {
        setIsLocked(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const authenticate = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setIsLocked(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Access StoryNest",
        fallbackLabel: "Use device passcode",
        cancelLabel: "Cancel",
      });

      if (result.success) {
        try {
          Notification.success();
        } catch (e) {}
        setUnlocked(true);
        setTimeout(() => setIsLocked(false), 600);
      }
    } catch (e) {
      console.log("[Biometric] Auth error", e);
      // Never permanently lock users out of the app
      setIsLocked(false);
    }
  };

  // Keep boot screen green — never return null (was a blank crash-looking screen)
  if (checking) {
    return <View style={{ flex: 1, backgroundColor: "#003631" }} />;
  }

  if (isLocked) {
    return (
      <ImageBackground
        source={require("../../assets/auth-bg.jpg")}
        style={styles.container}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(0, 30, 28, 0.9)", "rgba(0, 30, 28, 0.98)"]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.textSection}>
            <Text style={styles.title}>SECURITY GATE</Text>
            <Text style={styles.subtitle}>
              {unlocked ? "Access Granted" : "Your session is protected."}
            </Text>
          </View>

          {unlocked ? (
            <View style={styles.successBox}>
              <CheckCircle2 size={40} color={Colors.accent} />
              <Text style={styles.successText}>UNLOCKED</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btn, Shadows.m]}
              onPress={authenticate}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>RE-AUTHENTICATE</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.skip} onPress={() => setIsLocked(false)}>
            <Text style={styles.skipText}>Continue without biometrics</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>STORYNEST SECURE</Text>
        </View>
      </ImageBackground>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    width: "100%",
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 32,
    opacity: 0.9,
  },
  textSection: {
    alignItems: "center",
    marginBottom: 60,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    color: Colors.accent,
    letterSpacing: 4,
    opacity: 0.9,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.paleGreen,
    marginTop: 12,
    opacity: 0.7,
  },
  btn: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    backgroundColor: Colors.primary,
    borderRadius: 30,
    width: "100%",
  },
  btnText: {
    fontFamily: Fonts.heading,
    fontSize: 12,
    color: Colors.accent,
    textAlign: "center",
    letterSpacing: 2,
  },
  skip: { marginTop: 20 },
  skipText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.paleGreen,
    opacity: 0.8,
    textDecorationLine: "underline",
  },
  successBox: {
    alignItems: "center",
  },
  successText: {
    fontFamily: Fonts.heading,
    fontSize: 12,
    color: Colors.accent,
    marginTop: 12,
    letterSpacing: 3,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    opacity: 0.3,
  },
  footerText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.white,
    letterSpacing: 1,
  },
});
