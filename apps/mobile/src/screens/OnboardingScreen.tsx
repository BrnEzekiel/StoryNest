import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity, SafeAreaView, Image, ImageBackground, Dimensions } from "react-native";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowRight } from "lucide-react-native";
import { HeaderWave } from "../components/HeaderWave";

const { width } = Dimensions.get("window");

const SLIDES = [
  { id: "1", title: "Welcome", body: "Enter the Nest of curated stories. Find your next favorite escape today." },
  { id: "2", title: "Discover", body: "Immerse yourself in thousands of stories from diverse genres and talented authors." },
  { id: "3", title: "Connect", body: "Join a community of readers. Share your thoughts and track your journey." },
];

export const OnboardingScreen = ({ navigation }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    startAnimation();
  }, [currentIndex]);

  const startAnimation = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true })
    ]).start();
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) setCurrentIndex(currentIndex + 1);
    else navigation.navigate("Login");
  };

  return (
    <View style={styles.container}>
      <View style={styles.topContainer}>
        <ImageBackground 
          source={require("../../assets/onboarding-bg.jpg")} 
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.brandOverlay}>
            <SafeAreaView style={styles.safeArea}>
               <View style={styles.logoBox}>
                  <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
               </View>
            </SafeAreaView>
          </View>
          <HeaderWave />
        </ImageBackground>
      </View>

      <View style={styles.bottomSection}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.title}>{SLIDES[currentIndex].title}</Text>
          <Text style={styles.bodyText}>{SLIDES[currentIndex].body}</Text>
          <View style={styles.footerRow}>
            <View style={styles.dotsContainer}>
              {SLIDES.map((_, index) => (
                <View key={index} style={[styles.dot, currentIndex === index ? styles.activeDot : styles.inactiveDot]} />
              ))}
            </View>
            <TouchableOpacity style={styles.continueBtn} onPress={handleNext} activeOpacity={0.8}>
              <Text style={styles.continueText}>Continue</Text>
              <View style={[styles.arrowCircle, Shadows.s]}>
                <ArrowRight size={20} color={Colors.white} />
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paleCream },
  topContainer: { flex: 1.2, width: "100%", overflow: 'hidden' },
  backgroundImage: { flex: 1 },
  brandOverlay: { flex: 1, backgroundColor: "rgba(0, 54, 49, 0.85)" },
  safeArea: { flex: 1 },
  logoBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  logo: { width: width * 0.75, height: 180 },
  bottomSection: { flex: 1, backgroundColor: Colors.paleCream, justifyContent: "center" },
  content: { paddingHorizontal: 40 },
  title: { fontFamily: Fonts.heading, fontSize: 44, color: Colors.primary, marginBottom: 12 },
  bodyText: { fontFamily: Fonts.body, fontSize: 16, color: Colors.mutedTeal, lineHeight: 24, marginBottom: 40 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dotsContainer: { flexDirection: "row" },
  dot: { height: 6, marginHorizontal: 3, borderRadius: 3 },
  activeDot: { width: 24, backgroundColor: Colors.primary },
  inactiveDot: { width: 8, backgroundColor: "rgba(0, 54, 49, 0.1)" },
  continueBtn: { flexDirection: "row", alignItems: "center" },
  continueText: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.primary, marginRight: 12, letterSpacing: 0.05 },
  arrowCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.error, justifyContent: "center", alignItems: "center" },
});
