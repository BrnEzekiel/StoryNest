import React, { useRef } from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, Animated, Platform } from "react-native";
import { Colors, Radii, Spacing } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Impact } from "../utils/haptics";

import { useTheme } from "../context/ThemeContext";

interface ButtonProps {
  title: string;
  onPress: () => void;
  type?: "primary" | "ghost" | "secondary";
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ title, onPress, type = "primary", style, textStyle, disabled }) => {
  const { fonts } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const getButtonStyle = () => {
    switch (type) {
      case "ghost":
        return styles.ghost;
      case "secondary":
        return styles.secondary;
      default:
        return styles.primary;
    }
  };

  const getTextStyle = () => {
    switch (type) {
      case "ghost":
        return styles.ghostText;
      case "secondary":
        return styles.secondaryText;
      default:
        return styles.primaryText;
    }
  };

  const handlePress = () => {
    Impact.light();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        onPress={handlePress} 
        onPressIn={handlePressIn} 
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
        style={[styles.base, getButtonStyle(), style, disabled && { opacity: 0.5 }]}
      >
        <Text style={[styles.text, { fontFamily: fonts.heading }, getTextStyle(), textStyle]}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const fontStack = Platform.OS === 'ios' ? 'System' : 'sans-serif';

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.l,
    borderRadius: Radii.m,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: Colors.accent,
  },
  primaryText: {
    color: Colors.primary,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  ghostText: {
    color: Colors.accent,
  },
  secondary: {
    backgroundColor: Colors.primary,
  },
  secondaryText: {
    color: Colors.accent,
  },
  text: {
    fontFamily: Fonts.heading || fontStack,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
});
