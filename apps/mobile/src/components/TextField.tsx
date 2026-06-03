import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ViewStyle, TextStyle, Animated, Platform } from "react-native";
import { Colors, Radii, Spacing } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  style?: any; 
  labelStyle?: TextStyle;
  multiline?: boolean;
  icon?: "mail" | "lock" | "user";
  variant?: "dark" | "light"; 
}

export const TextField: React.FC<TextFieldProps> = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  secureTextEntry,
  style,
  labelStyle,
  multiline,
  icon,
  variant
}) => {
  const { isDarkMode, fonts, theme } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = React.useRef(new Animated.Value(0)).current;
  const iconScale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(focusAnim, {
        toValue: isFocused || value.length > 0 ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.spring(iconScale, {
        toValue: isFocused ? 1.2 : 1,
        friction: 5,
        useNativeDriver: true,
      })
    ]).start();
  }, [isFocused, value]);

  const renderIcon = () => {
    const iconSize = 20;
    const iconColor = isFocused ? theme.primary : Colors.mutedTeal;
    let iconComp = null;
    if (icon === "mail") iconComp = <Mail size={iconSize} color={iconColor} />;
    if (icon === "lock") iconComp = <Lock size={iconSize} color={iconColor} />;
    if (icon === "user") iconComp = <User size={iconSize} color={iconColor} />;
    
    if (!iconComp) return null;
    
    return (
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        {iconComp}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { fontFamily: fonts.body, color: theme.primary }, labelStyle]}>{label}</Text>
      
      <View style={styles.inputWrapper}>
        <View style={styles.iconBox}>{renderIcon()}</View>
        
        <TextInput
          style={[styles.input, { fontFamily: fonts.body, color: theme.black }, style]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 54, 49, 0.3)"}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          multiline={multiline}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          underlineColorAndroid="transparent"
          selectionColor={theme.primary}
          cursorColor={theme.primary}
          selectionHandleColor={theme.primary}
        />

        {secureTextEntry && (
          <TouchableOpacity 
            style={styles.eyeIcon} 
            activeOpacity={0.7}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color={Colors.mutedTeal} />
            ) : (
              <Eye size={20} color={Colors.mutedTeal} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.underlineBase, { backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 54, 49, 0.1)" }]}>
        <Animated.View style={[
          styles.underlineActive,
          {
            width: focusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"]
            }),
            backgroundColor: theme.primary
          }
        ]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    width: "100%",
  },
  label: {
    fontSize: 13,
    marginBottom: 4,
    fontWeight: "600",
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconBox: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {}
    }),
  },
  underlineBase: {
    height: 1,
    width: "100%",
  },
  underlineActive: {
    height: 1.5,
    position: 'absolute',
    bottom: 0,
  },
  eyeIcon: {
    padding: 4,
  }
});
