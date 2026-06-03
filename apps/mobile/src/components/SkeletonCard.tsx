import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";
import { Colors } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";

const { width } = Dimensions.get("window");

export const SkeletonCard = ({ variant = "list" }: { variant?: "list" | "featured" | "compact" }) => {
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

  const bg = isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen;

  if (variant === "featured") {
    return (
        <View style={styles.featuredCard}>
            <Animated.View style={[styles.featuredImage, { backgroundColor: bg, opacity }]} />
            <View style={styles.featuredInfo}>
                <Animated.View style={[styles.badge, { backgroundColor: bg, opacity }]} />
                <Animated.View style={[styles.titleLarge, { backgroundColor: bg, opacity }]} />
                <Animated.View style={[styles.titleMid, { backgroundColor: bg, opacity }]} />
            </View>
        </View>
    );
  }

  if (variant === "compact") {
    return (
        <View style={styles.compactCard}>
            <Animated.View style={[styles.compactImage, { backgroundColor: bg, opacity }]} />
            <Animated.View style={[styles.compactTitle, { backgroundColor: bg, opacity }]} />
        </View>
    );
  }

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.image, { backgroundColor: bg, opacity }]} />
      <View style={styles.info}>
        <Animated.View style={[styles.genre, { backgroundColor: bg, opacity }]} />
        <Animated.View style={[styles.title, { backgroundColor: bg, opacity }]} />
        <Animated.View style={[styles.author, { backgroundColor: bg, opacity }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  image: {
    width: 64,
    height: 84,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    marginLeft: 16,
  },
  genre: {
    width: 60,
    height: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  title: {
    width: "80%",
    height: 16,
    borderRadius: 4,
    marginBottom: 8,
  },
  author: {
    width: "50%",
    height: 10,
    borderRadius: 4,
  },
  featuredCard: {
    height: 240,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 32,
    width: "100%",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  featuredInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  badge: {
    width: 60,
    height: 14,
    borderRadius: 4,
    marginBottom: 12,
  },
  titleLarge: {
    width: "90%",
    height: 24,
    borderRadius: 6,
    marginBottom: 8,
  },
  titleMid: {
    width: "60%",
    height: 24,
    borderRadius: 6,
  },
  compactCard: {
    width: 120,
    marginRight: 16,
  },
  compactImage: {
    width: 120,
    height: 160,
    borderRadius: 16,
    marginBottom: 8,
  },
  compactTitle: {
    width: "80%",
    height: 14,
    borderRadius: 4,
  }
});
