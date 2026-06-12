import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";
import { Colors } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";

const { width } = Dimensions.get("window");

export const SkeletonReader = () => {
  const { isDarkMode } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const bg = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Animated.View style={[styles.genre, { backgroundColor: bg, opacity }]} />
        <Animated.View style={[styles.title, { backgroundColor: bg, opacity }]} />
        <Animated.View style={[styles.titleShort, { backgroundColor: bg, opacity }]} />
        <View style={styles.metaRow}>
          <Animated.View style={[styles.meta, { backgroundColor: bg, opacity }]} />
          <Animated.View style={[styles.metaShort, { backgroundColor: bg, opacity }]} />
        </View>
      </View>
      
      <View style={styles.body}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={styles.paragraph}>
            <Animated.View style={[styles.line, { backgroundColor: bg, opacity }]} />
            <Animated.View style={[styles.line, { backgroundColor: bg, opacity }]} />
            <Animated.View style={[styles.line, { backgroundColor: bg, opacity }]} />
            <Animated.View style={[styles.lineShort, { backgroundColor: bg, opacity }]} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    marginTop: 40,
  },
  header: {
    marginBottom: 40,
  },
  genre: {
    width: 80,
    height: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  title: {
    width: "100%",
    height: 32,
    borderRadius: 8,
    marginBottom: 10,
  },
  titleShort: {
    width: "60%",
    height: 32,
    borderRadius: 8,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  meta: {
    width: 100,
    height: 10,
    borderRadius: 4,
  },
  metaShort: {
    width: 60,
    height: 10,
    borderRadius: 4,
  },
  body: {
    marginTop: 20,
  },
  paragraph: {
    marginBottom: 24,
  },
  line: {
    width: "100%",
    height: 14,
    borderRadius: 4,
    marginBottom: 8,
  },
  lineShort: {
    width: "85%",
    height: 14,
    borderRadius: 4,
  },
});
