import { Platform } from "react-native";

export const Colors = {
  // Brand Core
  primary: "#003631", // Deep Forest Green
  accent: "#FFEDA8",  // Warm Cream/Gold
  midForest: "#004d45",
  lightForest: "#005a50",
  mutedTeal: "#7db8b2",
  
  // Surfaces & Backgrounds
  white: "#FFFFFF",
  black: "#000000",
  paleGreen: "#e8f5f4",
  paleCream: "#FFFDF4", // Standardized to the beige cream
  transparent: "transparent",
  
  // Semantic Colors
  error: "#FF6B6B",
  success: "#34A853",
  
  // Text Colors
  darkTextCream: "#002420",
  darkTextGreen: "#003631",
};

export const Spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

export const Radii = {
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  round: 9999,
};

export const Shadows = {
  s: {
    ...Platform.select({
      android: { elevation: 3 },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      web: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  m: {
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      web: {
        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.15)",
      },
    }),
  },
  l: {
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
      },
      web: {
        boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.2)",
      },
    }),
  },
};
