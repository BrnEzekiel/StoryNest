import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity, SafeAreaView, Image, ImageBackground, Dimensions, FlatList } from "react-native";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowRight, ChevronRight, Sparkles, BookOpen, Feather } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    title: "Discover Your Nest",
    subtitle: "A sanctuary for deep reading and immersive storytelling.",
    animation: "https://assets9.lottiefiles.com/packages/lf20_vSyc8X.json", // Premium reading anim
    icon: <Feather size={32} color={Colors.accent} />,
    color: Colors.primary
  },
  {
    id: "2",
    title: "Unfold New Worlds",
    subtitle: "From faith to mystery, explore genres that resonate with your soul.",
    animation: "https://assets1.lottiefiles.com/packages/lf20_8u9p8n.json", // World/book anim
    icon: <BookOpen size={32} color={Colors.accent} />,
    color: "#004D46"
  },
  {
    id: "3",
    title: "Connect with Authors",
    subtitle: "Support your favorite writers and track your reading journey.",
    animation: "https://assets10.lottiefiles.com/packages/lf20_mP8u8n.json", // Community anim
    icon: <Sparkles size={32} color={Colors.accent} />,
    color: "#00302C"
  }
];

export const OnboardingScreen = ({ navigation }: any) => {
  const [currentIndex, setCurrentIdex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    setCurrentIdex(viewableItems[0].index);
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem("onboardingComplete", "true");
      navigation.replace("Login");
    } catch (e) {
      navigation.navigate("Login");
    }
  };

  const nextSlide = () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleComplete();
    }
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.slide}>
      <View style={styles.animationContainer}>
        {/* Using a high-end SVG fallback if lottie takes too long */}
        <LottieView 
            source={{ uri: item.animation }}
            autoPlay
            loop
            style={styles.lottie}
        />
      </View>
      
      <View style={styles.textContainer}>
        <View style={styles.iconBox}>
            {item.icon}
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <FlatList
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
      />

      <View style={styles.footer}>
        <View style={styles.indicatorContainer}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [10, 20, 10],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View 
                key={i.toString()} 
                style={[styles.dot, { width: dotWidth, opacity }]} 
              />
            );
          })}
        </View>

        <TouchableOpacity 
          style={styles.btn} 
          onPress={nextSlide}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[Colors.error, "#D32F2F"]}
            style={styles.btnGradient}
          >
            <Text style={styles.btnText}>
                {currentIndex === SLIDES.length - 1 ? "ENTER THE NEST" : "NEXT"}
            </Text>
            <ChevronRight size={20} color={Colors.white} strokeWidth={3} />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleComplete} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip introduction</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

import { StatusBar } from "expo-status-bar";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  slide: { width, height, alignItems: 'center', justifyContent: 'center' },
  animationContainer: { flex: 0.6, width: '100%', justifyContent: 'center', alignItems: 'center' },
  lottie: { width: width * 0.8, height: width * 0.8 },
  textContainer: { flex: 0.4, paddingHorizontal: 40, alignItems: 'center' },
  iconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontFamily: Fonts.heading, fontSize: 32, color: Colors.accent, textAlign: 'center', marginBottom: 16 },
  subtitle: { fontFamily: Fonts.body, fontSize: 16, color: Colors.paleGreen, textAlign: 'center', lineHeight: 24, opacity: 0.8 },
  footer: { position: 'absolute', bottom: 50, width: '100%', alignItems: 'center' },
  indicatorContainer: { flexDirection: 'row', height: 40, justifyContent: 'center', alignItems: 'center' },
  dot: { height: 10, borderRadius: 5, backgroundColor: Colors.accent, marginHorizontal: 6 },
  btn: { width: width * 0.8, height: 64, borderRadius: 16, overflow: 'hidden', marginTop: 20, ...Shadows.m },
  btnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnText: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.white, marginRight: 12, letterSpacing: 1 },
  skipBtn: { marginTop: 24 },
  skipText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal, textDecorationLine: 'underline' }
});