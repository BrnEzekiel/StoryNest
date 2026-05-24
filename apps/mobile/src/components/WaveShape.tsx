import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

export const WaveShape = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  const offset1 = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0], // Changed to numbers to satisfy TS
  });

  const offset2 = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1, 0.5], // Changed to numbers
  });

  return (
    <View style={{ width: "100%", height: "100%" }}>
      <Svg height="100%" width="100%" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset={offset1 as any} stopColor="#FFC8DD" stopOpacity="0.5" />
            <Stop offset="0.5" stopColor="#BDE0FE" stopOpacity="0.5" />
            <Stop offset={offset2 as any} stopColor="#FFF9E6" stopOpacity="0.5" />
          </LinearGradient>
        </Defs>
        <Path
          fill="url(#grad)"
          d="M0,160 Q360,60 720,160 T1440,160 L1440,320 L0,320 Z"
        />
      </Svg>
    </View>
  );
};
