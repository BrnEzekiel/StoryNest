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
  style?: any; // Changed to any to allow textAlignVertical
  labelStyle?: TextStyle;
  multiline?: boolean;
  icon?: "mail" | "lock" | "user";
  variant?: "dark" | "light"; // Added missing prop
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
  const { isDarkMode } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused || value.length > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  const renderIcon = () => {
    const iconSize = 20;
    const iconColor = isFocused ? Colors.primary : Colors.mutedTeal;
    if (icon === "mail") return <Mail size={iconSize} color={iconColor} />;
    if (icon === "lock") return <Lock size={iconSize} color={iconColor} />;
    if (icon === "user") return <User size={iconSize} color={iconColor} />;
    return null;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      
      <View style={styles.inputWrapper}>
        <View style={styles.iconBox}>{renderIcon()}</View>
        
        <TextInput
          style={[styles.input, style]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(0, 54, 49, 0.3)"
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          multiline={multiline}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          underlineColorAndroid="transparent"
          selectionColor={Colors.primary}
          cursorColor={Colors.primary}
          selectionHandleColor={Colors.primary}
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

      <View style={styles.underlineBase}>
        <Animated.View style={[
          styles.underlineActive,
          {
            width: focusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"]
            }),
            backgroundColor: Colors.primary
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
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.primary,
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
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.primary,
    padding: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {}
    }),
  },
  underlineBase: {
    height: 1,
    backgroundColor: "rgba(0, 54, 49, 0.1)",
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
