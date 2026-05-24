import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ViewStyle, Animated } from "react-native";
import { Colors, Radii, Shadows, Spacing } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Clock } from "lucide-react-native";

interface Story {
  id: string;
  title: string;
  coverUrl: string;
  genre: string;
  authorName: string;
  readingTime: number;
}

interface StoryCardProps {
  story: Story;
  onPress: () => void;
  variant?: "list" | "featured" | "compact";
  style?: ViewStyle;
  index?: number; // Used for staggered load (Impeccable #24)
}

export const StoryCard = ({ story, onPress, variant = "list", style, index = 0 }: StoryCardProps) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Staggered Entrance Animation (Impeccable #24)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100, // Stagger effect
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        delay: index * 100,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const renderContent = () => {
    if (variant === "featured") {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.featuredContainer, Shadows.m, style]}>
          <Image source={{ uri: story.coverUrl }} style={styles.featuredCover} />
          <View style={styles.featuredOverlay} />
          <View style={styles.featuredInfo}>
            <View style={styles.featuredBadge}><Text style={styles.featuredBadgeText}>FEATURED</Text></View>
            <Text style={styles.featuredTitle} numberOfLines={2}>{story.title}</Text>
            <Text style={styles.featuredMeta}>{story.genre} • {story.readingTime} min read</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (variant === "compact") {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.compactContainer, style]}>
          <Image source={{ uri: story.coverUrl }} style={styles.compactCover} />
          <Text style={styles.compactTitle} numberOfLines={1}>{story.title}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.container, Shadows.s, style]}>
        <Image source={{ uri: story.coverUrl }} style={styles.cover} />
        <View style={styles.info}>
          <Text style={styles.genre}>{story.genre}</Text>
          <Text style={styles.title} numberOfLines={2}>{story.title}</Text>
          <View style={styles.meta}>
            <Text style={styles.author}>{story.authorName}</Text>
            <View style={styles.timeContainer}>
              <Clock size={12} color={Colors.mutedTeal} />
              <Text style={styles.time}>{story.readingTime} min</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View 
      style={{ 
        opacity: fadeAnim, 
        transform: [{ translateY: slideAnim }] 
      }}
    >
      {renderContent()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // --- LIST VARIANT ---
  container: {
    flexDirection: "row",
    marginBottom: Spacing.m,
    backgroundColor: Colors.white,
    borderRadius: Radii.m,
    padding: Spacing.s,
  },
  cover: {
    width: 64,
    height: 84,
    borderRadius: Radii.s,
    backgroundColor: Colors.paleGreen,
  },
  info: {
    flex: 1,
    marginLeft: Spacing.m,
    justifyContent: "center",
  },
  genre: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.primary,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
    letterSpacing: 0.05,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    color: Colors.darkTextGreen,
    marginBottom: Spacing.xs,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  author: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.mutedTeal,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  time: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.mutedTeal,
    marginLeft: 4,
  },

  // --- FEATURED VARIANT ---
  featuredContainer: {
    height: 240,
    borderRadius: Radii.l,
    overflow: "hidden",
    marginBottom: Spacing.xl,
    backgroundColor: Colors.primary,
  },
  featuredCover: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 54, 49, 0.4)",
  },
  featuredInfo: {
    flex: 1,
    justifyContent: "flex-end",
    padding: Spacing.l,
  },
  featuredBadge: {
    alignSelf: "flex-start",
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.s,
    paddingVertical: 2,
    borderRadius: Radii.s,
    marginBottom: Spacing.s,
  },
  featuredBadgeText: {
    fontFamily: Fonts.heading,
    fontSize: 10,
    color: Colors.primary,
  },
  featuredTitle: {
    fontFamily: Fonts.heading,
    fontSize: 26,
    color: Colors.white,
    marginBottom: Spacing.s,
  },
  featuredMeta: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.paleGreen,
  },

  // --- COMPACT VARIANT ---
  compactContainer: {
    width: 120,
    marginRight: Spacing.m,
  },
  compactCover: {
    width: 120,
    height: 160,
    borderRadius: Radii.m,
    marginBottom: Spacing.s,
    backgroundColor: Colors.paleGreen,
  },
  compactTitle: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    color: Colors.primary,
  },
});
