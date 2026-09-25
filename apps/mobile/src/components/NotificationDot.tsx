import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";

export const NotificationDot = () => {
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.loop(
            Animated.parallel([
                Animated.timing(scale, {
                    toValue: 2.5,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.container}>
            <Animated.View 
                style={[
                    styles.radiating, 
                    { 
                        transform: [{ scale }], 
                        opacity 
                    }
                ]} 
            />
            <View style={styles.dot} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 10,
        height: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF3B30', // Vibrant Red
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    radiating: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
    }
});
