import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Colors } from "../theme/colors";

const { width } = Dimensions.get("window");

// Refined 2-wave perfectly symmetrical divider
export const HeaderWave = () => (
  <View style={styles.waveContainer}>
    <Svg
      width={width}
      height={60}
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
    >
      <Path
        d="M0,160 Q360,60 720,160 T1440,160 L1440,320 L0,320 Z"
        fill={Colors.paleCream}
      />
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  waveContainer: {
    position: 'absolute',
    bottom: -1,
    width: "100%",
    height: 60,
    backgroundColor: 'transparent',
  },
});
