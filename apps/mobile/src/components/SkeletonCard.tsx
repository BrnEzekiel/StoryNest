import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";

export const SkeletonCard = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.image, { opacity }]} />
      <View style={styles.info}>
        <Animated.View style={[styles.genre, { opacity }]} />
        <Animated.View style={[styles.title, { opacity }]} />
        <Animated.View style={[styles.author, { opacity }]} />
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
    width: 56,
    height: 72,
    borderRadius: 8,
    backgroundColor: Colors.paleGreen,
  },
  info: {
    flex: 1,
    marginLeft: 16,
  },
  genre: {
    width: 60,
    height: 10,
    borderRadius: 4,
    backgroundColor: Colors.paleGreen,
    marginBottom: 8,
  },
  title: {
    width: "80%",
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.paleGreen,
    marginBottom: 8,
  },
  author: {
    width: "50%",
    height: 10,
    borderRadius: 4,
    backgroundColor: Colors.paleGreen,
  },
});
