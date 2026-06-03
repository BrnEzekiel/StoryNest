import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, TouchableOpacity } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ShieldCheck, Lock } from "lucide-react-native";
import { Impact } from "../utils/haptics";

export const BiometricGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLocked, setIsLocked] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        checkLock();
    }, []);

    const checkLock = async () => {
        const enabled = await AsyncStorage.getItem("biometricEnabled");
        if (enabled === "true") {
            setIsLocked(true);
            authenticate();
        } else {
            setIsLocked(false);
        }
        setChecking(false);
    };

    const authenticate = async () => {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: "Unlock StoryNest",
                fallbackLabel: "Use Passcode"
            });

            if (result.success) {
                Impact.light();
                setIsLocked(false);
            }
        } catch (e) {
            console.log("Auth error", e);
        }
    };

    if (checking) return null;

    if (isLocked) {
        return (
            <View style={styles.container}>
                <ShieldCheck size={80} color={Colors.accent} strokeWidth={1} />
                <Text style={styles.title}>STORYNEST IS LOCKED</Text>
                <Text style={styles.subtitle}>Confirm your identity to resume your journey.</Text>
                
                <TouchableOpacity style={styles.btn} onPress={authenticate}>
                    <Lock size={20} color={Colors.primary} />
                    <Text style={styles.btnText}>UNLOCK NOW</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return <>{children}</>;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.primary,
        justifyContent: "center",
        alignItems: "center",
        padding: 40
    },
    title: {
        fontFamily: Fonts.heading,
        fontSize: 20,
        color: Colors.accent,
        marginTop: 40,
        letterSpacing: 2
    },
    subtitle: {
        fontFamily: Fonts.body,
        fontSize: 14,
        color: Colors.paleGreen,
        textAlign: "center",
        marginTop: 12,
        lineHeight: 20,
        opacity: 0.8
    },
    btn: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 60,
        paddingVertical: 16,
        paddingHorizontal: 32,
        backgroundColor: Colors.accent,
        borderRadius: 12
    },
    btnText: {
        fontFamily: Fonts.heading,
        fontSize: 14,
        color: Colors.primary,
        marginLeft: 12
    }
});
