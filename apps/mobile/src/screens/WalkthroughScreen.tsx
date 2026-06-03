import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Image, Animated } from "react-native";
import { Colors, Radii, Spacing, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { useTheme } from "../context/ThemeContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen, Sparkles, Zap, ChevronRight } from "lucide-react-native";
import { Impact } from "../utils/haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    title: "Step into the Nest",
    description: "Discover a sanctuary of hand-crafted stories that ignite your imagination and calm your soul.",
    icon: <BookOpen size={80} color={Colors.accent} />,
    bg: "#003631"
  },
  {
    id: "2",
    title: "Curated for You",
    description: "Personalize your journey with themes, fonts, and recommendations tailored to your unique taste.",
    icon: <Sparkles size={80} color={Colors.accent} />,
    bg: "#004D46"
  },
  {
    id: "3",
    title: "Become a Legend",
    description: "Read, engage, and earn XP to unlock exclusive achievements and rise through the ranks.",
    icon: <Zap size={80} color={Colors.accent} />,
    bg: "#00645A"
  }
];

export const WalkthroughScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { fonts, theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const handleNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      Impact.light();
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      Impact.medium();
      await AsyncStorage.setItem("hasSeenWalkthrough", "true");
      navigation.replace("Login");
    }
  };

  const renderItem = ({ item }: any) => (
    <View style={[styles.slide, { backgroundColor: item.bg }]}>
      <View style={styles.iconContainer}>
        {item.icon}
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { fontFamily: fonts.heading }]}>{item.title}</Text>
        <Text style={[styles.description, { fontFamily: fonts.body }]}>{item.description}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        keyExtractor={(item) => item.id}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => {
            const opacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp'
            });
            const scale = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.8, 1.2, 0.8],
              extrapolate: 'clamp'
            });
            return <Animated.View key={i} style={[styles.dot, { opacity, transform: [{ scale }] }]} />;
          })}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.8}>
          <Text style={[styles.nextText, { fontFamily: fonts.heading }]}>
            {currentIndex === SLIDES.length - 1 ? "GET STARTED" : "CONTINUE"}
          </Text>
          <ChevronRight size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  slide: { width, height, justifyContent: "center", alignItems: "center", padding: 40 },
  iconContainer: { marginBottom: 60, ...Shadows.m },
  textContainer: { alignItems: "center" },
  title: { fontSize: 32, color: Colors.accent, textAlign: "center", letterSpacing: 2, marginBottom: 20 },
  description: { fontSize: 16, color: Colors.paleGreen, textAlign: "center", lineHeight: 26, opacity: 0.9 },
  footer: { position: "absolute", bottom: 0, width: "100%", alignItems: "center" },
  pagination: { flexDirection: "row", marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginHorizontal: 6 },
  nextBtn: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.accent, paddingVertical: 18, paddingHorizontal: 40, borderRadius: 30, ...Shadows.m },
  nextText: { color: Colors.primary, fontSize: 14, letterSpacing: 1, marginRight: 8 }
});
