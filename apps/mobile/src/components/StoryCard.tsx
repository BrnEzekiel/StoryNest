import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ViewStyle, Animated } from "react-native";
import { Colors, Radii, Shadows, Spacing } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { Clock } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";

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
  index?: number; 
}

const GENRE_COLORS: any = {
    "Fiction": ["#5856D6", "#AF52DE"],
    "Romance": ["#FF2D55", "#FF375F"],
    "Thriller": ["#FF9500", "#FF3B30"],
    "Faith": ["#007AFF", "#5AC8FA"],
    "Mystery": ["#1C1C1E", "#3A3A3C"],
    "Poetry": ["#34C759", "#32D74B"],
    "Sci-Fi": ["#5E5CE6", "#BF5AF2"],
    "Default": ["#003631", "#004D46"]
};

export const StoryCard = ({ story, onPress, variant = "list", style, index = 0 }: StoryCardProps) => {
  const { theme, fonts, isDarkMode } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100, 
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

  const colors = GENRE_COLORS[story.genre] || GENRE_COLORS["Default"];

  const renderContent = () => {
    if (variant === "featured") {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.featuredContainer, Shadows.m, style]}>
          <Image source={{ uri: story.coverUrl }} style={styles.featuredCover} />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.featuredInfo}>
            <View style={[styles.featuredBadge, { backgroundColor: theme.primary }]}><Text style={[styles.featuredBadgeText, { fontFamily: fonts.heading, color: theme.white }]}>FEATURED</Text></View>
            <Text style={[styles.featuredTitle, { fontFamily: fonts.heading }]} numberOfLines={2}>{story.title}</Text>
            <Text style={[styles.featuredMeta, { fontFamily: fonts.body }]}>{story.genre} • {story.readingTime} min read</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (variant === "compact") {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.compactContainer, style]}>
          <Image source={{ uri: story.coverUrl }} style={styles.compactCover} />
          <Text style={[styles.compactTitle, { fontFamily: fonts.heading, color: theme.black }]} numberOfLines={1}>{story.title}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.9} 
        style={[
            styles.container, 
            { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : theme.white }, 
            Shadows.s, 
            style
        ]}
      >
        <Image source={{ uri: story.coverUrl }} style={styles.cover} />
        <View style={styles.info}>
          <Text style={[styles.genre, { fontFamily: fonts.body, color: theme.primary }]}>{story.genre}</Text>
          <Text style={[styles.title, { fontFamily: fonts.heading, color: theme.black }]} numberOfLines={2}>{story.title}</Text>
          <View style={styles.meta}>
            <Text style={[styles.author, { fontFamily: fonts.body }]}>{story.authorName}</Text>
            <View style={styles.timeContainer}>
              <Clock size={12} color={Colors.mutedTeal} />
              <Text style={[styles.time, { fontFamily: fonts.body }]}>{story.readingTime} min</Text>
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
  container: {
    flexDirection: "row",
    marginBottom: Spacing.m,
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
    fontSize: 10,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
    letterSpacing: 0.05,
  },
  title: {
    fontSize: 16,
    marginBottom: Spacing.xs,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  author: {
    fontSize: 12,
    color: Colors.mutedTeal,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  time: {
    fontSize: 11,
    color: Colors.mutedTeal,
    marginLeft: 4,
  },
  featuredContainer: {
    height: 240,
    borderRadius: Radii.l,
    overflow: "hidden",
    marginBottom: Spacing.xl,
  },
  featuredCover: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  featuredInfo: {
    flex: 1,
    justifyContent: "flex-end",
    padding: Spacing.l,
  },
  featuredBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.s,
    paddingVertical: 2,
    borderRadius: Radii.s,
    marginBottom: Spacing.s,
  },
  featuredBadgeText: {
    fontSize: 10,
  },
  featuredTitle: {
    fontSize: 26,
    color: Colors.white,
    marginBottom: Spacing.s,
  },
  featuredMeta: {
    fontSize: 13,
    color: Colors.paleGreen,
  },
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
    fontSize: 14,
  },
});
